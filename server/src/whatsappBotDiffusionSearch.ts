/**
 * WhatsApp "Buscar cuarto" — same extract → compose → exact/related match path as
 * admin Difusión, then reply with listing cards + a share link + ZMG broaden tip.
 */
import type { DatabaseSync } from "node:sqlite";
import type { ChatListingCard, ChatSink } from "./chatChannel.js";
import { matchGdlSearchPois } from "./gdlSearchPois.js";
import { publicWebOrigin } from "./handoffTokens.js";
import { roomReferenceCode } from "./listingReference.js";
import { isListingTag } from "./listingTags.js";
import { findMetroCity, resolveMetroCity } from "./metroCities.js";
import { countSearchCards, listingInMetro } from "./metroListingScope.js";
import { fetchPublishedListings } from "./publishedListingsQuery.js";
import {
  analyzeSharedSearch,
  createTemplateSharedSearch,
} from "./sharedSearches.js";
import type { SharedSearchExtraction } from "./sharedSearchCompose.js";
import { extractSeekerSearchWithGemini } from "./sharedSearchGemini.js";
import { highAffinitySimilar, parseSimilarConfig } from "./sharedSearchMatch.js";
import {
  parseSavedSearchFilters,
  parseSavedSearchLocation,
} from "./savedSearchMatch.js";
import type { PropertyListing } from "./types.js";
import {
  parseBudgetMaxFromText,
  parseGenderPrefFromText,
} from "./chatSearchEngine.js";

const CARD_LIMIT = 10;
const CITY = "Guadalajara";

export function fallbackExtractionFromSearchText(text: string): SharedSearchExtraction {
  const extraction: SharedSearchExtraction = {};
  const pois = matchGdlSearchPois(text);
  if (pois.length) extraction.pois = pois.map((p) => p.name);
  const budget = parseBudgetMaxFromText(text);
  if (budget != null) extraction.budgetMax = budget;
  const pref = parseGenderPrefFromText(text);
  if (pref) extraction.genderPref = pref;
  const main = pois[0]?.name;
  if (main) extraction.mainAreaLabel = main;
  return extraction;
}

export async function extractSeekerSearchForWhatsApp(text: string): Promise<SharedSearchExtraction> {
  const trimmed = text.trim();
  const fallback = fallbackExtractionFromSearchText(trimmed);
  if (trimmed.length < 12) return fallback;
  try {
    const { extraction } = await extractSeekerSearchWithGemini({ text: trimmed, city: CITY });
    return {
      ...fallback,
      ...extraction,
      pois: extraction.pois?.length ? extraction.pois : fallback.pois,
      neighborhoods: extraction.neighborhoods?.length ? extraction.neighborhoods : fallback.neighborhoods,
      budgetMax: extraction.budgetMax ?? fallback.budgetMax,
      budgetMin: extraction.budgetMin ?? fallback.budgetMin,
      genderPref: extraction.genderPref ?? fallback.genderPref,
      tags: [
        ...new Set([...(fallback.tags ?? []), ...(extraction.tags ?? []).filter(isListingTag)]),
      ],
      mainAreaLabel: extraction.mainAreaLabel || fallback.mainAreaLabel,
    };
  } catch (err) {
    console.warn("[wa-search] extract failed", err instanceof Error ? err.message : err);
    return fallback;
  }
}

function listingPrimaryImage(base: string, l: PropertyListing): string | undefined {
  const mode = l.propertyPostMode === "property" ? "property" : "room";
  const ordered =
    mode === "room"
      ? [...(l.roomImageUrls ?? []), ...(l.propertyImageUrls ?? [])]
      : [...(l.propertyImageUrls ?? []), ...(l.roomImageUrls ?? [])];
  for (const raw of ordered) {
    const u = raw?.trim();
    if (!u) continue;
    if (u.startsWith("http")) return u;
    return `${base}${u.startsWith("/") ? u : `/${u}`}`;
  }
  return undefined;
}

function priceLabel(l: PropertyListing): string {
  return l.hidePricing ? "Precio a consultar" : `$${l.rentMxn.toLocaleString("es-MX")} MXN/mes`;
}

export function cardsForDiffusionListings(listings: PropertyListing[], limit = CARD_LIMIT): ChatListingCard[] {
  const base = publicWebOrigin();
  return listings.slice(0, limit).map((l) => ({
    title: l.title.slice(0, 80),
    subtitle: `${l.neighborhood || l.city} · ${priceLabel(l)}`.slice(0, 80),
    url: `${base}/anuncio/${encodeURIComponent(roomReferenceCode(l.id))}`,
    imageUrl: listingPrimaryImage(base, l),
  }));
}

export function countMetroSearchCards(db: DatabaseSync, cityCode = "gdl"): number {
  const metro = resolveMetroCity(cityCode);
  const published = fetchPublishedListings(db).filter((l) => listingInMetro(l, metro));
  return countSearchCards(published);
}

/** @deprecated use {@link countMetroSearchCards} */
export function countZmgSearchCards(db: DatabaseSync): number {
  return countMetroSearchCards(db, "gdl");
}

export function broadenSearchMetroLine(roomCount: number, cityCode = "gdl"): string {
  // Prefer the named metro even if it is not enabled yet (future cities).
  const metro = findMetroCity(cityCode) ?? resolveMetroCity(cityCode);
  const region = metro.metroRegionLabel;
  return `Si quieres ampliar la búsqueda, hay un total de *${roomCount}* cuartos en la *${region}*.`;
}

export type WhatsAppDiffusionSearchResult = {
  sharePath: string;
  shareUrl: string;
  exactCount: number;
  similarCount: number;
  matchTotal: number;
  shown: number;
  metroTotal: number;
  /** @deprecated alias of metroTotal */
  zmgTotal: number;
};

/**
 * Extract → Difusión compose/match → persist `/busquedas/{id}` → send up to 10 cards
 * plus match-total CTA and ZMG broaden message.
 */
export async function runWhatsAppDiffusionSearchAndReply(
  db: DatabaseSync,
  sink: ChatSink,
  opts: { text: string; createdByUserId: string },
): Promise<WhatsAppDiffusionSearchResult> {
  const text = opts.text.trim().slice(0, 4000);
  await sink.sendText("_Estoy armando tu búsqueda…_");

  const extraction = await extractSeekerSearchForWhatsApp(text);
  const created = await createTemplateSharedSearch(db, {
    adminUserId: opts.createdByUserId,
    city: CITY,
    seekerName: "",
    seekerGender: extraction.seekerGenderInferred ?? extraction.genderPref ?? null,
    sourceFacebookUrl: "",
    extraction,
  });

  const filters = parseSavedSearchFilters(created.share.filters_json);
  const location = parseSavedSearchLocation(created.share.location_json);
  const similarCfg = parseSimilarConfig(created.share.similar_json);
  const split = analyzeSharedSearch(db, filters, location, similarCfg);
  const similarHigh = highAffinitySimilar(split.similar).map((r) => r.listing);
  const ranked = [...split.exact, ...similarHigh];
  const matchTotal = split.exact.length + similarHigh.length;
  const cards = cardsForDiffusionListings(ranked, CARD_LIMIT);
  const cityCode = created.share.city_code || "gdl";
  const metroTotal = countMetroSearchCards(db, cityCode);
  const base = publicWebOrigin().replace(/\/$/, "");
  const shareUrl = `${base}${created.sharePath}`;

  const totalLine =
    matchTotal === 1
      ? "Hay *1* cuarto en total en bestie.mx para esta búsqueda."
      : `Hay *${matchTotal}* cuartos en total en bestie.mx para esta búsqueda.`;
  const broadenLine = broadenSearchMetroLine(metroTotal, cityCode);

  if (cards.length > 0) {
    const intro =
      split.exact.length > 0
        ? `Encontré ${split.exact.length === 1 ? "1 anuncio exacto" : `${split.exact.length} anuncios exactos`}${
            similarHigh.length
              ? ` y ${similarHigh.length === 1 ? "1 relacionado" : `${similarHigh.length} relacionados`}`
              : ""
          }:`
        : `No hay coincidencia exacta, pero esto está relacionado:`;
    await sink.sendText(intro);
    // Cloud sink paces images and settles before returning so follow-ups never land mid-cards.
    await sink.sendListingCards(cards, "");
  } else {
    await sink.sendText(
      "No encontré anuncios que encajen ahora con esa búsqueda. Puedes ampliarla en Bestie o describir otra zona/presupuesto.",
    );
  }

  // Totals / CTA / menu always after every listing card (including media settle).
  if (sink.sendCtaUrl) {
    await sink.sendCtaUrl({
      body: totalLine,
      buttonText: "Ver búsqueda",
      url: shareUrl,
    });
  } else {
    await sink.sendText(`${totalLine}\n${shareUrl}`);
  }

  await sink.sendText(broadenLine);

  await sink.sendQuickReplies("*¿Qué sigue?*", [
    { title: "Nueva búsqueda", payload: "WA_SEARCH" },
    { title: "Menú", payload: "WA_MENU" },
    { title: "Publicar Cuarto", payload: "WA_PUB" },
  ]);

  return {
    sharePath: created.sharePath,
    shareUrl,
    exactCount: split.exact.length,
    similarCount: similarHigh.length,
    matchTotal,
    shown: cards.length,
    metroTotal,
    zmgTotal: metroTotal,
  };
}

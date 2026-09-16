/**
 * Search engine shared by the WhatsApp bot and Messenger bot.
 *
 * Two goals from GTM: the seeker sees matches on the first reply (no 3-step
 * interview), and the reply also states how much more Bestie has — posts in the
 * same zone that miss one filter, posts a bit farther out, and the city total.
 */
import type { DatabaseSync } from "node:sqlite";
import type { ChatQuickReply, ChatSink } from "./chatChannel.js";
import { matchGdlSearchPois, type SearchPoi } from "./gdlSearchPois.js";
import { publicWebOrigin } from "./handoffTokens.js";
import { isListingTag } from "./listingTags.js";
import { roomReferenceCode } from "./listingReference.js";
import { fetchPublishedListings } from "./publishedListingsQuery.js";
import { filterListings, type SearchFilters } from "./searchFilters.js";
import { EMPTY_SEARCH_FILTERS, haversineKm, SIMILAR_RADIUS_KM } from "./sharedSearchMatch.js";
import { extractSeekerSearchWithGemini } from "./sharedSearchGemini.js";
import type { ListingTag, LodgingType, PropertyListing } from "./types.js";

/** Beyond the "cerca" disk, still commutable — used for the "más cerca" bucket. */
const NEARBY_RADIUS_KM = 7;
const CARD_LIMIT = 5;

/**
 * Search state both channels persist. `WhatsAppBotDraft` is a superset of this,
 * and `MessengerSearchDraft` carries the same keys, so either can be passed in.
 */
export type ChatSearchQuery = {
  q: string;
  poiName: string | null;
  poiLat: number | null;
  poiLng: number | null;
  zoneLabel: string | null;
  budgetMax: number | null;
  pref: "female" | "male" | null;
  tags: ListingTag[];
  lodgingType: LodgingType | null;
};

export type ChatSearchOutcome = {
  /** In the 3.5 km disk and passing every filter the seeker gave. */
  exact: PropertyListing[];
  /** Same zone but over budget, or 3.5–7 km out. Ranked by distance then rent. */
  nearby: PropertyListing[];
  /** Everything published and available right now, for the "esto hay en Bestie" line. */
  cityTotal: number;
  zoneLabel: string;
  webUrl: string;
  cityUrl: string;
};

export function chatSearchFiltersFor(query: ChatSearchQuery): SearchFilters {
  return {
    ...EMPTY_SEARCH_FILTERS,
    budgetMax: query.budgetMax,
    pref: query.pref,
    tags: query.tags,
    lodgingType: query.lodgingType,
  };
}

export function applyPoiToChatSearch<T extends ChatSearchQuery>(query: T, poi: SearchPoi): T {
  return {
    ...query,
    poiName: poi.name,
    poiLat: poi.lat,
    poiLng: poi.lng,
    zoneLabel: poi.name,
    q: query.q.includes(poi.name) ? query.q : [query.q, poi.name].filter(Boolean).join(" ").trim(),
  };
}

export function parseBudgetMaxFromText(text: string): number | null {
  const t = text.toLowerCase().replace(/,/g, "");
  const mil = t.match(/(\d+(?:\.\d+)?)\s*mil\b/);
  if (mil) {
    const n = Number(mil[1]);
    if (Number.isFinite(n) && n > 0) return Math.round(n * 1000);
  }
  const money = t.match(/(?:\$|hasta\s+|máximo\s+|maximo\s+|tope\s+)?(\d{4,6})\b/);
  if (money) {
    const n = Number(money[1]);
    if (Number.isFinite(n) && n >= 1500 && n <= 80000) return n;
  }
  return null;
}

export function parseGenderPrefFromText(text: string): "female" | "male" | null {
  const t = text.toLowerCase();
  if (/\b(solo\s+mujeres|depa\s+de\s+mujeres|pref(?:erencia)?\s+mujer|roomie\s+mujer)\b/.test(t)) {
    return "female";
  }
  if (/\b(solo\s+hombres|depa\s+de\s+hombres|pref(?:erencia)?\s+hombre|roomie\s+hombre)\b/.test(t)) {
    return "male";
  }
  return null;
}

/** Zone / budget / preference / tags from one free-text message, regex first then Gemini. */
export async function enrichChatSearchFromText<T extends ChatSearchQuery>(
  query: T,
  text: string,
): Promise<T> {
  let next: T = { ...query, q: text.slice(0, 240) };
  const pois = matchGdlSearchPois(text);
  if (pois[0] && next.poiLat == null) next = applyPoiToChatSearch(next, pois[0]);
  const budget = parseBudgetMaxFromText(text);
  if (budget != null && next.budgetMax == null) next.budgetMax = budget;
  const pref = parseGenderPrefFromText(text);
  if (pref && !next.pref) next.pref = pref;

  if (text.trim().length >= 24) {
    try {
      const { extraction: ex } = await extractSeekerSearchWithGemini({ text, city: "Guadalajara" });
      if (next.budgetMax == null && typeof ex.budgetMax === "number") next.budgetMax = ex.budgetMax;
      if (!next.pref && (ex.genderPref === "female" || ex.genderPref === "male")) next.pref = ex.genderPref;
      if (ex.tags?.length) {
        next.tags = [...new Set([...next.tags, ...ex.tags.filter(isListingTag)])];
      }
      if (ex.lodgingType && !next.lodgingType) next.lodgingType = ex.lodgingType;
      if (next.poiLat == null && ex.pois?.[0]) {
        const hit = matchGdlSearchPois(ex.pois[0])[0] ?? matchGdlSearchPois(ex.mainAreaLabel ?? "")[0];
        if (hit) next = applyPoiToChatSearch(next, hit);
      }
    } catch (err) {
      console.warn("[chat-search] extract failed", err instanceof Error ? err.message : err);
    }
  }
  return next;
}

function bboxAround(lat: number, lng: number, radiusKm: number): string {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return `${(lat - dLat).toFixed(5)},${(lng - dLng).toFixed(5)},${(lat + dLat).toFixed(5)},${(lng + dLng).toFixed(5)}`;
}

function webSearchUrl(query: ChatSearchQuery, opts: { zoned: boolean }): string {
  const p = new URLSearchParams();
  p.set("q", "Guadalajara");
  if (query.budgetMax != null) p.set("max", String(query.budgetMax));
  if (query.pref) p.set("gender", query.pref);
  if (query.tags.length) p.set("tags", query.tags.join(","));
  if (query.lodgingType) p.set("lodging", query.lodgingType);
  if (opts.zoned && query.poiLat != null && query.poiLng != null) {
    p.set("bbox", bboxAround(query.poiLat, query.poiLng, SIMILAR_RADIUS_KM));
  }
  return `${publicWebOrigin()}/buscar?${p.toString()}`;
}

/**
 * Nearby keeps the seeker's non-negotiables (gender preference and lodging type)
 * but drops the budget cap and widens the disk, so "hay más" is honest without
 * offering rooms they cannot live in.
 */
function nearbyFilters(query: ChatSearchQuery): SearchFilters {
  return {
    ...EMPTY_SEARCH_FILTERS,
    pref: query.pref,
    lodgingType: query.lodgingType,
  };
}

export function runChatSearch(db: DatabaseSync, query: ChatSearchQuery): ChatSearchOutcome {
  const all = filterListings(fetchPublishedListings(db), EMPTY_SEARCH_FILTERS);
  const matching = filterListings(all, chatSearchFiltersFor(query));
  const lat = query.poiLat;
  const lng = query.poiLng;

  const byDistanceThenRent = (rows: PropertyListing[], originLat: number, originLng: number) =>
    rows
      .map((l) => ({ l, d: haversineKm(l.lat, l.lng, originLat, originLng) }))
      .sort((a, b) => a.d - b.d || a.l.rentMxn - b.l.rentMxn);

  let exact: PropertyListing[];
  let nearby: PropertyListing[];

  if (lat != null && lng != null) {
    exact = byDistanceThenRent(matching, lat, lng)
      .filter((x) => x.d <= SIMILAR_RADIUS_KM)
      .map((x) => x.l);
    const exactIds = new Set(exact.map((l) => l.id));
    nearby = byDistanceThenRent(
      filterListings(all, nearbyFilters(query)).filter((l) => !exactIds.has(l.id)),
      lat,
      lng,
    )
      .filter((x) => x.d <= NEARBY_RADIUS_KM)
      .map((x) => x.l);
  } else {
    exact = [...matching].sort((a, b) => a.rentMxn - b.rentMxn);
    const exactIds = new Set(exact.map((l) => l.id));
    nearby = filterListings(all, nearbyFilters(query))
      .filter((l) => !exactIds.has(l.id))
      .sort((a, b) => a.rentMxn - b.rentMxn);
  }

  return {
    exact,
    nearby,
    cityTotal: all.length,
    zoneLabel: query.zoneLabel ?? query.poiName ?? "Guadalajara",
    webUrl: webSearchUrl(query, { zoned: true }),
    cityUrl: webSearchUrl({ ...query, budgetMax: null, tags: [] }, { zoned: false }),
  };
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

function cardsFor(listings: PropertyListing[]) {
  const base = publicWebOrigin();
  return listings.slice(0, CARD_LIMIT).map((l) => ({
    title: l.title.slice(0, 80),
    subtitle: `${l.neighborhood || l.city} · ${priceLabel(l)}`.slice(0, 80),
    url: `${base}/anuncio/${encodeURIComponent(roomReferenceCode(l.id))}`,
    imageUrl: listingPrimaryImage(base, l),
  }));
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "3 anuncios en Centro · 12 más cerca · 48 en todo Guadalajara" + map link. */
export function chatSearchInventoryLine(outcome: ChatSearchOutcome): string {
  const parts = [`${plural(outcome.exact.length, "anuncio", "anuncios")} en ${outcome.zoneLabel}`];
  if (outcome.nearby.length) parts.push(`${outcome.nearby.length} más cerca (hasta ${NEARBY_RADIUS_KM} km)`);
  if (outcome.cityTotal > outcome.exact.length) parts.push(`${outcome.cityTotal} en todo Guadalajara`);
  return parts.join(" · ");
}

export type ChatSearchFollowupPayloads = {
  nearby: string;
  budget: string;
  zone: string;
  menu: string;
};

/**
 * Refinements offered after results. WhatsApp renders >3 as a list (an extra tap),
 * so `max` keeps the common case on buttons.
 */
export function chatSearchFollowups(
  outcome: ChatSearchOutcome,
  query: ChatSearchQuery,
  payloads: ChatSearchFollowupPayloads,
  max = 3,
): ChatQuickReply[] {
  const out: ChatQuickReply[] = [];
  if (outcome.nearby.length) out.push({ title: "Ver más cerca", payload: payloads.nearby });
  out.push({
    title: query.budgetMax == null ? "Poner presupuesto" : "Otro presupuesto",
    payload: payloads.budget,
  });
  out.push({ title: "Otra zona", payload: payloads.zone });
  out.push({ title: "Menú", payload: payloads.menu });
  return out.slice(0, max);
}

/**
 * Exact matches first, in the same reply as the inventory line, then the
 * refinement buttons. Zero exact matches falls through to nearby instead of
 * dead-ending on a map link.
 */
export async function replyChatSearchResults(
  sink: ChatSink,
  outcome: ChatSearchOutcome,
  query: ChatSearchQuery,
  payloads: ChatSearchFollowupPayloads,
  opts: { maxFollowups?: number } = {},
): Promise<void> {
  const followups = chatSearchFollowups(outcome, query, payloads, opts.maxFollowups ?? 3);
  const inventory = chatSearchInventoryLine(outcome);

  if (outcome.exact.length > 0) {
    await sink.sendListingCards(cardsFor(outcome.exact), `${inventory}\nMapa: ${outcome.webUrl}`);
    await sink.sendQuickReplies("¿Ajustamos la búsqueda?", followups);
    return;
  }

  if (outcome.nearby.length > 0) {
    await sink.sendText(
      `Nada exacto en ${outcome.zoneLabel} con esos filtros, pero esto está cerca o un poco arriba de tu tope.`,
    );
    await sink.sendListingCards(
      cardsFor(outcome.nearby),
      `${outcome.nearby.length} cerca · ${outcome.cityTotal} en todo Guadalajara\nMapa: ${outcome.cityUrl}`,
    );
    await sink.sendQuickReplies("¿Ajustamos la búsqueda?", followups);
    return;
  }

  await sink.sendText(
    [
      `No hay nada en ${outcome.zoneLabel} con esos filtros ahora.`,
      `En todo Guadalajara hay ${outcome.cityTotal} anuncios: ${outcome.cityUrl}`,
    ].join("\n"),
  );
  await sink.sendQuickReplies("¿Probamos otra zona?", followups);
}

/** "Ver más cerca" — the bucket outside the zone or above the budget cap. */
export async function replyChatSearchNearby(
  sink: ChatSink,
  outcome: ChatSearchOutcome,
  query: ChatSearchQuery,
  payloads: ChatSearchFollowupPayloads,
  opts: { maxFollowups?: number } = {},
): Promise<void> {
  if (!outcome.nearby.length) {
    await sink.sendText(
      `Ya te mostré todo lo que hay cerca de ${outcome.zoneLabel}. El mapa tiene los ${outcome.cityTotal} anuncios de Guadalajara: ${outcome.cityUrl}`,
    );
    return;
  }
  await sink.sendListingCards(
    cardsFor(outcome.nearby),
    `Cerca de ${outcome.zoneLabel} (hasta ${NEARBY_RADIUS_KM} km) o arriba de tu tope. ${outcome.cityTotal} en total: ${outcome.cityUrl}`,
  );
  await sink.sendQuickReplies(
    "¿Ajustamos la búsqueda?",
    chatSearchFollowups({ ...outcome, nearby: [] }, query, payloads, opts.maxFollowups ?? 3),
  );
}

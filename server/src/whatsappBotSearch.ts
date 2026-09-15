import type { DatabaseSync } from "node:sqlite";
import type { ChatSink } from "./chatChannel.js";
import { GDL_SEARCH_POIS, matchGdlSearchPois, type SearchPoi } from "./gdlSearchPois.js";
import { publicWebOrigin } from "./handoffTokens.js";
import { roomReferenceCode } from "./listingReference.js";
import { fetchPublishedListings } from "./publishedListingsQuery.js";
import { extractSeekerSearchWithGemini } from "./sharedSearchGemini.js";
import { EMPTY_SEARCH_FILTERS, haversineKm, SIMILAR_RADIUS_KM } from "./sharedSearchMatch.js";
import { filterListings, type SearchFilters } from "./searchFilters.js";
import { isListingTag } from "./listingTags.js";
import type { PropertyListing } from "./types.js";
import type { WhatsAppBotDraft } from "./whatsappSessionStore.js";

export type WhatsAppMenuPoi = {
  id: string;
  title: string;
  poi: SearchPoi;
};

const POI_BY_NAME = new Map(GDL_SEARCH_POIS.map((p) => [p.name, p]));

function mustPoi(name: string): SearchPoi {
  const p = POI_BY_NAME.get(name);
  if (!p) throw new Error(`missing GDL POI ${name}`);
  return p;
}

/** GDL-first shortcuts on WhatsApp (Andares / Tec stay out until stock is advertised). */
export const WHATSAPP_MENU_POIS: readonly WhatsAppMenuPoi[] = [
  { id: "chapu", title: "Chapu / Americana", poi: mustPoi("Zona Chapultepec/Americana") },
  { id: "centro", title: "Centro", poi: mustPoi("Centro") },
  { id: "iteso", title: "ITESO", poi: mustPoi("ITESO") },
  { id: "cucs", title: "CUCS", poi: mustPoi("CUCS") },
  { id: "minerva", title: "Minerva", poi: mustPoi("Zona Minerva") },
  { id: "midtown", title: "Midtown", poi: mustPoi("Punto Sao Paulo") },
  { id: "galerias", title: "Galerías", poi: mustPoi("Galerías") },
];

export function menuPoiById(id: string): WhatsAppMenuPoi | null {
  return WHATSAPP_MENU_POIS.find((p) => p.id === id) ?? null;
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

function bboxAround(lat: number, lng: number, radiusKm: number): string {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return `${(lat - dLat).toFixed(5)},${(lng - dLng).toFixed(5)},${(lat + dLat).toFixed(5)},${(lng + dLng).toFixed(5)}`;
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

export function applyMenuPoiToDraft(draft: WhatsAppBotDraft, poi: SearchPoi): WhatsAppBotDraft {
  return {
    ...draft,
    poiName: poi.name,
    poiLat: poi.lat,
    poiLng: poi.lng,
    zoneLabel: poi.name,
    q: draft.q.includes(poi.name) ? draft.q : [draft.q, poi.name].filter(Boolean).join(" ").trim(),
  };
}

export async function enrichDraftFromSearchText(draft: WhatsAppBotDraft, text: string): Promise<WhatsAppBotDraft> {
  const next = { ...draft, q: text.slice(0, 240), sourceText: [draft.sourceText, text].filter(Boolean).join("\n").slice(0, 4000) };
  const pois = matchGdlSearchPois(text);
  if (pois[0] && next.poiLat == null) {
    Object.assign(next, applyMenuPoiToDraft(next, pois[0]));
  }
  const budget = parseBudgetMaxFromText(text);
  if (budget != null && next.budgetMax == null) next.budgetMax = budget;
  const pref = parseGenderPrefFromText(text);
  if (pref && !next.pref) next.pref = pref;

  if (text.trim().length >= 24) {
    try {
      const gem = await extractSeekerSearchWithGemini({ text, city: "Guadalajara" });
      const ex = gem.extraction;
      if (next.budgetMax == null && typeof ex.budgetMax === "number") next.budgetMax = ex.budgetMax;
      if (!next.pref && (ex.genderPref === "female" || ex.genderPref === "male")) next.pref = ex.genderPref;
      if (ex.tags?.length) {
        const extra = ex.tags.filter(isListingTag);
        next.tags = [...new Set([...next.tags, ...extra])];
      }
      if (ex.lodgingType && !next.lodgingType) next.lodgingType = ex.lodgingType;
      if (next.poiLat == null && ex.pois?.[0]) {
        const hit = matchGdlSearchPois(ex.pois[0])[0] ?? matchGdlSearchPois(ex.mainAreaLabel ?? "")[0];
        if (hit) Object.assign(next, applyMenuPoiToDraft(next, hit));
      }
    } catch (err) {
      console.warn("[whatsapp] search extract failed", err instanceof Error ? err.message : err);
    }
  }
  return next;
}

function searchWebUrl(draft: WhatsAppBotDraft): string {
  const base = publicWebOrigin();
  const p = new URLSearchParams();
  p.set("q", "Guadalajara");
  if (draft.budgetMax != null) p.set("max", String(draft.budgetMax));
  if (draft.pref) p.set("gender", draft.pref);
  if (draft.tags.length) p.set("tags", draft.tags.join(","));
  if (draft.lodgingType) p.set("lodging", draft.lodgingType);
  if (draft.poiLat != null && draft.poiLng != null) {
    p.set("bbox", bboxAround(draft.poiLat, draft.poiLng, SIMILAR_RADIUS_KM));
  }
  return `${base}/buscar?${p.toString()}`;
}

export async function runWhatsAppSearchAndReply(
  db: DatabaseSync,
  sink: ChatSink,
  draft: WhatsAppBotDraft,
): Promise<void> {
  const base = publicWebOrigin();
  const filters: SearchFilters = {
    ...EMPTY_SEARCH_FILTERS,
    budgetMax: draft.budgetMax,
    pref: draft.pref,
    tags: draft.tags,
    lodgingType: draft.lodgingType,
  };
  let list = filterListings(fetchPublishedListings(db), filters);
  if (draft.poiLat != null && draft.poiLng != null) {
    const lat = draft.poiLat;
    const lng = draft.poiLng;
    list = list
      .map((l) => ({ l, d: haversineKm(l.lat, l.lng, lat, lng) }))
      .filter((x) => x.d <= SIMILAR_RADIUS_KM)
      .sort((a, b) => a.d - b.d || a.l.rentMxn - b.l.rentMxn)
      .map((x) => x.l);
  }
  const web = searchWebUrl(draft);
  const zone = draft.zoneLabel ?? "Guadalajara";

  if (list.length === 0) {
    await sink.sendText(
      `No encontré cuartos cerca de ${zone} con esos filtros. Ajusta en el mapa:\n${web}`,
    );
    return;
  }

  const top = list.slice(0, 3);
  const cards = top.map((l) => ({
    title: l.title.slice(0, 80),
    subtitle: `${l.neighborhood || l.city} · $${l.hidePricing ? "Consultar" : l.rentMxn} MXN/mes`.slice(0, 80),
    url: `${base}/anuncio/${encodeURIComponent(roomReferenceCode(l.id))}`,
    imageUrl: listingPrimaryImage(base, l),
  }));
  await sink.sendListingCards(
    cards,
    `${top.length}${list.length > top.length ? ` de ${list.length}` : ""} cerca de ${zone}. Más en el mapa: ${web}`,
  );
}

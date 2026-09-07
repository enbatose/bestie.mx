import { resolveMetroCity } from "./metroCities.js";
import type { Bbox, SearchFilters } from "./searchFilters.js";
import type { ListingTag, LodgingType } from "./types.js";
import type { SavedSearchLocationSnapshot } from "./savedSearchMatch.js";
import {
  EMPTY_SEARCH_FILTERS,
  defaultSimilarConfig,
  resolvePlacePins,
  type SharedSearchInsight,
  type SharedSearchNonNegotiable,
  type SharedSearchSimilarConfig,
} from "./sharedSearchMatch.js";

export type SharedSearchExtraction = {
  budgetMin?: number;
  budgetMax?: number;
  neighborhoods?: string[];
  pois?: string[];
  lodgingType?: LodgingType | null;
  wantHouse?: boolean;
  wantApartment?: boolean;
  wantLoft?: boolean;
  tags?: string[];
  requiredTags?: string[];
  deniedTags?: string[];
  genderPref?: "female" | "male" | null;
  seekerGenderInferred?: "female" | "male" | null;
  age?: number;
  ageMin?: number;
  ageMax?: number;
  availableFrom?: string;
  minimalStayMonths?: number;
  bbox?: Bbox | null;
  mainAreaLabel?: string;
  descriptionKeywords?: string;
  unmappedCriteria?: Array<{ label?: string; text?: string }>;
  nonNegotiables?: Array<{ kind?: string; value?: string; reason?: string }>;
  confidence?: Record<string, number>;
};

const TAG_SET = new Set<string>([
  "wifi",
  "agua",
  "luz",
  "gas",
  "mascotas",
  "estacionamiento",
  "muebles",
  "baño-privado",
  "fumar",
  "ventilador",
  "closet",
  "fiestas",
  "aire-acondicionado",
  "seguridad-acceso",
  "vigilancia",
  "lavanderia",
  "lavadora",
  "secadora",
  "cocina-equipada",
  "terraza",
  "lgbt-friendly",
  "profesionistas",
  "estudiantes",
  "residentes-medicos",
  "nomadas-digitales",
  "individuos-solo",
  "parejas",
  "familiar-ninos",
  "servicios-incluidos",
  "cerradura-cuarto",
  "agua-caliente",
  "cerca-transporte",
]);

export function outreachCityToCode(city: string): string {
  const n = city
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (n.includes("merida")) return "mid";
  if (n.includes("vallarta")) return "pvr";
  if (n.includes("sayulita")) return "say";
  if (n.includes("bucerias")) return "buc";
  return "gdl";
}

function asTags(raw: unknown): ListingTag[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is ListingTag => typeof t === "string" && TAG_SET.has(t));
}

function clampBudget(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export type ComposedSharedSearch = {
  filters: SearchFilters;
  location: SavedSearchLocationSnapshot;
  similar: SharedSearchSimilarConfig;
  insights: SharedSearchInsight[];
  nonNegotiables: SharedSearchNonNegotiable[];
  qText: string;
  label: string;
  mainArea: string;
};

export function composeSharedSearch(opts: {
  city: string;
  seekerGender: "female" | "male" | null;
  extraction: SharedSearchExtraction;
}): ComposedSharedSearch {
  const cityCode = outreachCityToCode(opts.city);
  const metro = resolveMetroCity(cityCode);
  const ext = opts.extraction;
  const seekerGender = opts.seekerGender ?? ext.seekerGenderInferred ?? null;

  const neighborhoods = (ext.neighborhoods ?? []).map((n) => n.trim()).filter(Boolean);
  const poiNames = (ext.pois ?? []).map((n) => n.trim()).filter(Boolean);
  const neighborhoodPins = resolvePlacePins(neighborhoods, "neighborhood", cityCode);
  const poiPins = resolvePlacePins(poiNames, "poi", cityCode);
  const extraPins = ext.mainAreaLabel ? resolvePlacePins([ext.mainAreaLabel], "neighborhood", cityCode) : [];
  const pins = [...neighborhoodPins, ...poiPins, ...extraPins].filter(
    (p, i, arr) => arr.findIndex((x) => x.name === p.name) === i,
  );

  const requiredTags = asTags(ext.requiredTags);
  const wantedTags = asTags(ext.tags).filter((t) => !requiredTags.includes(t));
  const lodging =
    ext.lodgingType === "private_room" || ext.lodgingType === "shared_room" || ext.lodgingType === "whole_home"
      ? ext.lodgingType
      : null;

  const qParts = [ext.descriptionKeywords?.trim() ?? ""];
  const insights: SharedSearchInsight[] = [];
  for (const item of ext.unmappedCriteria ?? []) {
    const text = (item.text ?? item.label ?? "").trim();
    if (!text) continue;
    insights.push({ label: (item.label ?? text).trim(), text, mapped: false });
    qParts.push(text);
  }
  for (const tag of wantedTags) {
    insights.push({ label: tag, text: tag, mapped: true });
  }
  for (const tag of requiredTags) {
    insights.push({ label: `no-negociable:${tag}`, text: tag, mapped: true });
  }

  const qText = qParts.filter(Boolean).join(" ").trim().slice(0, 400);

  const filters: SearchFilters = {
    ...EMPTY_SEARCH_FILTERS,
    q: "",
    budgetMin: clampBudget(ext.budgetMin),
    budgetMax: clampBudget(ext.budgetMax),
    tags: wantedTags,
    pref: seekerGender,
    age: typeof ext.age === "number" && Number.isFinite(ext.age) ? ext.age : null,
    ageMin: typeof ext.ageMin === "number" ? ext.ageMin : null,
    ageMax: typeof ext.ageMax === "number" ? ext.ageMax : null,
    bbox: null,
    lodgingType: lodging === "whole_home" ? null : lodging,
    wantHouse: ext.wantHouse === true,
    wantApartment: ext.wantApartment === true,
    wantLoft: ext.wantLoft === true || lodging === "whole_home",
    availableFrom: typeof ext.availableFrom === "string" ? ext.availableFrom : null,
    minimalStayMonths: typeof ext.minimalStayMonths === "number" ? ext.minimalStayMonths : null,
  };

  const centerPin = neighborhoodPins[0] ?? poiPins[0] ?? pins[0];
  const location: SavedSearchLocationSnapshot = {
    cityCode: metro.code,
    cityLabel: opts.city.trim() || metro.label,
    neighborhoods: neighborhoodPins,
    lat: centerPin?.lat ?? metro.defaultCenter[0],
    lng: centerPin?.lng ?? metro.defaultCenter[1],
    zoom: neighborhoodPins.length || poiPins.length ? metro.neighborhoodZoom : metro.defaultZoom,
  };

  const nonNegotiables: SharedSearchNonNegotiable[] = [];
  if (seekerGender) {
    nonNegotiables.push({
      kind: "gender",
      value: seekerGender,
      reason: seekerGender === "female" ? "No mostrar cuartos exclusivos para hombres" : "No mostrar cuartos exclusivos para mujeres",
    });
  }
  for (const tag of requiredTags) {
    nonNegotiables.push({ kind: "tag", value: tag, reason: `Requisito: ${tag}` });
  }
  if (lodging === "private_room" || lodging === "shared_room") {
    const lodgingHard = (ext.nonNegotiables ?? []).some(
      (n) => (n.kind ?? "").toLowerCase().includes("lodging") || (n.value ?? "").includes("recámara"),
    );
    if (lodgingHard) {
      nonNegotiables.push({ kind: "lodging", value: lodging, reason: "Tipo de recámara no negociable" });
    }
  }
  for (const n of ext.nonNegotiables ?? []) {
    const kind = (n.kind ?? "other").trim() || "other";
    const value = (n.value ?? "").trim();
    if (!value) continue;
    if (nonNegotiables.some((x) => x.kind === kind && x.value === value)) continue;
    nonNegotiables.push({ kind, value, reason: (n.reason ?? value).trim() });
  }

  const lodgingHard = nonNegotiables.some((n) => n.kind === "lodging");
  const similar = defaultSimilarConfig({
    pois: pins.length ? pins : neighborhoodPins,
    bbox: ext.bbox ?? null,
    requiredTags,
    lodgingType: lodgingHard && lodging !== "whole_home" ? lodging : null,
    seekerGender,
  });

  const mainArea =
    (ext.mainAreaLabel ?? "").trim() ||
    neighborhoodPins[0]?.name ||
    poiPins[0]?.name ||
    metro.label;
  const priceBit =
    filters.budgetMin != null && filters.budgetMax != null
      ? `$${Math.round(filters.budgetMin / 1000)}–${Math.round(filters.budgetMax / 1000)}k`
      : filters.budgetMax != null
        ? `hasta $${Math.round(filters.budgetMax).toLocaleString("es-MX")}`
        : filters.budgetMin != null
          ? `desde $${Math.round(filters.budgetMin).toLocaleString("es-MX")}`
          : "";
  const label = [metro.abbr || metro.label, priceBit, mainArea].filter(Boolean).join(" · ").slice(0, 200);

  return { filters, location, similar, insights, nonNegotiables, qText, label, mainArea };
}

export function formatShareOgCaption(opts: {
  exactCount: number;
  similarCount: number;
  cityAbbr: string;
  priceLabel: string;
  mainArea: string;
  cityLabel?: string;
}): string {
  // FB in-comment cards often show only domain + og:title (description hidden). Put place early.
  const place = usefulPlacePhrase(opts.mainArea, [opts.cityAbbr, opts.cityLabel ?? "", "GDL", "Guadalajara"]);
  const price = opts.priceLabel.trim();
  const counts = `${opts.exactCount} en zona, ${opts.similarCount} cerca`;
  if (place) {
    const primary = `${place} · ${counts}`;
    const withPrice = price ? `${primary} · ${price}` : primary;
    if (withPrice.length <= 90) return withPrice;
    if (primary.length <= 90) return primary;
    return truncatePlace(primary, 90);
  }
  const cityOnly = `${counts} · ${opts.cityAbbr}${price ? ` · ${price}` : ""}`.trim();
  return cityOnly.slice(0, 90);
}

/** Prefer a pin, else zone sentence, else unmapped “Cerca de…”, else the area bit of the share label. */
export function resolveSharedSearchPlacePhrase(opts: {
  neighborhoods?: { name: string }[];
  pois?: { name: string }[];
  cityAbbr?: string;
  cityLabel?: string;
  label?: string;
  zoneRule?: string;
  insights?: Array<{ label: string; text: string; mapped: boolean }>;
  mainAreaFallback?: string;
}): string {
  const cityHints = [opts.cityAbbr, opts.cityLabel, "GDL", "Guadalajara"].filter(Boolean) as string[];
  const fromPin =
    opts.neighborhoods?.map((n) => n.name.trim()).find(Boolean) ||
    opts.pois?.map((p) => p.name.trim()).find(Boolean) ||
    "";
  if (fromPin && usefulPlacePhrase(fromPin, cityHints)) return fromPin;

  const zone = opts.zoneRule?.trim() ?? "";
  // City-only zone ("Guadalajara") must not beat a label like "… · Plaza Patria".
  if (zone && zone !== "Área del mapa" && usefulPlacePhrase(zone, cityHints)) {
    return zone;
  }

  for (const insight of opts.insights ?? []) {
    if (insight.mapped) continue;
    const text = insight.text.trim();
    const label = insight.label.trim();
    if (!text) continue;
    const looksLocation =
      /ubicaci[oó]n/i.test(label) ||
      /cerca de/i.test(text) ||
      /cerca de/i.test(label) ||
      /^(av\.?|avenida|calle|colonia|col\.|zona|plaza|estadio)\b/i.test(text);
    if (!looksLocation) continue;
    const cleaned = stripCercaPrefix(text);
    if (usefulPlacePhrase(cleaned, cityHints)) return cleaned;
  }

  const fromLabel = areaFromShareLabel(opts.label, opts.cityAbbr, opts.cityLabel);
  if (fromLabel) return fromLabel;

  const fallback = (opts.mainAreaFallback ?? "").trim();
  return usefulPlacePhrase(fallback, cityHints);
}

/** Empty when the phrase is only the metro (FB comments need a colonia/POI in og:title). */
function usefulPlacePhrase(place: string, cityHints: string | string[]): string {
  const p = place.trim();
  if (!p) return "";
  const hints = (Array.isArray(cityHints) ? cityHints : [cityHints])
    .filter((h): h is string => typeof h === "string" && h.trim().length > 0)
    .map((h) => h.trim());
  const normalizedPlace = normalizePlaceCompare(p);
  for (const city of hints) {
    const normalizedCity = normalizePlaceCompare(city);
    if (!normalizedCity) continue;
    if (normalizedPlace === normalizedCity) return "";
  }
  return p;
}

function stripCercaPrefix(text: string): string {
  return text.replace(/^cerca de\s+/i, "").trim();
}

function areaFromShareLabel(
  label: string | undefined,
  cityAbbr?: string,
  cityLabel?: string,
): string {
  if (!label?.trim()) return "";
  const parts = label
    .split("·")
    .map((p) => p.trim())
    .filter(Boolean);
  const skip = new Set(
    [cityAbbr, cityLabel, "GDL", "Guadalajara"]
      .filter(Boolean)
      .map((s) => normalizePlaceCompare(String(s))),
  );
  for (const part of parts) {
    if (/^\$|hasta\s+\$|desde\s+\$|máx\.|min\./i.test(part)) continue;
    if (skip.has(normalizePlaceCompare(part))) continue;
    if (part.length < 3) continue;
    return part;
  }
  return "";
}

function normalizePlaceCompare(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function truncatePlace(place: string, max: number): string {
  if (place.length <= max) return place;
  if (max <= 1) return place.slice(0, max);
  return `${place.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

export function priceLabelFromFilters(filters: SearchFilters): string {
  const fmt = (n: number) => {
    if (n >= 1000) return `$${Math.round(n / 1000)}k`;
    return `$${n}`;
  };
  if (filters.budgetMin != null && filters.budgetMax != null) {
    return `${fmt(filters.budgetMin)}–${fmt(filters.budgetMax)}`;
  }
  if (filters.budgetMax != null) return `hasta ${fmt(filters.budgetMax)}`;
  if (filters.budgetMin != null) return `desde ${fmt(filters.budgetMin)}`;
  return "";
}

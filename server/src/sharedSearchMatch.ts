import {
  cleanedPlaceKey,
  matchGdlSearchPois,
  normalizePlaceKey,
  specificPlacePhrase,
} from "./gdlSearchPois.js";
import {
  listingMatchesNeighborhoodNames,
  resolveCuratedNeighborhoodPin,
} from "./locationSearch.js";
import { filterListings, type Bbox, type SearchFilters } from "./searchFilters.js";
import type { ListingTag, LodgingType, PropertyListing } from "./types.js";
import type { SavedSearchLocationSnapshot } from "./savedSearchMatch.js";
import { resolveMetroCity } from "./metroCities.js";

export const SIMILAR_RADIUS_KM = 3.5;
/** Same disk as GTM “cerca” and campaign ads (was 1.2 km for Difusión-only). */
export const EXACT_POI_RADIUS_KM = SIMILAR_RADIUS_KM;
export const PRICE_BAND = 0.25;
export const LOCATION_WEIGHT = 0.55;
export const PRICE_WEIGHT = 0.45;
export const HIGH_AFFINITY_MIN = 0.55;
export const SIMILAR_CAP = 12;
const EXPANDED_RADIUS_KM = 7;

export type SearchPlacePin = { name: string; lat: number; lng: number };

export type SharedSearchSimilarConfig = {
  radiusKm: number;
  priceBandPct: number;
  pois: SearchPlacePin[];
  bbox: Bbox | null;
  requiredTags: ListingTag[];
  /** Hard excludes, e.g. singles-only rooms when the seeker asked for two people. */
  excludedTags?: ListingTag[];
  lodgingType: LodgingType | null;
  seekerGender: "female" | "male" | null;
  highAffinityMin: number;
  /**
   * Share named a landmark we could not pin. Do not treat the metro as "en zona".
   * Not persisted — recomputed on each open so a later catalog pin can recover it.
   */
  unresolvedPlace?: boolean;
};

export type SharedSearchInsight = {
  label: string;
  text: string;
  mapped: boolean;
};

export type SharedSearchNonNegotiable = {
  kind: string;
  value: string;
  reason: string;
};

export type RankedListing = {
  listing: PropertyListing;
  score: number;
  locationScore: number;
  priceScore: number;
};

export const EMPTY_SEARCH_FILTERS: SearchFilters = {
  q: "",
  budgetMin: null,
  budgetMax: null,
  tags: [],
  pref: null,
  age: null,
  ageMin: null,
  ageMax: null,
  bbox: null,
  lodgingType: null,
  wantHouse: false,
  wantApartment: false,
  wantLoft: false,
  availableFrom: null,
  minimalStayMonths: null,
  roomDimensions: [],
  avalRequired: null,
  subletAllowed: null,
};

export function defaultSimilarConfig(
  over: Partial<SharedSearchSimilarConfig> = {},
): SharedSearchSimilarConfig {
  return {
    radiusKm: SIMILAR_RADIUS_KM,
    priceBandPct: PRICE_BAND,
    pois: [],
    bbox: null,
    requiredTags: [],
    excludedTags: [],
    lodgingType: null,
    seekerGender: null,
    highAffinityMin: HIGH_AFFINITY_MIN,
    ...over,
  };
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

function pointInBbox(lat: number, lng: number, b: Bbox): boolean {
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}

function listingMatchesNeighborhoods(
  listing: PropertyListing,
  neighborhoods: SavedSearchLocationSnapshot["neighborhoods"],
): boolean {
  return listingMatchesNeighborhoodNames(
    listing,
    neighborhoods.map((n) => n.name),
  );
}

export function minDistanceKmToPins(listing: PropertyListing, pins: SearchPlacePin[]): number | null {
  if (!pins.length) return null;
  let min = Infinity;
  for (const pin of pins) {
    const d = haversineKm(listing.lat, listing.lng, pin.lat, pin.lng);
    if (d < min) min = d;
  }
  return Number.isFinite(min) ? min : null;
}

function locationScoreFor(listing: PropertyListing, cfg: SharedSearchSimilarConfig, radiusKm: number): number {
  if (cfg.bbox && pointInBbox(listing.lat, listing.lng, cfg.bbox)) return 1;
  const dist = minDistanceKmToPins(listing, cfg.pois);
  if (dist == null) return cfg.unresolvedPlace ? 0 : 0.45;
  if (dist <= 0.15) return 1;
  if (dist >= radiusKm) return 0;
  return Math.max(0, 1 - dist / radiusKm);
}

function listingHasUsablePrice(listing: PropertyListing): boolean {
  return !listing.hidePricing && typeof listing.rentMxn === "number" && listing.rentMxn > 0;
}

function priceMid(filters: SearchFilters): number | null {
  if (filters.budgetMin != null && filters.budgetMax != null) {
    return (filters.budgetMin + filters.budgetMax) / 2;
  }
  if (filters.budgetMax != null) return filters.budgetMax;
  if (filters.budgetMin != null) return filters.budgetMin;
  return null;
}

function priceScoreFor(listing: PropertyListing, filters: SearchFilters, band: number): number | null {
  const mid = priceMid(filters);
  if (mid == null || mid <= 0) return 1;
  if (!listingHasUsablePrice(listing)) return null;
  const delta = Math.abs(listing.rentMxn - mid) / mid;
  if (delta >= band) return 0;
  return Math.max(0, 1 - delta / band);
}

export function passesGenderNonNegotiable(
  listing: PropertyListing,
  seekerGender: "female" | "male" | null,
): boolean {
  if (!seekerGender) return true;
  if (listing.roommateGenderPref === "any") return true;
  return listing.roommateGenderPref === seekerGender;
}

const COUPLE_OCCUPANCY_RE =
  /\b(?:para\s+(?:dos|2)\s+personas|somos\s+(?:dos|2)|somos\s+pareja|para\s+(?:mi\s+)?pareja|en\s+pareja|cuarto\s+para\s+(?:dos|2))\b/i;

/** "Cuarto para dos personas" is a couple room, not a singles-only listing. */
export function coupleOccupancyRequested(texts: string[]): boolean {
  return texts.some((raw) => COUPLE_OCCUPANCY_RE.test(raw));
}

function listingHitsExcludedTag(listing: PropertyListing, cfg: SharedSearchSimilarConfig): boolean {
  const excluded = cfg.excludedTags ?? [];
  return excluded.some((tag) => listing.tags.includes(tag));
}

function passesHardSimilar(
  listing: PropertyListing,
  cfg: SharedSearchSimilarConfig,
): boolean {
  if (!passesGenderNonNegotiable(listing, cfg.seekerGender)) return false;
  if (listingHitsExcludedTag(listing, cfg)) return false;
  if (cfg.lodgingType && listing.lodgingType && listing.lodgingType !== cfg.lodgingType) return false;
  for (const tag of cfg.requiredTags) {
    if (!listing.tags.includes(tag)) return false;
  }
  return listing.roomOccupancyStatus !== "occupied";
}

/** Neighborhood pins and POI pins are the same 3.5 km disks. */
export function zonePinsForSearch(
  location: SavedSearchLocationSnapshot,
  cfg: SharedSearchSimilarConfig,
): SearchPlacePin[] {
  const out: SearchPlacePin[] = [];
  const seen = new Set<string>();
  const push = (pin: SearchPlacePin) => {
    if (!Number.isFinite(pin.lat) || !Number.isFinite(pin.lng)) return;
    const key = `${pin.lat.toFixed(5)},${pin.lng.toFixed(5)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(pin);
  };
  for (const pin of cfg.pois) push(pin);
  for (const pin of location.neighborhoods) push({ name: pin.name, lat: pin.lat, lng: pin.lng });
  return out;
}

function combinedScore(locationScore: number, priceScore: number | null): number {
  if (priceScore == null) return locationScore;
  return LOCATION_WEIGHT * locationScore + PRICE_WEIGHT * priceScore;
}

export function resolvePlacePins(
  names: string[],
  prefer: "neighborhood" | "poi" = "poi",
  cityCode?: string,
): SearchPlacePin[] {
  const out: SearchPlacePin[] = [];
  const seen = new Set<string>();
  const pushPin = (pin: SearchPlacePin) => {
    const key = normalizePlaceKey(pin.name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(pin);
  };

  for (const raw of names) {
    const cleaned = cleanedPlaceKey(raw);
    if (!cleaned) continue;

    const fromCurated = (): SearchPlacePin | null => {
      const pin = resolveCuratedNeighborhoodPin(cleaned);
      return pin ? { name: pin.name, lat: pin.lat, lng: pin.lng } : null;
    };
    const fromPoi = (): SearchPlacePin[] => {
      if (cityCode && cityCode !== "gdl") return [];
      return matchGdlSearchPois(raw).map((p) => ({ name: p.name, lat: p.lat, lng: p.lng }));
    };

    if (prefer === "neighborhood") {
      const hood = fromCurated();
      if (hood) {
        pushPin(hood);
        continue;
      }
      for (const pin of fromPoi()) pushPin(pin);
      continue;
    }

    const pois = fromPoi();
    if (pois.length) {
      for (const pin of pois) pushPin(pin);
      continue;
    }
    const hood = fromCurated();
    if (hood) pushPin(hood);
  }
  return out;
}

function exactLocationOk(
  listing: PropertyListing,
  location: SavedSearchLocationSnapshot,
  cfg: SharedSearchSimilarConfig,
): boolean {
  const pins = zonePinsForSearch(location, cfg);
  const hasNeighborhoods = location.neighborhoods.length > 0;
  if (pins.length || hasNeighborhoods) {
    const pinHit = pins.length > 0 && (minDistanceKmToPins(listing, pins) ?? Infinity) <= EXACT_POI_RADIUS_KM;
    const neighborhoodHit = hasNeighborhoods && listingMatchesNeighborhoods(listing, location.neighborhoods);
    return pinHit || neighborhoodHit;
  }
  // Named landmark with no pin must not become every room in the metro.
  if (cfg.unresolvedPlace) return false;
  if (cfg.bbox) return pointInBbox(listing.lat, listing.lng, cfg.bbox);
  return true;
}

export function matchExactSharedSearch(
  listings: PropertyListing[],
  filters: SearchFilters,
  location: SavedSearchLocationSnapshot,
  cfg: SharedSearchSimilarConfig,
): PropertyListing[] {
  const filtered = filterListings(listings, { ...filters, bbox: null });
  return filtered.filter(
    (l) =>
      !listingHitsExcludedTag(l, cfg) &&
      cfg.requiredTags.every((tag) => l.tags.includes(tag)) &&
      exactLocationOk(l, location, cfg),
  );
}

function rankSimilarAtRadius(
  candidates: PropertyListing[],
  filters: SearchFilters,
  cfg: SharedSearchSimilarConfig,
  radiusKm: number,
): RankedListing[] {
  const ranked: RankedListing[] = [];
  for (const listing of candidates) {
    if (!passesHardSimilar(listing, cfg)) continue;
    const loc = locationScoreFor(listing, cfg, radiusKm);
    const price = priceScoreFor(listing, filters, cfg.priceBandPct);
    const score = combinedScore(loc, price);
    ranked.push({ listing, score, locationScore: loc, priceScore: price ?? loc });
  }
  ranked.sort((a, b) => b.score - a.score || b.locationScore - a.locationScore);
  return ranked;
}

/**
 * Nearby posts that are not exact: same 3.5 km disk, then at most 7 km.
 * Must keep the seeker's stay, lodging, and gender — a 1-month private room
 * cannot list a 12-month or shared room as "cerca".
 */
export function matchSimilarSharedSearch(
  listings: PropertyListing[],
  filters: SearchFilters,
  cfg: SharedSearchSimilarConfig,
  exactIds: Set<string>,
): RankedListing[] {
  const pool = listings.filter((l) => !exactIds.has(l.id) && l.roomOccupancyStatus !== "occupied");
  const hardFilters: SearchFilters = {
    ...EMPTY_SEARCH_FILTERS,
    pref: filters.pref,
    lodgingType: filters.lodgingType ?? cfg.lodgingType,
    minimalStayMonths: filters.minimalStayMonths,
    wantHouse: filters.wantHouse,
    wantApartment: filters.wantApartment,
    wantLoft: filters.wantLoft,
  };
  const hard = filterListings(pool, hardFilters).filter((l) => passesHardSimilar(l, cfg));

  const nearby = (rows: RankedListing[]) => rows.filter((r) => r.locationScore > 0 && r.score > 0);
  const atRadius = nearby(rankSimilarAtRadius(hard, filters, cfg, cfg.radiusKm));
  if (atRadius.length >= 1) return atRadius.slice(0, SIMILAR_CAP);

  return nearby(rankSimilarAtRadius(hard, filters, cfg, EXPANDED_RADIUS_KM)).slice(0, SIMILAR_CAP);
}

export function splitSharedSearchMatches(
  listings: PropertyListing[],
  filters: SearchFilters,
  location: SavedSearchLocationSnapshot,
  cfg: SharedSearchSimilarConfig,
): { exact: PropertyListing[]; similar: RankedListing[] } {
  const pins = zonePinsForSearch(location, cfg);
  const zoned = pins.length ? { ...cfg, pois: pins, bbox: null } : cfg;
  const exact = matchExactSharedSearch(listings, filters, location, zoned);
  const similar = matchSimilarSharedSearch(
    listings,
    filters,
    zoned,
    new Set(exact.map((l) => l.id)),
  );
  return { exact, similar };
}

export function highAffinitySimilar(similar: RankedListing[], min = HIGH_AFFINITY_MIN): RankedListing[] {
  return similar.filter((r) => r.score >= min);
}

/**
 * Shares extracted before a landmark was in the POI list can have a place in the
 * label ("GDL · Glorieta del Charro") and an empty pin set. Without pins, exact
 * matching treats the whole city as "en zona". Recover a known pin so the public
 * link actually filters.
 */
export function recoverPinsFromPlacePhrases(
  location: SavedSearchLocationSnapshot,
  similar: SharedSearchSimilarConfig,
  phrases: string[],
  cityCode?: string,
): { location: SavedSearchLocationSnapshot; similar: SharedSearchSimilarConfig; recovered: boolean } {
  if (similar.pois.length > 0 || location.neighborhoods.length > 0) {
    return applyCoupleOccupancy(location, similar, phrases, false);
  }
  const pins = resolvePlacePins(phrases, "poi", cityCode ?? location.cityCode);
  if (!pins.length) {
    const named = phrases.map((p) => specificPlacePhrase(p)).find(Boolean);
    if (!named) return applyCoupleOccupancy(location, similar, phrases, false);
    return applyCoupleOccupancy(location, { ...similar, unresolvedPlace: true }, phrases, false);
  }
  const pin = pins[0]!;
  const metro = resolveMetroCity(cityCode ?? location.cityCode);
  return applyCoupleOccupancy(
    {
      ...location,
      lat: pin.lat,
      lng: pin.lng,
      zoom: metro.neighborhoodZoom,
    },
    { ...similar, pois: pins, bbox: null },
    phrases,
    true,
  );
}

function applyCoupleOccupancy(
  location: SavedSearchLocationSnapshot,
  similar: SharedSearchSimilarConfig,
  phrases: string[],
  recovered: boolean,
): { location: SavedSearchLocationSnapshot; similar: SharedSearchSimilarConfig; recovered: boolean } {
  if (!coupleOccupancyRequested(phrases)) return { location, similar, recovered };
  const excluded = similar.excludedTags ?? [];
  if (excluded.includes("individuos-solo")) return { location, similar, recovered };
  return {
    location,
    recovered: true,
    similar: { ...similar, excludedTags: [...excluded, "individuos-solo"] },
  };
}

export function parseSimilarConfig(raw: string): SharedSearchSimilarConfig {
  try {
    const v = JSON.parse(raw) as Partial<SharedSearchSimilarConfig> | null;
    if (!v || typeof v !== "object") return defaultSimilarConfig();
    const pois = Array.isArray(v.pois)
      ? v.pois.filter(
          (p): p is SearchPlacePin =>
            p != null &&
            typeof p === "object" &&
            typeof p.name === "string" &&
            typeof p.lat === "number" &&
            typeof p.lng === "number",
        )
      : [];
    const seekerGender = v.seekerGender === "female" || v.seekerGender === "male" ? v.seekerGender : null;
    return defaultSimilarConfig({
      radiusKm: typeof v.radiusKm === "number" ? v.radiusKm : SIMILAR_RADIUS_KM,
      priceBandPct: typeof v.priceBandPct === "number" ? v.priceBandPct : PRICE_BAND,
      pois,
      bbox: v.bbox && typeof v.bbox === "object" ? v.bbox : null,
      requiredTags: Array.isArray(v.requiredTags) ? (v.requiredTags as ListingTag[]) : [],
      excludedTags: Array.isArray(v.excludedTags) ? (v.excludedTags as ListingTag[]) : [],
      lodgingType: v.lodgingType === "private_room" || v.lodgingType === "shared_room" ? v.lodgingType : null,
      seekerGender,
      highAffinityMin: typeof v.highAffinityMin === "number" ? v.highAffinityMin : HIGH_AFFINITY_MIN,
    });
  } catch {
    return defaultSimilarConfig();
  }
}

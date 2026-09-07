import { GDL_SEARCH_POIS, normalizePlaceKey } from "./gdlSearchPois.js";
import { curatedNeighborhoodPins } from "./locationSearch.js";
import { filterListings, type Bbox, type SearchFilters } from "./searchFilters.js";
import type { ListingTag, LodgingType, PropertyListing } from "./types.js";
import type { SavedSearchLocationSnapshot } from "./savedSearchMatch.js";

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
  lodgingType: LodgingType | null;
  seekerGender: "female" | "male" | null;
  highAffinityMin: number;
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

function normalizeNeighborhood(value: string): string {
  return normalizePlaceKey(value)
    .replace(/\b(colonia|col|barrio|zona)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function listingMatchesNeighborhoods(
  listing: PropertyListing,
  neighborhoods: SavedSearchLocationSnapshot["neighborhoods"],
): boolean {
  if (!neighborhoods.length) return true;
  return neighborhoods.some((n) =>
    [listing.neighborhood, listing.city].some(
      (c) => normalizeNeighborhood(c) === normalizeNeighborhood(n.name),
    ),
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
  if (dist == null) return 0.45;
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

function passesHardSimilar(
  listing: PropertyListing,
  cfg: SharedSearchSimilarConfig,
): boolean {
  if (!passesGenderNonNegotiable(listing, cfg.seekerGender)) return false;
  if (cfg.lodgingType && listing.lodgingType && listing.lodgingType !== cfg.lodgingType) return false;
  for (const tag of cfg.requiredTags) {
    if (!listing.tags.includes(tag)) return false;
  }
  return listing.roomOccupancyStatus !== "occupied";
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
  const curated = curatedNeighborhoodPins();

  for (const raw of names) {
    const key = normalizePlaceKey(raw);
    if (!key || seen.has(key)) continue;

    const fromCurated = (): SearchPlacePin | null => {
      const pin = curated.find((n) => normalizePlaceKey(n.neighborhood) === key);
      return pin ? { name: pin.neighborhood, lat: pin.lat, lng: pin.lng } : null;
    };
    const fromPoi = (): SearchPlacePin | null => {
      if (cityCode && cityCode !== "gdl") return null;
      const poi = GDL_SEARCH_POIS.find(
        (p) => normalizePlaceKey(p.name) === key || p.aliases.some((a) => normalizePlaceKey(a) === key),
      );
      if (poi) return { name: poi.name, lat: poi.lat, lng: poi.lng };
      const fuzzy = GDL_SEARCH_POIS.find(
        (p) =>
          key.includes(normalizePlaceKey(p.name)) ||
          p.aliases.some((a) => key.includes(normalizePlaceKey(a)) && normalizePlaceKey(a).length >= 4),
      );
      return fuzzy ? { name: fuzzy.name, lat: fuzzy.lat, lng: fuzzy.lng } : null;
    };

    const hit = prefer === "neighborhood" ? fromCurated() ?? fromPoi() : fromPoi() ?? fromCurated();
    if (hit) {
      seen.add(key);
      out.push(hit);
    }
  }
  return out;
}

function exactLocationOk(
  listing: PropertyListing,
  location: SavedSearchLocationSnapshot,
  cfg: SharedSearchSimilarConfig,
): boolean {
  const hasPois = cfg.pois.length > 0;
  const hasNeighborhoods = location.neighborhoods.length > 0;
  if (hasPois || hasNeighborhoods) {
    const poiHit =
      hasPois && (minDistanceKmToPins(listing, cfg.pois) ?? Infinity) <= EXACT_POI_RADIUS_KM;
    const neighborhoodHit = hasNeighborhoods && listingMatchesNeighborhoods(listing, location.neighborhoods);
    return poiHit || neighborhoodHit;
  }
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
  return filtered.filter((l) => exactLocationOk(l, location, cfg));
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
 * Never city-wide filler and never drop gender / lodging / required-tag excludes.
 */
export function matchSimilarSharedSearch(
  listings: PropertyListing[],
  filters: SearchFilters,
  cfg: SharedSearchSimilarConfig,
  exactIds: Set<string>,
): RankedListing[] {
  const pool = listings.filter((l) => !exactIds.has(l.id) && l.roomOccupancyStatus !== "occupied");
  const hard = pool.filter((l) => passesHardSimilar(l, cfg));

  const atRadius = rankSimilarAtRadius(hard, filters, cfg, cfg.radiusKm).filter((r) => r.score > 0);
  if (atRadius.length >= 1) return atRadius.slice(0, SIMILAR_CAP);

  return rankSimilarAtRadius(hard, filters, cfg, EXPANDED_RADIUS_KM)
    .filter((r) => r.score > 0)
    .slice(0, SIMILAR_CAP);
}

export function splitSharedSearchMatches(
  listings: PropertyListing[],
  filters: SearchFilters,
  location: SavedSearchLocationSnapshot,
  cfg: SharedSearchSimilarConfig,
): { exact: PropertyListing[]; similar: RankedListing[] } {
  const exact = matchExactSharedSearch(listings, filters, location, cfg);
  const similar = matchSimilarSharedSearch(
    listings,
    filters,
    cfg,
    new Set(exact.map((l) => l.id)),
  );
  return { exact, similar };
}

export function highAffinitySimilar(similar: RankedListing[], min = HIGH_AFFINITY_MIN): RankedListing[] {
  return similar.filter((r) => r.score >= min);
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
      lodgingType: v.lodgingType === "private_room" || v.lodgingType === "shared_room" ? v.lodgingType : null,
      seekerGender,
      highAffinityMin: typeof v.highAffinityMin === "number" ? v.highAffinityMin : HIGH_AFFINITY_MIN,
    });
  } catch {
    return defaultSimilarConfig();
  }
}

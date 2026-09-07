import type { DatabaseSync } from "node:sqlite";
import { curatedNeighborhoodPins } from "./locationSearch.js";
import { fetchPublishedListings } from "./publishedListingsQuery.js";
import { filterListings, type Bbox, type SearchFilters } from "./searchFilters.js";
import {
  highAffinitySimilar,
  parseSimilarConfig,
  splitSharedSearchMatches,
} from "./sharedSearchMatch.js";
import type { PropertyListing } from "./types.js";

export type SavedSearchLocationSnapshot = {
  cityCode: string;
  cityLabel?: string;
  neighborhoods: { name: string; lat: number; lng: number }[];
  lat: number;
  lng: number;
  zoom: number;
};

function normalizeNeighborhood(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\b(colonia|col|barrio|zona)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pointInBbox(lat: number, lng: number, b: Bbox): boolean {
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
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

function listingSortTime(listing: PropertyListing): number {
  const raw = listing.createdAt ?? listing.updatedAt ?? "";
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

export function sortListingsNewestFirst(listings: PropertyListing[]): PropertyListing[] {
  return [...listings].sort((a, b) => listingSortTime(b) - listingSortTime(a));
}

export function matchSavedSearchListings(
  allPublished: PropertyListing[],
  filters: SearchFilters,
  location: SavedSearchLocationSnapshot,
): PropertyListing[] {
  const filtered = filterListings(allPublished, filters);
  const withLocation = filtered.filter((l) => listingMatchesNeighborhoods(l, location.neighborhoods));
  return sortListingsNewestFirst(withLocation);
}

export function fetchMatchingListingsForSavedSearch(
  db: DatabaseSync,
  filters: SearchFilters,
  location: SavedSearchLocationSnapshot,
): PropertyListing[] {
  return matchSavedSearchListings(fetchPublishedListings(db), filters, location);
}

/**
 * Alert + card matching. Shared/campaign searches store the zone in
 * `similar_json` (bbox/POI), not in empty `location.neighborhoods` — using
 * filters+neighborhoods alone would match every published room.
 */
export function resolveSavedSearchMatches(
  published: PropertyListing[],
  filters: SearchFilters,
  location: SavedSearchLocationSnapshot,
  similarJson?: string | null,
): { exact: PropertyListing[]; similarHigh: PropertyListing[]; similarCount: number } {
  if (similarJson) {
    const split = splitSharedSearchMatches(
      published,
      filters,
      location,
      parseSimilarConfig(similarJson),
    );
    const exact = sortListingsNewestFirst(split.exact);
    const exactIds = new Set(exact.map((l) => l.id));
    const similarHigh = highAffinitySimilar(split.similar)
      .map((r) => r.listing)
      .filter((l) => !exactIds.has(l.id));
    return { exact, similarHigh, similarCount: split.similar.length };
  }
  return {
    exact: matchSavedSearchListings(published, filters, location),
    similarHigh: [],
    similarCount: 0,
  };
}

/**
 * Neighborhood / POI names for a Mis Búsquedas card location line.
 * Prefers stored colonia pins; campaign shares keep the pin in similar_json;
 * map-area saves resolve names inside the bbox (never a generic "Área del mapa").
 */
export function areaNamesForSavedSearchCard(
  filters: SearchFilters,
  location: SavedSearchLocationSnapshot,
  published: PropertyListing[] = [],
  similarJson?: string | null,
): string[] {
  const stored = location.neighborhoods
    .map((n) => n.name.trim())
    .filter((name) => name.length > 0);
  if (stored.length) return stored;

  const similar = similarJson ? parseSimilarConfig(similarJson) : null;
  const poiNames = similar?.pois.map((p) => p.name.trim()).filter((name) => name.length > 0) ?? [];
  if (poiNames.length) {
    const names = new Map<string, string>();
    for (const name of poiNames) {
      const key = normalizeNeighborhood(name);
      if (!key || names.has(key)) continue;
      names.set(key, name);
    }
    return Array.from(names.values());
  }

  const bbox = filters.bbox ?? similar?.bbox ?? null;
  if (!bbox) return [];

  const names = new Map<string, string>();
  const add = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const key = normalizeNeighborhood(trimmed);
    if (!key || names.has(key)) return;
    names.set(key, trimmed);
  };

  for (const pin of curatedNeighborhoodPins()) {
    if (pointInBbox(pin.lat, pin.lng, bbox)) add(pin.neighborhood);
  }

  for (const listing of published) {
    if (pointInBbox(listing.lat, listing.lng, bbox)) add(listing.neighborhood);
  }

  return Array.from(names.values()).sort((a, b) => a.localeCompare(b, "es"));
}

export function neighborhoodsForSavedSearchCard(
  db: DatabaseSync,
  filters: SearchFilters,
  location: SavedSearchLocationSnapshot,
  published?: PropertyListing[],
  similarJson?: string | null,
): string[] {
  return areaNamesForSavedSearchCard(
    filters,
    location,
    published ?? fetchPublishedListings(db),
    similarJson,
  );
}

export function parseSavedSearchFilters(raw: string): SearchFilters {
  const parsed = JSON.parse(raw) as Partial<SearchFilters> | null;
  const value = parsed && typeof parsed === "object" ? parsed : {};

  // Saved searches outlive the filter schema. Normalize fields added after older
  // records were stored so matching an alert can never crash the API process.
  return {
    q: typeof value.q === "string" ? value.q : "",
    budgetMin: value.budgetMin ?? null,
    budgetMax: value.budgetMax ?? null,
    tags: Array.isArray(value.tags) ? value.tags : [],
    pref: value.pref ?? null,
    age: value.age ?? null,
    ageMin: value.ageMin ?? null,
    ageMax: value.ageMax ?? null,
    bbox: value.bbox ?? null,
    lodgingType: value.lodgingType ?? null,
    wantHouse: value.wantHouse === true,
    wantApartment: value.wantApartment === true,
    wantLoft: value.wantLoft === true,
    availableFrom: value.availableFrom ?? null,
    minimalStayMonths: value.minimalStayMonths ?? null,
    roomDimensions: Array.isArray(value.roomDimensions) ? value.roomDimensions : [],
    avalRequired: value.avalRequired ?? null,
    subletAllowed: value.subletAllowed ?? null,
  };
}

export function parseSavedSearchLocation(raw: string): SavedSearchLocationSnapshot {
  return JSON.parse(raw) as SavedSearchLocationSnapshot;
}

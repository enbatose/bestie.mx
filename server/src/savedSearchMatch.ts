import type { DatabaseSync } from "node:sqlite";
import { fetchPublishedListings } from "./publishedListingsQuery.js";
import { filterListings, type SearchFilters } from "./searchFilters.js";
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

export function parseSavedSearchFilters(raw: string): SearchFilters {
  return JSON.parse(raw) as SearchFilters;
}

export function parseSavedSearchLocation(raw: string): SavedSearchLocationSnapshot {
  return JSON.parse(raw) as SavedSearchLocationSnapshot;
}

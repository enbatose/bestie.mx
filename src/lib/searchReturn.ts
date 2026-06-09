import { listingMapPosition } from "@/map/listingMapPosition";
import type { PropertyListing } from "@/types/listing";

/** Snapshot of `/buscar` URL to restore filters and map when returning from a listing. */
export type SearchReturnContext = {
  pathname: string;
  search: string;
};

export function searchReturnFromLocation(pathname: string, search: string): SearchReturnContext {
  return { pathname, search };
}

export function readSearchReturn(state: unknown): SearchReturnContext | null {
  if (!state || typeof state !== "object") return null;
  const raw = (state as { searchReturn?: unknown }).searchReturn;
  if (!raw || typeof raw !== "object") return null;
  const { pathname, search } = raw as SearchReturnContext;
  if (typeof pathname !== "string" || !pathname.startsWith("/buscar")) return null;
  if (typeof search !== "string") return null;
  return { pathname, search };
}

export function listingNavigationState(searchReturn: SearchReturnContext) {
  return { searchReturn };
}

/** Restore search with filters, map center on listing, and pin/card selection. */
export function buildSearchRestorePath(
  searchReturn: SearchReturnContext,
  listing: Pick<PropertyListing, "id" | "lat" | "lng" | "isApproximateLocation">,
): string {
  const raw = searchReturn.search.startsWith("?") ? searchReturn.search.slice(1) : searchReturn.search;
  const params = new URLSearchParams(raw);
  const [lat, lng] = listingMapPosition(listing as PropertyListing);
  params.set("lat", String(lat));
  params.set("lng", String(lng));
  const z = Number(params.get("z"));
  params.set("z", String(Number.isFinite(z) ? Math.max(z, 12) : 12));
  params.set("sel", listing.id);
  const qs = params.toString();
  return qs ? `${searchReturn.pathname}?${qs}` : searchReturn.pathname;
}

export const SEARCH_SELECTED_PARAM = "sel";

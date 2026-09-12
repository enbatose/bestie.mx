import type { MetroCity } from "./metroCities.js";
import type { PropertyListing } from "./types.js";

function normalizeAreaName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * A listing belongs to a metro when its municipality is one of `metroAreas`
 * (Zapopan and Tlaquepaque count as ZMG, not only "Guadalajara"). Publishers
 * sometimes store a colonia in `city`, so fall back to the metro viewbox.
 */
export function listingInMetro(
  listing: Pick<PropertyListing, "city" | "lat" | "lng">,
  metro: MetroCity,
): boolean {
  const city = normalizeAreaName(listing.city ?? "");
  if (city && metro.metroAreas.some((area) => normalizeAreaName(area) === city)) return true;

  const { left, top, right, bottom } = metro.viewbox;
  return (
    Number.isFinite(listing.lat) &&
    Number.isFinite(listing.lng) &&
    listing.lat >= bottom &&
    listing.lat <= top &&
    listing.lng >= left &&
    listing.lng <= right
  );
}

/**
 * Cards as search renders them: one per property for property-mode posts
 * (mirrors `collapseSearchListings` on the client), one per room otherwise.
 */
export function countSearchCards(
  listings: readonly Pick<PropertyListing, "propertyPostMode" | "propertyId">[],
): number {
  const seenProperties = new Set<string>();
  let count = 0;
  for (const listing of listings) {
    if (listing.propertyPostMode === "property" && listing.propertyId) {
      if (seenProperties.has(listing.propertyId)) continue;
      seenProperties.add(listing.propertyId);
    }
    count += 1;
  }
  return count;
}

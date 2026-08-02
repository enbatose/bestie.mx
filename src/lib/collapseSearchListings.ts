import type { PropertyListing } from "@/types/listing";

/**
 * Search/map show one row per published room from the API. Collapse
 * `propertyPostMode === "property"` siblings into a single card/pin with a
 * rent range; leave room-mode posts as one card per room.
 */
export function collapseSearchListings(listings: readonly PropertyListing[]): PropertyListing[] {
  const propertyGroups = new Map<string, PropertyListing[]>();
  const passthrough: PropertyListing[] = [];

  for (const listing of listings) {
    if (listing.propertyPostMode === "property" && listing.propertyId) {
      const group = propertyGroups.get(listing.propertyId);
      if (group) group.push(listing);
      else propertyGroups.set(listing.propertyId, [listing]);
      continue;
    }
    passthrough.push(listing);
  }

  const collapsed: PropertyListing[] = [];
  for (const group of propertyGroups.values()) {
    collapsed.push(collapsePropertyGroup(group));
  }

  // Preserve API order: first time each property (or room post) appears.
  const seenProperty = new Set<string>();
  const ordered: PropertyListing[] = [];
  for (const listing of listings) {
    if (listing.propertyPostMode === "property" && listing.propertyId) {
      if (seenProperty.has(listing.propertyId)) continue;
      seenProperty.add(listing.propertyId);
      const row = collapsed.find((c) => c.propertyId === listing.propertyId);
      if (row) ordered.push(row);
      continue;
    }
    ordered.push(listing);
  }
  return ordered;
}

function collapsePropertyGroup(group: PropertyListing[]): PropertyListing {
  const sorted = [...group].sort((a, b) => a.rentMxn - b.rentMxn);
  const head = sorted[0]!;
  const rents = sorted.map((l) => l.rentMxn).filter((r) => r > 0);
  const minRent = rents.length ? Math.min(...rents) : head.rentMxn;
  const maxRent = rents.length ? Math.max(...rents) : head.rentMxn;
  const title = head.propertyTitle?.trim() || head.title;

  // Union tags across available rooms so quick-attribute chips stay useful.
  const tagSet = new Set<string>();
  for (const room of sorted) {
    for (const tag of room.tags) tagSet.add(tag);
  }

  return {
    ...head,
    // Stable map/list selection key = property (one pin).
    id: head.propertyId,
    title,
    propertyTitle: title,
    rentMxn: minRent,
    rentMxnMax: maxRent > minRent ? maxRent : undefined,
    roomsAvailable: sorted.length,
    tags: [...tagSet] as PropertyListing["tags"],
    // Prefer property cover; drop room-only photos so the card thumb is the property.
    roomImageUrls: [],
    summary: head.summary,
  };
}

/** Format search-card rent: single price or min–max range. */
export function formatSearchListingRent(
  listing: Pick<PropertyListing, "rentMxn" | "rentMxnMax">,
  money: Intl.NumberFormat,
): string {
  const max = listing.rentMxnMax;
  if (max != null && max > listing.rentMxn) {
    return `${money.format(listing.rentMxn)} – ${money.format(max)}`;
  }
  return money.format(listing.rentMxn);
}

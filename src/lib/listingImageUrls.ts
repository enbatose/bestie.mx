const LISTING_IMAGE_URL_LEN_MAX = 240;

/** Keep only persisted upload paths the API accepts (`/api/uploads/...`). */
export function normalizeListingImageUrlForApi(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;

  if (t.startsWith("/api/uploads/") && !t.includes("..") && !t.includes("\\")) {
    return t.length <= LISTING_IMAGE_URL_LEN_MAX ? t : null;
  }

  if (t.startsWith("http://") || t.startsWith("https://")) {
    try {
      const path = new URL(t).pathname;
      if (path.startsWith("/api/uploads/") && !path.includes("..") && !path.includes("\\")) {
        return path.length <= LISTING_IMAGE_URL_LEN_MAX ? path : null;
      }
    } catch {
      return null;
    }
  }

  return null;
}

export function listingImageUrlsForApi(input: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of input) {
    const path = normalizeListingImageUrlForApi(raw);
    if (!path || out.includes(path)) continue;
    out.push(path);
    if (out.length >= 12) break;
  }
  return out;
}

/** Public gallery URLs; room posts mirror room photos on the property row for API sync. */
export function listingGalleryImageUrls(opts: {
  postMode?: "room" | "property" | null;
  propertyImageUrls?: readonly string[];
  roomImageUrls?: readonly string[];
}): string[] {
  const property = opts.propertyImageUrls ?? [];
  const room = opts.roomImageUrls ?? [];
  if (opts.postMode === "room") {
    return listingImageUrlsForApi(room.length > 0 ? room : property);
  }
  return listingImageUrlsForApi([...property, ...room]);
}

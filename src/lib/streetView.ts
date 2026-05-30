/** External Street View tab (no Maps JavaScript API). */
export function streetViewExternalUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
}

/**
 * Embeddable Street View iframe URL.
 * Uses Maps Embed API when `VITE_GOOGLE_MAPS_EMBED_KEY` is set; otherwise a legacy svembed URL.
 */
export function streetViewEmbedUrl(lat: number, lng: number): string {
  const key = import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY?.trim();
  if (key) {
    const params = new URLSearchParams({
      key,
      location: `${lat},${lng}`,
      heading: "210",
      pitch: "0",
      fov: "80",
    });
    return `https://www.google.com/maps/embed/v1/streetview?${params.toString()}`;
  }
  const params = new URLSearchParams({
    q: "",
    layer: "c",
    cbll: `${lat},${lng}`,
    cbp: "11,0,0,0,0",
    output: "svembed",
  });
  return `https://maps.google.com/maps?${params.toString()}`;
}

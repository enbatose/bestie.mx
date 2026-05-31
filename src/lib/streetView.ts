import type { StreetViewPov } from "@/types/listing";

/** Maps Embed API accepts fov between 10° and 100° (Street View JS zoom 0 maps to 180°). */
const EMBED_FOV_MIN = 10;
const EMBED_FOV_MAX = 100;

/** Convert Street View zoom (0–4) to embed API field-of-view degrees. */
export function streetViewFovFromZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 90;
  const z = Math.max(0, Math.min(4, zoom));
  const fov = 180 / 2 ** z;
  return Math.max(EMBED_FOV_MIN, Math.min(EMBED_FOV_MAX, fov));
}

/** External Street View tab (no Maps JavaScript API). */
export function streetViewExternalUrl(lat: number, lng: number, pov?: StreetViewPov | null): string {
  const params = new URLSearchParams({
    api: "1",
    map_action: "pano",
    viewpoint: `${lat},${lng}`,
  });
  if (pov) {
    params.set("heading", String(Math.round(pov.heading)));
    params.set("pitch", String(Math.round(pov.pitch)));
    params.set("fov", String(Math.round(streetViewFovFromZoom(pov.zoom))));
  }
  return `https://www.google.com/maps/@?${params.toString()}`;
}

/**
 * Embeddable Street View iframe URL.
 * Uses Maps Embed API when `VITE_GOOGLE_MAPS_EMBED_KEY` is set; otherwise a legacy svembed URL.
 */
export function streetViewEmbedUrl(lat: number, lng: number, pov?: StreetViewPov | null): string {
  const heading = pov ? String(Math.round(pov.heading)) : "210";
  const pitch = pov ? String(Math.round(pov.pitch)) : "0";
  const fov = pov ? String(Math.round(streetViewFovFromZoom(pov.zoom))) : "80";

  const key = import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY?.trim();
  if (key) {
    const params = new URLSearchParams({
      key,
      location: `${lat},${lng}`,
      heading,
      pitch,
      fov,
    });
    return `https://www.google.com/maps/embed/v1/streetview?${params.toString()}`;
  }

  const params = new URLSearchParams({
    q: "",
    layer: "c",
    cbll: `${lat},${lng}`,
    cbp: `11,${heading},${pitch},${fov},0`,
    output: "svembed",
  });
  return `https://maps.google.com/maps?${params.toString()}`;
}

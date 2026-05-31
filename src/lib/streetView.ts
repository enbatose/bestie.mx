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

export function streetViewEmbedFov(pov?: StreetViewPov | null): number {
  if (pov?.fov != null && Number.isFinite(pov.fov)) {
    return Math.max(EMBED_FOV_MIN, Math.min(EMBED_FOV_MAX, pov.fov));
  }
  if (pov) return streetViewFovFromZoom(pov.zoom);
  return 80;
}

export function streetViewPovCacheKey(pov?: StreetViewPov | null): string {
  if (!pov) return "";
  return [
    pov.pano ?? "",
    pov.panoLat ?? "",
    pov.panoLng ?? "",
    pov.heading,
    pov.pitch,
    pov.zoom,
    pov.fov ?? "",
  ].join(",");
}

function streetViewCameraParams(pov?: StreetViewPov | null): {
  heading: string;
  pitch: string;
  fov: string;
} {
  return {
    heading: pov ? String(Math.round(pov.heading)) : "210",
    pitch: pov ? String(Math.round(pov.pitch)) : "0",
    fov: String(Math.round(streetViewEmbedFov(pov))),
  };
}

function streetViewSceneParams(
  lat: number,
  lng: number,
  pov?: StreetViewPov | null,
): URLSearchParams {
  const params = new URLSearchParams();
  const pano = pov?.pano?.trim();
  if (pano) {
    params.set("pano", pano);
  } else {
    const sceneLat = pov?.panoLat ?? lat;
    const sceneLng = pov?.panoLng ?? lng;
    params.set("location", `${sceneLat},${sceneLng}`);
  }
  return params;
}

/** External Street View tab (no Maps JavaScript API). */
export function streetViewExternalUrl(lat: number, lng: number, pov?: StreetViewPov | null): string {
  const params = new URLSearchParams({
    api: "1",
    map_action: "pano",
  });
  const pano = pov?.pano?.trim();
  if (pano) {
    params.set("pano", pano);
  } else {
    const sceneLat = pov?.panoLat ?? lat;
    const sceneLng = pov?.panoLng ?? lng;
    params.set("viewpoint", `${sceneLat},${sceneLng}`);
  }
  if (pov) {
    params.set("heading", String(Math.round(pov.heading)));
    params.set("pitch", String(Math.round(pov.pitch)));
    params.set("fov", String(Math.round(streetViewEmbedFov(pov))));
  }
  return `https://www.google.com/maps/@?${params.toString()}`;
}

/**
 * Embeddable Street View iframe URL.
 * Uses Maps Embed API when `VITE_GOOGLE_MAPS_EMBED_KEY` is set; otherwise a legacy svembed URL.
 */
export function streetViewEmbedUrl(lat: number, lng: number, pov?: StreetViewPov | null): string {
  const { heading, pitch, fov } = streetViewCameraParams(pov);
  const key = import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY?.trim();
  if (key) {
    const params = streetViewSceneParams(lat, lng, pov);
    params.set("key", key);
    params.set("heading", heading);
    params.set("pitch", pitch);
    params.set("fov", fov);
    return `https://www.google.com/maps/embed/v1/streetview?${params.toString()}`;
  }

  const sceneLat = pov?.panoLat ?? lat;
  const sceneLng = pov?.panoLng ?? lng;
  const params = new URLSearchParams({
    q: "",
    layer: "c",
    cbll: `${sceneLat},${sceneLng}`,
    cbp: `11,${heading},${pitch},${fov},0`,
    output: "svembed",
  });
  return `https://maps.google.com/maps?${params.toString()}`;
}

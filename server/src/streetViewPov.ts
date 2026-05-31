import type { StreetViewPov } from "./types.js";
import { validLatLng } from "./validation.js";

const PANO_ID_MAX_LEN = 120;

export function parseStreetViewPovJson(raw: unknown): StreetViewPov | undefined {
  if (raw == null) return undefined;
  try {
    const o = typeof raw === "string" ? JSON.parse(raw.trim() || "null") : raw;
    if (!o || typeof o !== "object") return undefined;
    const heading = Number((o as StreetViewPov).heading);
    const pitch = Number((o as StreetViewPov).pitch);
    const zoom = Number((o as StreetViewPov).zoom);
    if (!Number.isFinite(heading) || !Number.isFinite(pitch) || !Number.isFinite(zoom)) {
      return undefined;
    }
    const pov: StreetViewPov = {
      heading: ((heading % 360) + 360) % 360,
      pitch: Math.max(-90, Math.min(90, pitch)),
      zoom: Math.max(0, Math.min(4, zoom)),
    };
    const panoRaw = (o as StreetViewPov).pano;
    if (typeof panoRaw === "string") {
      const pano = panoRaw.trim().slice(0, PANO_ID_MAX_LEN);
      if (pano) pov.pano = pano;
    }
    const panoLat = Number((o as StreetViewPov).panoLat);
    const panoLng = Number((o as StreetViewPov).panoLng);
    if (validLatLng(panoLat, panoLng)) {
      pov.panoLat = panoLat;
      pov.panoLng = panoLng;
    }
    const fov = Number((o as StreetViewPov).fov);
    if (Number.isFinite(fov)) {
      pov.fov = Math.max(10, Math.min(100, fov));
    }
    return pov;
  } catch {
    return undefined;
  }
}

export function streetViewPovFromBody(body: unknown): StreetViewPov | null | undefined {
  if (body === undefined) return undefined;
  if (body === null) return null;
  const parsed = parseStreetViewPovJson(body);
  if (!parsed) throw new Error("bad_pov");
  return parsed;
}

export function serializeStreetViewPovJson(pov: StreetViewPov | null | undefined): string | null {
  if (pov == null) return null;
  return JSON.stringify(pov);
}

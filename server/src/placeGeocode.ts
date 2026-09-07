import { specificPlacePhrase } from "./gdlSearchPois.js";
import { resolveMetroCity } from "./metroCities.js";

export type GeocodedPlacePin = { name: string; lat: number; lng: number };

const cache = new Map<string, GeocodedPlacePin | null>();

function inViewbox(lat: number, lng: number, box: { left: number; top: number; right: number; bottom: number }): boolean {
  return lng >= box.left && lng <= box.right && lat <= box.top && lat >= box.bottom;
}

/**
 * Last resort when the curated landmark list misses a named place.
 * Bounded to the metro so a miss cannot pin another city or the country.
 */
export async function geocodeNamedPlaceInMetro(
  place: string,
  cityCode: string,
): Promise<GeocodedPlacePin | null> {
  const phrase = specificPlacePhrase(place);
  if (!phrase || phrase.length < 4) return null;
  const metro = resolveMetroCity(cityCode);
  const key = `${metro.code}:${phrase}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${phrase}, ${metro.label}, Mexico`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "mx");
  url.searchParams.set("viewbox", `${metro.viewbox.left},${metro.viewbox.top},${metro.viewbox.right},${metro.viewbox.bottom}`);
  url.searchParams.set("bounded", "1");

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "bestie.mx-share-place/1.0 (contacto@bestie.mx)",
        "Accept-Language": "es-MX,es;q=0.9",
      },
    });
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const rows = (await res.json()) as Array<{ lat?: string; lon?: string; name?: string }>;
    const hit = rows[0];
    const lat = Number(hit?.lat);
    const lng = Number(hit?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inViewbox(lat, lng, metro.viewbox)) {
      cache.set(key, null);
      return null;
    }
    const pin = { name: (hit?.name || phrase).trim() || phrase, lat, lng };
    cache.set(key, pin);
    return pin;
  } catch {
    return null;
  }
}

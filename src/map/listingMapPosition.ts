import type { PropertyListing } from "@/types/listing";

/** Matches prior circle radius in `PropertyMap` — pin is jittered within this disk. */
export const APPROXIMATE_LISTING_MAP_RADIUS_M = 200;

function fnv1a32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Stable pseudo-random point uniformly distributed in a disk (meters) around (lat, lng).
 * Same `seed` always yields the same offset (no pin jumping on re-render).
 */
export function jitterLatLngInDiskMeters(
  lat: number,
  lng: number,
  seed: string,
  radiusMeters: number,
): [number, number] {
  const h1 = fnv1a32(seed);
  const h2 = fnv1a32(`${seed}:map-pin`);
  const u1 = (h1 >>> 8) / 0x1000000;
  const u2 = (h2 >>> 8) / 0x1000000;
  const r = radiusMeters * Math.sqrt(u1);
  const theta = 2 * Math.PI * u2;
  const eastM = r * Math.sin(theta);
  const northM = r * Math.cos(theta);
  const dLat = northM / 111_320;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const dLng = eastM / (111_320 * Math.max(cosLat, 1e-6));
  return [lat + dLat, lng + dLng];
}

/** Lat/lng used on search/detail maps: exact coords, or jittered for approximate listings. */
export function listingMapPosition(l: PropertyListing): [number, number] {
  if (!l.isApproximateLocation) return [l.lat, l.lng];
  return jitterLatLngInDiskMeters(l.lat, l.lng, l.id, APPROXIMATE_LISTING_MAP_RADIUS_M);
}

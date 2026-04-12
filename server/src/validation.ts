/** Shared input limits and guards for listing/property APIs. */

export const TITLE_MAX_LEN = 200;
export const SUMMARY_MAX_LEN = 8000;
export const CITY_MAX_LEN = 80;
export const NEIGHBORHOOD_MAX_LEN = 120;
export const ROOM_TITLE_MAX_LEN = 120;
export const RENT_MXN_MAX = 2_000_000;
export const ROOMS_AVAILABLE_MAX = 99;
export const PUBLIC_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
/** Includes migrated ids such as `prp__gdl-01`. */
export const PROPERTY_ID_PATTERN = /^prp__[a-zA-Z0-9_-]{4,128}$/;

export function isSafeRoomOrListingId(id: string): boolean {
  return PUBLIC_ID_PATTERN.test(id);
}

export function isSafePropertyId(id: string): boolean {
  return PROPERTY_ID_PATTERN.test(id);
}

export function clampStr(s: string, max: number): string {
  const t = typeof s === "string" ? s.trim() : "";
  if (t.length <= max) return t;
  return t.slice(0, max);
}

/** MX / international WhatsApp digits only; 10–15 digits after cleaning. */
export function normalizeWhatsAppDigits(s: string): string | null {
  const d = String(s).replace(/\D/g, "");
  if (d.length < 10 || d.length > 15) return null;
  return d;
}

export function validLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function clampRentMxn(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), RENT_MXN_MAX);
}

export function clampRoomsAvailable(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(ROOMS_AVAILABLE_MAX, Math.max(1, Math.floor(n)));
}

export function clampAge(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(99, Math.max(16, Math.floor(n)));
}

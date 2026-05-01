/** Shared input limits and guards for listing/property APIs. */

export const TITLE_MAX_LEN = 200;
export const SUMMARY_MAX_LEN = 8000;
export const CITY_MAX_LEN = 80;
export const NEIGHBORHOOD_MAX_LEN = 120;
export const ROOM_TITLE_MAX_LEN = 120;
export const RENT_MXN_MAX = 2_000_000;
export const DEPOSIT_MXN_MAX = 2_000_000;
export const ROOMS_AVAILABLE_MAX = 99;
/** Minimum property description length (“Descripción de propiedad”). */
export const PROPERTY_SUMMARY_MIN_LEN = 20;
export const PROPERTY_BEDROOMS_MAX = 35;
export const PROPERTY_BATHROOMS_MAX = 99;
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

/** Total bedrooms in the building. */
export function clampBedroomsTotal(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(PROPERTY_BEDROOMS_MAX, Math.max(1, Math.floor(n)));
}

/** Bathrooms count; allows half increments (0.5 steps). */
export function clampBathrooms(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  const rounded = Math.round(n * 2) / 2;
  return Math.min(PROPERTY_BATHROOMS_MAX, rounded);
}

export function clampDepositMxn(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), DEPOSIT_MXN_MAX);
}

export function minimalPropertySummaryOk(s: string): boolean {
  return typeof s === "string" && s.trim().length >= PROPERTY_SUMMARY_MIN_LEN;
}

/** Autosave drafts may use an all-zero placeholder until the user enters a real number. Publishing must reject it. */
export function isDraftPlaceholderWhatsApp(digits: string): boolean {
  if (typeof digits !== "string" || digits.length < 10) return false;
  return /^0+$/.test(digits);
}

const LISTING_IMAGE_URL_LEN_MAX = 240;
const LISTING_IMAGE_COUNT_MAX = 12;

/** Only allow same-origin upload paths written by our API. */
export function clampListingImageUrls(input: unknown, max = LISTING_IMAGE_COUNT_MAX): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const x of input) {
    if (typeof x !== "string" || x.length > LISTING_IMAGE_URL_LEN_MAX) continue;
    if (!x.startsWith("/api/uploads/")) continue;
    if (x.includes("..") || x.includes("\\")) continue;
    out.push(x);
    if (out.length >= max) break;
  }
  return out;
}

import { SMS_NOTIFY_MAX_CHARS } from "./listingFirstSeekerSms.js";

function clip(raw: string, max: number): string {
  const t = raw.replace(/\s+/g, " ").trim();
  const chars = Array.from(t);
  if (chars.length <= max) return t;
  if (max <= 1) return "…";
  return `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}

/**
 * SMS Masivos cap = 160. Prefer a short `/f/A…` deep link so the photo editor opens.
 */
export function buildAddPhotosSms(opts: { shortEditUrl: string }): string {
  const url = opts.shortEditUrl.trim();
  const prefix = "Bestie: Sube fotos a tu anuncio — te escriben más. ";
  const text = `${prefix}${url}`;
  if (Array.from(text).length <= SMS_NOTIFY_MAX_CHARS) return text;
  return clip(text, SMS_NOTIFY_MAX_CHARS);
}

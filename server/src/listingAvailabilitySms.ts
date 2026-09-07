import { listingTitleLeadForSms, SMS_NOTIFY_MAX_CHARS } from "./listingFirstSeekerSms.js";

function charLen(s: string): number {
  return Array.from(s).length;
}

function clipChars(raw: string, max: number): string {
  const t = raw.replace(/\s+/g, " ").trim();
  const chars = Array.from(t);
  if (chars.length <= max) return t;
  if (max <= 1) return "…";
  return `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}

/**
 * Day-25 availability SMS. SMS Masivos listing cap is 160 characters.
 * Two short vanity links, no https, so the publisher can confirm or pause from the text.
 */
export function buildListingAvailabilitySms(opts: {
  title: string;
  confirmUrl: string;
  pauseUrl: string;
}): string {
  const confirmUrl = opts.confirmUrl.trim();
  const pauseUrl = opts.pauseUrl.trim();
  const prefix = `Bestie: tu anuncio "`;
  const mid = `" cumple 30 días. Confirma: `;
  const pauseBit = ` Pausa: `;
  const fixed = charLen(prefix) + charLen(mid) + charLen(confirmUrl) + charLen(pauseBit) + charLen(pauseUrl);
  const budget = Math.max(0, SMS_NOTIFY_MAX_CHARS - fixed);
  const lead = listingTitleLeadForSms(opts.title, budget) || "tu post";
  const text = `${prefix}${lead}${mid}${confirmUrl}${pauseBit}${pauseUrl}`;
  if (charLen(text) <= SMS_NOTIFY_MAX_CHARS) return text;
  return clipChars(text, SMS_NOTIFY_MAX_CHARS);
}

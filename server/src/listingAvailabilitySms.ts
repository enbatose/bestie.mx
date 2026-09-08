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

export type ListingAvailabilitySmsInput = {
  title: string;
  /** People who asked for the listing phone since this cycle started. Not proof it is still free. */
  revealPeople: number;
  confirmUrl: string;
};

/**
 * Day-25 SMS. One tappable URL. "Ya se rentó" lives on that page.
 * Reveal count is only a reason to answer.
 */
export function buildListingAvailabilitySms(opts: ListingAvailabilitySmsInput): string {
  const url = opts.confirmUrl.trim();
  const n = Math.max(0, Math.floor(opts.revealPeople));
  if (n > 0) {
    const asked =
      n === 1
        ? "1 persona pidió tu número por \""
        : `${n} personas pidieron tu número por "`;
    const suffix = `". ¿Sigue libre? ${url}`;
    const budget = SMS_NOTIFY_MAX_CHARS - charLen(`Bestie: ${asked}`) - charLen(suffix);
    const lead = listingTitleLeadForSms(opts.title, Math.max(0, budget)) || "tu anuncio";
    const text = `Bestie: ${asked}${lead}${suffix}`;
    return charLen(text) <= SMS_NOTIFY_MAX_CHARS ? text : clipChars(text, SMS_NOTIFY_MAX_CHARS);
  }
  const prefix = `Bestie: "`;
  const suffix = `" se oculta en 5 días. ¿Sigue libre? ${url}`;
  const budget = SMS_NOTIFY_MAX_CHARS - charLen(prefix) - charLen(suffix);
  const lead = listingTitleLeadForSms(opts.title, Math.max(0, budget)) || "tu anuncio";
  const text = `${prefix}${lead}${suffix}`;
  return charLen(text) <= SMS_NOTIFY_MAX_CHARS ? text : clipChars(text, SMS_NOTIFY_MAX_CHARS);
}

/** One morning text when several claimed posts are due. Links to Mis Anuncios, not each post. */
export function buildListingAvailabilityDigestSms(opts: { count: number; hubUrl: string }): string {
  const n = Math.max(2, Math.floor(opts.count));
  const text = `Bestie: ${n} anuncios se ocultan en 5 días si no confirmas. ${opts.hubUrl.trim()}`;
  return charLen(text) <= SMS_NOTIFY_MAX_CHARS ? text : clipChars(text, SMS_NOTIFY_MAX_CHARS);
}

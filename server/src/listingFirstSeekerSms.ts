export type FirstSeekerSmsRow = {
  seekerName: string;
  listingTitle: string;
};

/** SMS Masivos rejects listing notify SMS over this many characters. */
export const SMS_NOTIFY_MAX_CHARS = 160;

const NAME_MAX = 24;
const TITLE_WORDS_MAX = 6;
/** Shown inside the quoted post lead when the title was cut. Space + three dots = 4 chars. */
export const TITLE_OMISSION_MARK = " ...";

const FOOTER = "Revisa tu correo regularmente (también spam) o entra en bestie.mx/mensajes";

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

/** First token of the display name (SMS budget). */
export function seekerFirstName(displayName: string): string {
  const t = displayName.replace(/\s+/g, " ").trim();
  if (!t) return "un usuario";
  const first = t.split(" ")[0] ?? "";
  return clipChars(first, NAME_MAX) || "un usuario";
}

function titleWords(title: string): string[] {
  return title.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
}

/** First 4–6 words of the title. If the full title does not fit, end with ` ...` (drop the last word if needed). */
export function listingTitleLeadForSms(title: string, budget: number): string {
  if (budget < 1) return "";
  const words = titleWords(title);
  if (words.length === 0) return "";
  const full = words.join(" ");
  if (charLen(full) <= budget) return full;

  const markLen = charLen(TITLE_OMISSION_MARK);
  const innerBudget = budget - markLen;
  if (innerBudget < 1) return clipChars(TITLE_OMISSION_MARK.trim(), budget);

  const maxWords = Math.min(TITLE_WORDS_MAX, words.length);
  for (let n = maxWords; n >= 1; n--) {
    const candidate = words.slice(0, n).join(" ");
    if (charLen(candidate) <= innerBudget) return `${candidate}${TITLE_OMISSION_MARK}`;
  }
  return `${clipChars(words[0]!, innerBudget)}${TITLE_OMISSION_MARK}`;
}

function fitSms(text: string): string {
  if (charLen(text) <= SMS_NOTIFY_MAX_CHARS) return text;
  return clipChars(text, SMS_NOTIFY_MAX_CHARS);
}

/**
 * Transactional SMS so publishers open the Bestie email (and trust the sender).
 * SMS Masivos cap: 160 characters. No chat body.
 */
export function buildListingFirstSeekerSms(rows: FirstSeekerSmsRow[]): string | null {
  const seekers = rows
    .map((r) => ({
      seekerName: seekerFirstName(r.seekerName),
      listingTitle: (r.listingTitle || "").trim(),
    }))
    .filter((r) => r.seekerName);
  if (seekers.length === 0) return null;

  const first = seekers[0]!;
  if (seekers.length === 1) {
    const prefix = `Bestie.mx: ${first.seekerName} te escribió por tu post "`;
    const suffix = `". ${FOOTER}`;
    const budget = SMS_NOTIFY_MAX_CHARS - charLen(prefix) - charLen(suffix);
    const lead = listingTitleLeadForSms(first.listingTitle, budget);
    if (!lead) return fitSms(`Bestie.mx: ${first.seekerName} te escribió. ${FOOTER}`);
    return fitSms(`${prefix}${lead}${suffix}`);
  }

  const others = seekers.length - 1;
  const othersPhrase = others === 1 ? "y otro usuario" : `y otros ${others} usuarios`;
  return fitSms(`Bestie.mx: ${first.seekerName} ${othersPhrase} te escribieron. ${FOOTER}`);
}

export function listingFirstSeekerSmsEnabled(): boolean {
  const raw = (process.env.LISTING_FIRST_SEEKER_SMS ?? "").trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  return true;
}

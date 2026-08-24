/** MX phone helpers — mirrors server `normalizeWhatsAppDigits` / E.164 rules. */

/** Mexico country calling code (default). */
export const MX_COUNTRY_CODE = "52";

/** National significant number length after IFT 2019 reform (mobile + landline). */
export const MX_NATIONAL_DIGITS = 10;

export function digitsOnly(s: string): string {
  return String(s ?? "").replace(/\D/g, "");
}

/**
 * Normalize to international digits without `+` (e.g. `523312345678`).
 * Accepts 10-digit MX national, `52`+10, or 10–15 digit intl forms.
 */
export function normalizeWhatsAppDigits(s: string): string | null {
  const d = digitsOnly(s);
  if (d.length < 10 || d.length > 15) return null;
  return d;
}

/** Prefer MX national 10 digits when input is clearly Mexican. */
export function normalizeMxNationalDigits(s: string): string | null {
  const d = digitsOnly(s);
  if (!d) return null;
  // Strip legacy mobile trunk prefixes sometimes pasted from old guides.
  let n = d;
  if (n.startsWith("521") && n.length === 13) n = n.slice(3);
  else if (n.startsWith("52") && n.length === 12) n = n.slice(2);
  else if (n.startsWith("045") && n.length === 13) n = n.slice(3);
  else if (n.startsWith("044") && n.length === 13) n = n.slice(3);
  else if (n.startsWith("01") && n.length === 12) n = n.slice(2);
  if (n.length === 10) return n;
  return null;
}

export function phoneE164FromDigits(d: string): string {
  if (d.startsWith("52") && d.length >= 12) return `+${d}`;
  if (d.length === 10) return `+52${d}`;
  return `+${d}`;
}

export function parsePhoneInputToE164(input: string): string | null {
  const national = normalizeMxNationalDigits(input);
  if (national) return phoneE164FromDigits(national);
  const d = normalizeWhatsAppDigits(input.trim());
  return d ? phoneE164FromDigits(d) : null;
}

/** Digits for listing storage / wa.me (no `+`), prefer `52` + 10 national. */
export function phoneDigitsForStorage(input: string): string | null {
  const national = normalizeMxNationalDigits(input);
  if (national) return `${MX_COUNTRY_CODE}${national}`;
  return normalizeWhatsAppDigits(input);
}

/**
 * First plausible MX cellphone in free text / OCR paste.
 * Prefers labeled lines (WhatsApp / cel / tel), else first 10-digit run.
 */
export function extractFirstMxPhoneFromText(text: string): string | null {
  const raw = String(text ?? "");
  if (!raw.trim()) return null;

  const labeled =
    /(?:whats?\s*app|wa\.me|cel(?:ular)?|m[oó]vil|tel(?:[eé]fono)?|llamar)\s*[:.\-]?\s*([+\d][\d\s().-]{8,20}\d)/gi;
  let m: RegExpExecArray | null;
  while ((m = labeled.exec(raw))) {
    const digits = phoneDigitsForStorage(m[1] ?? "");
    if (digits) return digits;
  }

  // Standalone 10-digit groups (common on MX infographics without +52).
  const ten = /\b(\d{2}[\s-]?\d{4}[\s-]?\d{4}|\d{3}[\s-]?\d{3}[\s-]?\d{4}|\d{10})\b/g;
  while ((m = ten.exec(raw))) {
    const digits = phoneDigitsForStorage(m[1] ?? "");
    if (digits) return digits;
  }

  // Longer intl forms with +52.
  const intl = /\+\s*52[\s-]?(\d[\d\s()-]{8,14}\d)/g;
  while ((m = intl.exec(raw))) {
    const digits = phoneDigitsForStorage(`52${m[1]}`);
    if (digits) return digits;
  }

  return null;
}

/** Display mask while digits stay server-side until reveal. */
export function maskedMxPhoneHint(): string {
  return "+52 ••• ••• ••••";
}

export function formatMxPhoneDisplay(digitsOrE164: string): string {
  const national = normalizeMxNationalDigits(digitsOrE164);
  if (!national) {
    const d = digitsOnly(digitsOrE164);
    return d ? `+${d}` : "";
  }
  // 33 1234 5678 style (2+4+4) — works for major LADAs; still readable for 3-digit LADAs.
  return `+52 ${national.slice(0, 2)} ${national.slice(2, 6)} ${national.slice(6)}`;
}

/** MX phone helpers — mirrors server `normalizeWhatsAppDigits` / E.164 rules. */

import { listingDialsLongestFirst, nationalLenForDial } from "@/lib/listingCallingCodes";

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
  // Country code leaked into a 10-digit field (LADA 52 does not exist).
  if (n.length === 10 && n.startsWith(MX_COUNTRY_CODE)) return null;
  if (n.length === 10) return n;
  return null;
}

export function phoneE164FromDigits(d: string): string {
  const mx = normalizeMxNationalDigits(d);
  if (mx) return `+52${mx}`;
  if (d.startsWith("52") && d.length >= 12) return `+${d}`;
  if (d.length === 10) return d.startsWith("52") ? `+${d}` : `+52${d}`;
  return `+${d}`;
}

export function parseListingPhoneParts(value: string): {
  dial: string;
  national: string;
  nationalLen: number;
} {
  const d = digitsOnly(value);
  const mxLen = MX_NATIONAL_DIGITS;

  if (d.startsWith("521") && d.length === 13) {
    return { dial: MX_COUNTRY_CODE, national: d.slice(3), nationalLen: mxLen };
  }

  if (d.startsWith("52") && d.length === 12) {
    const rest = d.slice(2);
    if (rest.startsWith(MX_COUNTRY_CODE)) {
      return { dial: MX_COUNTRY_CODE, national: rest.slice(2).slice(0, mxLen), nationalLen: mxLen };
    }
    return { dial: MX_COUNTRY_CODE, national: rest, nationalLen: mxLen };
  }

  if (d.length === 10) {
    if (d.startsWith(MX_COUNTRY_CODE)) {
      return { dial: MX_COUNTRY_CODE, national: d.slice(2), nationalLen: mxLen };
    }
    return { dial: MX_COUNTRY_CODE, national: d, nationalLen: mxLen };
  }

  if (d.length < 10) {
    if (d.startsWith("52") && d.length > 2) {
      return { dial: MX_COUNTRY_CODE, national: d.slice(2), nationalLen: mxLen };
    }
    return { dial: MX_COUNTRY_CODE, national: d, nationalLen: mxLen };
  }

  const prefixMatch = matchListingDialPrefix(d);
  if (prefixMatch) return prefixMatch;

  return { dial: MX_COUNTRY_CODE, national: d.slice(0, mxLen), nationalLen: mxLen };
}

function matchListingDialPrefix(d: string): { dial: string; national: string; nationalLen: number } | null {
  if (!d) return null;
  for (const dial of listingDialsLongestFirst()) {
    if (!d.startsWith(dial) || d.length <= dial.length) continue;
    const nationalLen = nationalLenForDial(dial);
    const national = d.slice(dial.length).slice(0, nationalLen);
    if (!national) continue;
    return { dial, national, nationalLen };
  }
  return null;
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

/** Listing contact (may be non-MX). Does not treat a leaked `52` as LADA. */
export function formatListingPhoneDisplay(digitsOrE164: string): string {
  const mx = normalizeMxNationalDigits(digitsOrE164);
  if (mx) return formatMxPhoneDisplay(mx);
  const p = parseListingPhoneParts(digitsOrE164);
  if (!p.dial && !p.national) return "";
  if (p.dial === MX_COUNTRY_CODE && p.national.length === MX_NATIONAL_DIGITS) {
    return formatMxPhoneDisplay(`${MX_COUNTRY_CODE}${p.national}`);
  }
  if (!p.national) return `+${p.dial}`;
  return `+${p.dial} ${p.national}`;
}

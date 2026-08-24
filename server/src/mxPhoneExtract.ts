function digitsOnly(value: string): string {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeWhatsAppDigits(value: string): string | null {
  const digits = digitsOnly(value);
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

function normalizeMxNationalDigits(value: string): string | null {
  const digits = digitsOnly(value);
  if (!digits) return null;
  let national = digits;
  if (national.startsWith("521") && national.length === 13) national = national.slice(3);
  else if (national.startsWith("52") && national.length === 12) national = national.slice(2);
  else if (national.startsWith("045") && national.length === 13) national = national.slice(3);
  else if (national.startsWith("044") && national.length === 13) national = national.slice(3);
  else if (national.startsWith("01") && national.length === 12) national = national.slice(2);
  return national.length === 10 ? national : null;
}

export function phoneDigitsForStorage(input: string): string | null {
  const national = normalizeMxNationalDigits(input);
  if (national) return `52${national}`;
  return normalizeWhatsAppDigits(input);
}

/**
 * First plausible MX phone in free text / OCR paste.
 * Prefers labeled snippets (WhatsApp / cel / tel), else first standalone number.
 */
export function extractFirstMxPhoneFromText(text: string): string | null {
  const raw = String(text ?? "");
  if (!raw.trim()) return null;

  const labeled =
    /(?:whats?\s*app|wa\.me|cel(?:ular)?|m[oó]vil|tel(?:[eé]fono)?|llamar)\s*[:.\-]?\s*([+\d][\d\s().-]{8,20}\d)/gi;
  let match: RegExpExecArray | null;
  while ((match = labeled.exec(raw))) {
    const digits = phoneDigitsForStorage(match[1] ?? "");
    if (digits) return digits;
  }

  const ten = /\b(\d{2}[\s-]?\d{4}[\s-]?\d{4}|\d{3}[\s-]?\d{3}[\s-]?\d{4}|\d{10})\b/g;
  while ((match = ten.exec(raw))) {
    const digits = phoneDigitsForStorage(match[1] ?? "");
    if (digits) return digits;
  }

  const intl = /\+\s*52[\s-]?(\d[\d\s()-]{8,14}\d)/g;
  while ((match = intl.exec(raw))) {
    const digits = phoneDigitsForStorage(`52${match[1]}`);
    if (digits) return digits;
  }

  return null;
}

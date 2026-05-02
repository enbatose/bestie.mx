/** Mirrors server `normalizeWhatsAppDigits` + `phoneE164FromDigits` (MX). */

export function normalizeWhatsAppDigits(s: string): string | null {
  const d = String(s).replace(/\D/g, "");
  if (d.length < 10 || d.length > 15) return null;
  return d;
}

export function phoneE164FromDigits(d: string): string {
  if (d.startsWith("52") && d.length >= 12) return `+${d}`;
  if (d.length === 10) return `+52${d}`;
  return `+${d}`;
}

export function parsePhoneInputToE164(input: string): string | null {
  const d = normalizeWhatsAppDigits(input.trim());
  return d ? phoneE164FromDigits(d) : null;
}

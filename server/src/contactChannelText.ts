/** Seeker contact channels are not Bestie filters and must never be spoken as ours. */

const CONTACT_LABEL =
  /^(contacto|tel[eé]fono|whatsapp|celular|celular\/whatsapp|messenger|llamar|n[uú]mero)(\b|[\s:_-])/i;

function digitCount(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

/** Mexican mobile/landline shapes, with or without +52 and separators. */
const PHONE_SHAPE =
  /(?:\+?\s*52[\s().-]*)?(?:\(?\d{2,3}\)?[\s().-]*)?\d{3,4}[\s().-]*\d{4}\b/;

export function looksLikePhoneNumber(value: string): boolean {
  const digits = digitCount(value);
  if (digits < 8 || digits > 13) return false;
  const compact = value.replace(/\s/g, "");
  if (digits >= compact.length * 0.45) return true;
  return PHONE_SHAPE.test(value);
}

export function isContactChannelText(label: string, text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (CONTACT_LABEL.test(label.trim()) && digitCount(t) >= 8) return true;
  if (looksLikePhoneNumber(t) && t.length <= 28) return true;
  return false;
}

export function shareableDiffusionCriteria(criteria: string[] | null | undefined): string[] {
  return (criteria ?? [])
    .map((c) => c.trim())
    .filter((c) => c && !isContactChannelText("", c) && !looksLikePhoneNumber(c));
}

import { normalizeMxNationalDigits, phoneDigitsForStorage } from "@/lib/mxPhone";

/** Facebook group covered by Regla 6 — Visibilidad en Bestie.mx */
export const FB_OUTREACH_GROUP_NAME =
  "Busco Roomies, Comparto Depa, Renta de Cuartos Guadalajara, Roomie GDL";

/** Short lockup for WhatsApp outreach (ellipsis skips the middle of the full group title). */
export const FB_OUTREACH_GROUP_NAME_SHORT =
  "Busco Roomies, Comparto Depa...Roomie GDL";

/** 10-digit MX mobile for outreach copy (e.g. 3318632070), no +52. */
export function adminOutreachContactPhoneDisplay(raw: string): string | null {
  return normalizeMxNationalDigits(raw);
}

/** Colorful emoji OK in prefill via api.whatsapp.com (not wa.me). */
export function adminOutreachWhatsAppMessage(opts: {
  publisherName?: string;
  listingUrl: string;
  /** Listing / outreach phone — shown as 10 national digits in the register line. */
  contactPhone?: string;
}): string {
  const name = opts.publisherName?.trim();
  const greeting = name ? `Hola ${name},` : "Hola,";
  const url = opts.listingUrl.trim();
  const phoneDisplay = adminOutreachContactPhoneDisplay(opts.contactPhone ?? "");
  const registerLine = phoneDisplay
    ? `Regístrate en bestie.mx con este número ${phoneDisplay} y búscala en Mis Anuncios.`
    : "Regístrate en bestie.mx con este mismo celular y búscala en Mis Anuncios.";

  return [
    greeting,
    "",
    `Vimos tu publicación de roomie/cuarto en el grupo _${FB_OUTREACH_GROUP_NAME_SHORT}_. Según las reglas del grupo, la republicamos en Bestie para que más personas la vean fuera de Facebook.`,
    "",
    "🌐 Tu anuncio:",
    url,
    "",
    "En Bestie MX publicar, buscar cuarto y mensajear es gratuito — y lo seguirá siendo.",
    "",
    "¿Quieres editarla o quitarla tú? 📝",
    registerLine,
    "",
    "Si prefieres que no esté en Bestie, responde BAJA y la retiramos.",
    "",
    "¡Saludos! ✌",
  ].join("\n");
}

/**
 * api.whatsapp.com keeps astral emoji (🌐 📝); only normalize ✌️ → ✌ for the closing line.
 */
export function adminOutreachWhatsAppPrefillText(message: string): string {
  return message.replaceAll("\u{270C}\uFE0F", "\u{270C}");
}

/**
 * Opens WhatsApp with prefilled message (user must tap Send).
 * Uses api.whatsapp.com (not wa.me) so UTF-8 emoji survive in the compose box.
 */
export function adminOutreachWhatsAppHref(phoneDigits: string, message: string): string | null {
  const digits = phoneDigitsForStorage(phoneDigits);
  if (!digits) return null;
  const safe = adminOutreachWhatsAppPrefillText(message);
  return `https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(safe)}`;
}

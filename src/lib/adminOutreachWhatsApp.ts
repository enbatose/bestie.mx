import { phoneDigitsForStorage } from "@/lib/mxPhone";

/** Facebook group covered by Regla 6 — Visibilidad en Bestie.mx */
export const FB_OUTREACH_GROUP_NAME =
  "Busco Roomies, Comparto Depa, Renta de Cuartos Guadalajara, Roomie GDL";

/** Colorful emoji OK in prefill via api.whatsapp.com (not wa.me). */
export function adminOutreachWhatsAppMessage(opts: {
  publisherName?: string;
  listingUrl: string;
}): string {
  const name = opts.publisherName?.trim();
  const greeting = name ? `Hola ${name},` : "Hola,";
  const url = opts.listingUrl.trim();

  return [
    greeting,
    "",
    "Vimos tu publicación de roomie/cuarto en el grupo de Facebook de Guadalajara. Según las reglas del grupo, la republicamos en Bestie para que más personas la vean fuera de Facebook.",
    "",
    "🌐 Tu anuncio:",
    url,
    "",
    "En Bestie MX publicar, buscar cuarto y mensajear es gratuito — y lo seguirá siendo.",
    "",
    "¿Quieres editarla o quitarla tú? 📝",
    "Regístrate en bestie.mx con este mismo celular y búscala en Mis Anuncios.",
    "",
    "Si prefieres que no esté en Bestie, responde BAJA y la retiramos.",
    "",
    "¡Saludos ✌!",
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

import { whatsAppMeHref } from "@/lib/mxPhone";

/** Facebook group covered by Regla 6 — Visibilidad en Bestie.mx */
export const FB_OUTREACH_GROUP_NAME =
  "Busco Roomies, Comparto Depa, Renta de Cuartos Guadalajara, Roomie GDL";

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
    "🌐Tu anuncio:",
    url,
    "",
    "En Bestie MX publicar, buscar cuarto y mensajear es gratuito — y lo seguirá siendo.",
    "",
    "¿Quieres editarla o quitarla tú? 📝",
    "Regístrate en bestie.mx con este mismo celular y búscala en Mis Anuncios.",
    "",
    "Si prefieres que no esté en Bestie, responde BAJA y la retiramos.",
    "",
    "¡Saludos✌️! ",
  ].join("\n");
}

/** Opens WhatsApp chat with a pre-filled message (user must tap Send). */
export function adminOutreachWhatsAppHref(phoneDigits: string, message: string): string | null {
  const base = whatsAppMeHref(phoneDigits);
  if (!base) return null;
  return `${base}?text=${encodeURIComponent(message)}`;
}

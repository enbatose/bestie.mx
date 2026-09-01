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
    "Somos del equipo de Bestie MX 🏠, roomies en Guadalajara: publicar, buscar cuarto y mensajear es gratuito y lo seguirá siendo.",
    "",
    `Según las reglas del grupo de Facebook «${FB_OUTREACH_GROUP_NAME}», creamos un anuncio en Bestie con la información y fotos de tu publicación para darte más visibilidad.`,
    "",
    "🌐Tu anuncio:",
    url,
    "",
    "Si no quieres que esté en Bestie, responde BAJA y lo quitamos.",
    "",
    "Si quieres editarlo o administrarlo tú, inicia sesión en Bestie con este mismo número de teléfono y ve el menú Mis Anuncios 📱",
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

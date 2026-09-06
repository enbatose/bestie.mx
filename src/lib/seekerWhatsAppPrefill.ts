import { phoneDigitsForStorage } from "@/lib/mxPhone";

/** WhatsApp italic wrap. Underscores inside the title would break formatting. */
export function whatsAppItalic(text: string): string {
  const t = text.trim().replaceAll("_", " ").replace(/\s+/g, " ").trim();
  return t ? `_${t}_` : "_tu anuncio_";
}

export function seekerWhatsAppPrefill(opts: {
  publisherName?: string | null;
  seekerName?: string | null;
  listingTitle?: string | null;
}): string {
  const publisher = opts.publisherName?.trim();
  const seeker = opts.seekerName?.trim() || "un usuario de Bestie";
  const italicTitle = whatsAppItalic(opts.listingTitle?.trim() || "tu anuncio");
  const hello = publisher ? `Hola ${publisher}` : "Hola";
  return `${hello}, soy ${seeker} — Vi tu publicación ${italicTitle} en Bestie.mx, quisiera pedir más información y confirmar si aún está disponible.`;
}

/** Prefill compose box; api.whatsapp.com keeps Spanish punctuation reliably. */
export function seekerWhatsAppHref(phoneDigits: string, message: string): string | null {
  const digits = phoneDigitsForStorage(phoneDigits);
  if (!digits) return null;
  return `https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(message)}`;
}

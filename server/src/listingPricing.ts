export const CONSULTAR_RENT_LABEL = "Consultar $";

export const HIDE_PRICING_CONTACT_MESSAGE =
  "Para ocultar el precio necesitas un teléfono en el anuncio o mensajes en Bestie.";

export function isPricingHidden(value: { hidePricing?: boolean } | null | undefined): boolean {
  return Boolean(value?.hidePricing);
}

export function hidePricingContactAllowed(hasPhone: boolean, hasChat: boolean): boolean {
  return hasPhone || hasChat;
}

/** Seekers only need a contact path on a live listing — drafts may hide prices freely. */
export function hidePricingContactRequired(status: string | null | undefined): boolean {
  return status === "published";
}

/**
 * Unclaimed outreach has no Bestie chat. If hide-pricing is on and a real phone is stored
 * but not shown, show it so seekers can consultar $. Returns null when the patch is invalid.
 */
export function resolveShowWhatsappForHidePricing(opts: {
  hidePricing: boolean;
  showWhatsapp: number;
  hasPublicPhone: boolean;
  hasChat: boolean;
  hasStoredPhone: boolean;
}): { ok: true; showWhatsapp: number } | { ok: false } {
  const show = opts.showWhatsapp ? 1 : 0;
  if (!opts.hidePricing) return { ok: true, showWhatsapp: show };
  if (hidePricingContactAllowed(opts.hasPublicPhone, opts.hasChat)) {
    return { ok: true, showWhatsapp: show };
  }
  if (opts.hasStoredPhone) return { ok: true, showWhatsapp: 1 };
  return { ok: false };
}

export function redactHiddenPublicPricing<
  T extends { hidePricing?: boolean; rentMxn: number; depositMxn?: number; rentMxnMax?: number },
>(listing: T): T {
  if (!listing.hidePricing) return listing;
  return { ...listing, rentMxn: 0, depositMxn: 0, rentMxnMax: undefined };
}

export function redactHiddenPublicRooms<T extends { rentMxn: number; depositMxn: number }>(
  rooms: T[],
  hidePricing: boolean,
): T[] {
  if (!hidePricing) return rooms;
  return rooms.map((room) => ({ ...room, rentMxn: 0, depositMxn: 0 }));
}

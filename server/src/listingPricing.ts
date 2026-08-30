export const CONSULTAR_RENT_LABEL = "Consultar $";

export const HIDE_PRICING_CONTACT_MESSAGE =
  "Para ocultar el precio necesitas un teléfono en el anuncio o mensajes en Bestie.";

export function isPricingHidden(value: { hidePricing?: boolean } | null | undefined): boolean {
  return Boolean(value?.hidePricing);
}

export function hidePricingContactAllowed(hasPhone: boolean, hasChat: boolean): boolean {
  return hasPhone || hasChat;
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

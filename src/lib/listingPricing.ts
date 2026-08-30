import { phoneDigitsForStorage } from "@/lib/mxPhone";

/** Public compact label when rent/deposit are hidden. */
export const CONSULTAR_RENT_LABEL = "Consultar $";

/** Hero copy on the open listing. */
export const HIDE_PRICING_DISCLAIMER = "Consulta renta y depósito con quien publica.";

export const HIDE_PRICING_CONTACT_MESSAGE =
  "Para ocultar el precio necesitas un teléfono en el anuncio o mensajes en Bestie.";

/** Stored when the publisher omitted a real phone (`0000000000000`). */
const LISTING_PHONE_PLACEHOLDER = /^0+$/;

export function isPricingHidden(value: { hidePricing?: boolean } | null | undefined): boolean {
  return Boolean(value?.hidePricing);
}

export function hidePricingContactAllowed(hasPhone: boolean, hasChat: boolean): boolean {
  return hasPhone || hasChat;
}

export function draftHasRealListingPhone(contactWhatsApp?: string | null): boolean {
  const digits = phoneDigitsForStorage(String(contactWhatsApp ?? ""));
  if (!digits || LISTING_PHONE_PLACEHOLDER.test(digits)) return false;
  return true;
}

export function draftHasPublicListingPhone(draft: {
  showWhatsApp?: boolean;
  contactWhatsApp?: string | null;
}): boolean {
  return Boolean(draft.showWhatsApp) && draftHasRealListingPhone(draft.contactWhatsApp);
}

/** Seekers only need a contact path on a live listing — drafts may hide prices freely. */
export function hidePricingContactRequired(status: string | null | undefined): boolean {
  return status === "published";
}

export type HidePricingContactOpts = {
  hasChat: boolean;
  /** When false (drafts), hide-pricing does not need phone or Bestie chat. */
  requireContact?: boolean;
};

/** Toggle is allowed if the listing is a draft, or chat/phone can cover consultar $. */
export function draftHidePricingContactOk(
  draft: { showWhatsApp?: boolean; contactWhatsApp?: string | null },
  opts: HidePricingContactOpts,
): boolean {
  if (opts.requireContact === false) return true;
  return (
    hidePricingContactAllowed(draftHasPublicListingPhone(draft), opts.hasChat) ||
    draftHasRealListingPhone(draft.contactWhatsApp)
  );
}

/**
 * Turn hide-pricing on/off. On a published listing with no Bestie chat, a stored-but-hidden
 * phone is revealed so seekers can consultar $. Drafts only flip the flag.
 */
export function applyDraftHidePricing<
  T extends { hidePricing?: boolean; showWhatsApp?: boolean; contactWhatsApp?: string },
>(draft: T, hide: boolean, opts: HidePricingContactOpts): T {
  if (!hide) return { ...draft, hidePricing: false };
  if (opts.requireContact === false) return { ...draft, hidePricing: true };
  if (hidePricingContactAllowed(draftHasPublicListingPhone(draft), opts.hasChat)) {
    return { ...draft, hidePricing: true };
  }
  if (draftHasRealListingPhone(draft.contactWhatsApp)) {
    return { ...draft, hidePricing: true, showWhatsApp: true };
  }
  return draft;
}

/** FNV-1a 32-bit — stable seed from listing ids so shuffle is not per React render. */
export function hashStringSeed(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Insert hidden-price rows at random indexes among priced rows.
 * Priced order is preserved (cheap → expensive).
 */
export function interleaveHiddenPricingListings<T extends { hidePricing?: boolean }>(
  listings: readonly T[],
  random: () => number = Math.random,
): T[] {
  const priced: T[] = [];
  const hidden: T[] = [];
  for (const listing of listings) {
    if (listing.hidePricing) hidden.push(listing);
    else priced.push(listing);
  }
  const result = [...priced];
  for (const item of hidden) {
    const idx = Math.floor(random() * (result.length + 1));
    result.splice(idx, 0, item);
  }
  return result;
}

/** Same result set (ids) → same insert positions. Different sets → different mix. */
export function interleaveHiddenPricingListingsStable<T extends { hidePricing?: boolean; id?: string }>(
  listings: readonly T[],
): T[] {
  const seed = hashStringSeed(listings.map((listing) => String(listing.id ?? "")).join("|"));
  return interleaveHiddenPricingListings(listings, mulberry32(seed));
}

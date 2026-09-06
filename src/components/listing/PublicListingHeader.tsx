import type { AuthMe } from "@/lib/authApi";
import { ListingPhoneReveal } from "@/components/listing/ListingPhoneReveal";
import { formatListingPhoneDisplay } from "@/lib/mxPhone";
import {
  LISTING_HEADER_BADGE_CLASS,
  listingHeroPriceLabel,
  publicListingHeaderBadges,
  previewPropertyHeaderTitle,
  previewRoomHeaderTitle,
} from "@/lib/listingTags";
import type { ListingTag, LodgingType, PropertyKind, PropertyListing, RoommateGenderPref } from "@/types/listing";

/** Green hero shell — same tint as the publish preview header, on published posts too. */
export const LISTING_HERO_SHELL_CLASS =
  "min-w-0 overflow-x-clip rounded-2xl border border-secondary/50 bg-secondary/5 p-4 shadow-sm sm:p-5";

type HeaderBadgesProps = {
  postMode: "room" | "property";
  roommateGenderPref: RoommateGenderPref;
  availableFrom?: string;
  occupiedByMenCount?: number | null;
  occupiedByWomenCount?: number | null;
  propertyBedroomsTotal?: number;
  propertyBathrooms?: number;
  propertyKind?: PropertyKind;
  tags?: readonly ListingTag[];
};

export function ListingHeroPrice({ rentMxn }: { rentMxn: number }) {
  return (
    <p className="mt-2 text-2xl font-bold text-body">{listingHeroPriceLabel(rentMxn)}</p>
  );
}

export function ListingHeaderBadges(props: HeaderBadgesProps) {
  const badges = publicListingHeaderBadges(props);
  if (!badges.length) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {badges.map(({ id, label }) => (
        <span key={id} className={LISTING_HEADER_BADGE_CLASS}>
          {label}
        </span>
      ))}
    </div>
  );
}

export function publicListingHeaderTitle(opts: {
  postMode: "room" | "property";
  neighborhood: string;
  lodgingType?: LodgingType;
  propertyKind?: PropertyKind;
}): string {
  if (opts.postMode === "room") {
    return previewRoomHeaderTitle(opts.lodgingType ?? "private_room", opts.neighborhood, opts.postMode);
  }
  return previewPropertyHeaderTitle(opts.propertyKind ?? "house", opts.neighborhood);
}

function WhatsAppMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2zm0 1.82c2.17 0 4.21.85 5.75 2.38a8.08 8.08 0 0 1 2.37 5.75c0 4.48-3.65 8.12-8.12 8.12-1.42 0-2.8-.36-4.02-1.05l-.29-.17-3.12.82.83-3.04-.19-.31a8.1 8.1 0 0 1-1.24-4.37c0-4.48 3.65-8.13 8.13-8.13zm4.52 10.52c-.2-.1-1.18-.58-1.36-.65-.18-.07-.31-.1-.44.1-.13.2-.5.65-.62.78-.11.13-.23.15-.43.05-.2-.1-.84-.31-1.6-.99-.59-.53-.99-1.18-1.1-1.38-.12-.2-.01-.3.09-.4.09-.09.2-.23.3-.35.1-.12.13-.2.2-.33.07-.13.03-.25-.02-.35-.05-.1-.44-1.06-.6-1.45-.16-.38-.32-.33-.44-.33h-.38c-.13 0-.34.05-.52.25-.18.2-.68.67-.68 1.63s.7 1.89.8 2.02c.1.13 1.37 2.1 3.32 2.94.46.2.83.32 1.11.41.47.15.89.13 1.23.08.37-.06 1.18-.48 1.35-.95.17-.47.17-.87.12-.95-.05-.08-.18-.13-.38-.23z"
      />
    </svg>
  );
}

/** Same green as the listing hero header, without extra nested padding on 360px. */
export const LISTING_PHONE_BAND_SHELL_CLASS =
  "min-w-0 w-full overflow-x-clip rounded-2xl border border-secondary/50 bg-secondary/5 px-3 py-3 sm:p-5";

function listingHasPublicPhone(listing: PropertyListing): boolean {
  if (listing.claimPreview && listing.hasDraftPhone && listing.claimPhoneDisplay) return true;
  return Boolean(listing.hasContactPhone);
}

/** Unpublished claim preview: number in the clear + call/WhatsApp (token-gated, not crawlable). */
function ListingPlainContactPhone({ digits, layout = "card" }: { digits: string; layout?: "card" | "band" }) {
  const d = digits.replace(/\D/g, "");
  if (!d) return null;
  const band = layout === "band";
  return (
    <div
      className={
        band
          ? "flex w-full min-w-0 flex-col items-center text-center"
          : "relative w-full min-w-0 max-w-full overflow-x-clip rounded-xl border border-border/80 bg-surface/80 px-3 py-2.5 sm:w-max sm:px-3.5 sm:py-3"
      }
    >
      <p
        className={
          band
            ? "text-sm font-semibold text-body"
            : "text-[11px] font-semibold uppercase tracking-wide text-muted"
        }
      >
        Teléfono / móvil
      </p>
      <p className="mt-0.5 break-all font-mono text-base tabular-nums text-body sm:text-sm">
        {formatListingPhoneDisplay(digits)}
      </p>
      <div className={`mt-2 grid w-full min-w-0 grid-cols-2 gap-2 ${band ? "" : "sm:flex sm:flex-wrap"}`}>
        <a
          href={`tel:+${d}`}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-body hover:bg-surface-elevated"
        >
          Llamar
        </a>
        <a
          href={`https://wa.me/${d}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-3 py-1.5 text-xs font-semibold text-body hover:bg-[#25D366]/15"
        >
          <WhatsAppMark className="size-3.5 text-[#25D366]" />
          <span className="sm:hidden">WhatsApp</span>
          <span className="hidden sm:inline">Mandar WhatsApp</span>
        </a>
      </div>
    </div>
  );
}

/**
 * Claim/unpublished shows digits; published listings stay masked until login.
 */
export function ListingHeroPhone({
  listing,
  viewer,
  layout = "card",
}: {
  listing: PropertyListing;
  viewer: AuthMe | null | undefined;
  layout?: "card" | "band";
}) {
  if (listing.claimPreview && listing.hasDraftPhone && listing.claimPhoneDisplay) {
    return <ListingPlainContactPhone digits={listing.claimPhoneDisplay} layout={layout} />;
  }
  if (listing.hasContactPhone) {
    return (
      <ListingPhoneReveal
        listingId={listing.id}
        propertyId={listing.propertyId}
        hasContactPhone
        viewer={viewer}
        role={listing.viewerIsOwner ? "publisher" : "seeker"}
        compact
        layout={layout}
        listingTitle={listing.title}
      />
    );
  }
  return null;
}

/** Full-width phone band under listing photos — same width as the gallery, header green. */
export function ListingPostPhoneBand({
  listing,
  viewer,
}: {
  listing: PropertyListing;
  viewer: AuthMe | null | undefined;
}) {
  if (!listingHasPublicPhone(listing)) return null;
  return (
    <div id="contacto-telefono" className={`mt-3 scroll-mt-24 ${LISTING_PHONE_BAND_SHELL_CLASS}`}>
      <ListingHeroPhone listing={listing} viewer={viewer} layout="band" />
    </div>
  );
}

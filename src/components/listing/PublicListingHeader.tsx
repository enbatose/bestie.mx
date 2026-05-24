import {
  LISTING_HEADER_BADGE_CLASS,
  listingHeroPriceLabel,
  publicListingHeaderBadges,
  previewPropertyHeaderTitle,
  previewRoomHeaderTitle,
} from "@/lib/listingTags";
import type { ListingTag, LodgingType, PropertyKind, RoommateGenderPref } from "@/types/listing";

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
    <p className="mt-2 text-2xl font-bold text-slate-900">{listingHeroPriceLabel(rentMxn)}</p>
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

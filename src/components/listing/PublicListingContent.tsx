import { ListingPhotoGallery } from "@/components/listing/ListingPhotoGallery";
import {
  ListingPropertySummaryGrid,
  ListingRoomDetailsGrid,
} from "@/components/listing/ListingPropertySummaryGrid";
import { ListingSection } from "@/components/listing/ListingSection";
import { ListingTagSection } from "@/components/listing/ListingTagChips";
import { PublicListingLocationMap } from "@/components/listing/PublicListingLocationMap";
import {
  filterPropertyScopeTags,
  filterRoomScopeTags,
  sortRoomScopeTags,
} from "@/lib/listingTags";
import type { PropertyKind, PropertyListing } from "@/types/listing";

type Props = {
  listing: PropertyListing;
  postMode: "room" | "property";
  propertyKind: PropertyKind;
  propertyBedroomsTotal: number;
  propertySummary: string;
  isApproximateLocation: boolean;
  occupiedByWomenCount?: number | null;
  occupiedByMenCount?: number | null;
  galleryUrls: readonly string[];
  roomCount: number;
  failedImageUrls?: ReadonlySet<string>;
  onImageError?: (url: string) => void;
};

export function PublicListingContent({
  listing,
  postMode,
  propertyKind,
  propertyBedroomsTotal,
  propertySummary,
  isApproximateLocation,
  occupiedByWomenCount,
  occupiedByMenCount,
  galleryUrls,
  roomCount,
  failedImageUrls,
  onImageError,
}: Props) {
  const propertyTags = filterPropertyScopeTags(listing.tags);
  const roomTags = sortRoomScopeTags(filterRoomScopeTags(listing.tags));
  const roomSummary = listing.summary.trim();

  return (
    <div className="space-y-6">
      {galleryUrls.length ? (
        <ListingSection title="Fotos">
          <ListingPhotoGallery
            urls={galleryUrls}
            failedUrls={failedImageUrls}
            onImageError={onImageError}
            linkToFullSize
          />
        </ListingSection>
      ) : null}

      <ListingSection title="Resumen de la propiedad">
        <ListingPropertySummaryGrid
          neighborhood={listing.neighborhood}
          propertyKind={propertyKind}
          propertyBedroomsTotal={propertyBedroomsTotal}
          occupiedByWomenCount={occupiedByWomenCount}
          occupiedByMenCount={occupiedByMenCount}
        />
      </ListingSection>

      <ListingSection title="Sobre la propiedad">
        <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
          <div className="max-h-[350px] overflow-y-auto overscroll-y-contain pr-1 text-sm leading-relaxed text-muted sm:text-base">
            {propertySummary ? (
              propertySummary
            ) : (
              <span className="italic">Sin descripción de la propiedad.</span>
            )}
          </div>
          <PublicListingLocationMap listing={listing} isApproximateLocation={isApproximateLocation} />
        </div>
        <ListingTagSection heading="Etiquetas de la propiedad" tags={propertyTags} />
      </ListingSection>

      <ListingSection title="Detalles de la recámara">
        <ListingRoomDetailsGrid
          room={{
            rentMxn: listing.rentMxn,
            depositMxn: listing.depositMxn,
            lodgingType: listing.lodgingType,
            roomDimension: listing.roomDimension,
            tags: listing.tags,
            availableFrom: listing.availableFrom,
            minimalStayMonths: listing.minimalStayMonths,
            roomsAvailable: listing.roomsAvailable,
            roommateGenderPref: listing.roommateGenderPref,
            ageMin: listing.ageMin,
            ageMax: listing.ageMax,
          }}
          postMode={postMode}
          roomCount={roomCount}
        />
      </ListingSection>

      <ListingSection title="Descripción de la recámara">
        <p className="text-sm leading-relaxed text-muted sm:text-base">
          {roomSummary || <span className="italic">Sin descripción de la recámara.</span>}
        </p>
        <ListingTagSection heading="Etiquetas de la recámara" tags={roomTags} />
      </ListingSection>
    </div>
  );
}

import { ListingPhotoGallery } from "@/components/listing/ListingPhotoGallery";
import { ListingPhotoPlaceholder } from "@/components/listing/ListingPhotoPlaceholder";
import {
  ListingPropertySummaryGrid,
  ListingRoomDetailsGrid,
} from "@/components/listing/ListingPropertySummaryGrid";
import { ListingSection } from "@/components/listing/ListingSection";
import { ListingSeekerFitCard } from "@/components/listing/ListingSeekerFitCard";
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
  /** Optimized layout for people browsing for a room. */
  seekerLayout?: boolean;
};

const roomDetailsFromListing = (listing: PropertyListing) => ({
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
});

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
  seekerLayout = false,
}: Props) {
  const propertyTags = filterPropertyScopeTags(listing.tags);
  const roomTags = sortRoomScopeTags(filterRoomScopeTags(listing.tags));
  const roomSummary = listing.summary.trim();
  const depositMxn = listing.depositMxn ?? 0;

  const photosBlock = galleryUrls.length ? (
    <ListingPhotoGallery
      urls={galleryUrls}
      failedUrls={failedImageUrls}
      onImageError={onImageError}
      linkToFullSize
    />
  ) : (
    <ListingPhotoPlaceholder />
  );

  const propertyDescriptionBlock = (
    <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
      <div className="max-h-[350px] overflow-y-auto overscroll-y-contain pr-1 text-sm leading-relaxed text-muted sm:text-base">
        {propertySummary ? propertySummary : <span className="italic">Sin descripción de la propiedad.</span>}
      </div>
      <PublicListingLocationMap listing={listing} isApproximateLocation={isApproximateLocation} />
    </div>
  );

  if (seekerLayout) {
    return (
      <div className="space-y-6">
        <ListingSection title="Fotos" subtitle="Revisa el espacio antes de contactar al anunciante.">
          {photosBlock}
        </ListingSection>

        <ListingSeekerFitCard
          rentMxn={listing.rentMxn}
          depositMxn={depositMxn}
          postMode={postMode}
          lodgingType={listing.lodgingType}
          roomDimension={listing.roomDimension}
          roomsAvailable={listing.roomsAvailable}
          tags={listing.tags}
          availableFrom={listing.availableFrom}
          minimalStayMonths={listing.minimalStayMonths}
          roommateGenderPref={listing.roommateGenderPref}
          ageMin={listing.ageMin}
          ageMax={listing.ageMax}
          occupiedByWomenCount={occupiedByWomenCount}
          occupiedByMenCount={occupiedByMenCount}
        />

        <ListingSection title="El espacio" subtitle="Cómo es la recámara y el ambiente day-to-day.">
          <p className="text-sm leading-relaxed text-muted sm:text-base">
            {roomSummary || <span className="italic">Sin descripción de la recámara.</span>}
          </p>
          <ListingTagSection heading="Características de la recámara" tags={roomTags} />
        </ListingSection>

        <ListingSection title="La convivencia" subtitle="Quién vive en la propiedad y cómo está distribuida.">
          <ListingPropertySummaryGrid
            neighborhood={listing.neighborhood}
            propertyKind={propertyKind}
            propertyBedroomsTotal={propertyBedroomsTotal}
            occupiedByWomenCount={occupiedByWomenCount}
            occupiedByMenCount={occupiedByMenCount}
          />
        </ListingSection>

        <ListingSection title="La propiedad" subtitle="Áreas comunes, ubicación y amenidades compartidas.">
          {propertyDescriptionBlock}
          <ListingTagSection heading="Amenidades de la propiedad" tags={propertyTags} />
        </ListingSection>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {galleryUrls.length ? <ListingSection title="Fotos">{photosBlock}</ListingSection> : null}

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
        {propertyDescriptionBlock}
        <ListingTagSection heading="Etiquetas de la propiedad" tags={propertyTags} />
      </ListingSection>

      <ListingSection title="Detalles de la recámara">
        <ListingRoomDetailsGrid room={roomDetailsFromListing(listing)} postMode={postMode} roomCount={roomCount} />
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
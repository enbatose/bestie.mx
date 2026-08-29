import type { ReactNode } from "react";
import { ListingHeaderBadges } from "@/components/listing/PublicListingHeader";
import {
  listingHeroPriceLabel,
} from "@/lib/listingTags";
import type { ListingTag, Property, PropertyListing, Room } from "@/types/listing";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function HeaderLocationLine({ neighborhood, city }: { neighborhood: string; city: string }) {
  const line = [neighborhood.trim(), city.trim()].filter(Boolean).join(" · ");
  if (!line) return null;
  return <p className="text-sm text-muted">{line}</p>;
}

export function SingleRoomHeader({
  listing,
  menCount,
  womenCount,
  shareActions,
  title,
  phone,
}: {
  listing: PropertyListing;
  menCount: number;
  womenCount: number;
  shareActions?: ReactNode;
  title?: string;
  phone?: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <HeaderLocationLine neighborhood={listing.neighborhood} city={listing.city} />
          <h2 className="mt-2 min-w-0 break-words text-2xl font-bold tracking-tight text-primary sm:text-3xl">
            {title ?? listing.title}
          </h2>
        </div>
        {shareActions ? <div className="max-w-[45%] shrink-0 sm:max-w-none">{shareActions}</div> : null}
      </div>
      <p className="mt-2 text-2xl font-bold text-body">{listingHeroPriceLabel(listing.rentMxn)}</p>
      <ListingHeaderBadges
        postMode="room"
        roommateGenderPref={listing.roommateGenderPref}
        availableFrom={listing.availableFrom}
        occupiedByMenCount={menCount}
        occupiedByWomenCount={womenCount}
        propertyBedroomsTotal={listing.propertyBedroomsTotal}
        propertyBathrooms={listing.propertyBathrooms}
        propertyKind={listing.propertyKind}
        tags={listing.tags}
      />
      {(listing.depositMxn ?? 0) > 0 ? (
        <p className="mt-2 text-sm text-muted">Depósito · {money.format(listing.depositMxn ?? 0)}</p>
      ) : null}
      {phone}
    </div>
  );
}

export function PropertyHeader({
  property,
  availableRooms,
  shareActions,
  tags,
  phone,
}: {
  property: Property;
  availableRooms: Room[];
  shareActions?: ReactNode;
  tags?: readonly ListingTag[];
  phone?: ReactNode;
}) {
  const rents = availableRooms.map((room) => room.rentMxn).filter((rent) => rent > 0);
  const minRent = rents.length ? Math.min(...rents) : 0;
  const maxRent = rents.length ? Math.max(...rents) : 0;
  const firstAvailable = availableRooms[0];

  return (
    <div className="min-w-0 space-y-1">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <HeaderLocationLine neighborhood={property.neighborhood} city={property.city} />
          <h2 className="mt-2 min-w-0 break-words text-2xl font-bold tracking-tight text-primary sm:text-3xl">
            {property.title}
          </h2>
        </div>
        {shareActions ? <div className="max-w-[45%] shrink-0 sm:max-w-none">{shareActions}</div> : null}
      </div>
      <p className="mt-2 text-2xl font-bold text-body">
        {rents.length > 1
          ? `${money.format(minRent)} – ${money.format(maxRent)} / mes`
          : listingHeroPriceLabel(minRent)}
      </p>
      <ListingHeaderBadges
        postMode="property"
        roommateGenderPref={firstAvailable?.roommateGenderPref ?? "any"}
        occupiedByMenCount={property.occupiedByMenCount}
        occupiedByWomenCount={property.occupiedByWomenCount}
        propertyBedroomsTotal={property.bedroomsTotal}
        propertyBathrooms={property.bathrooms}
        propertyKind={property.propertyKind}
        tags={tags}
      />
      {phone}
    </div>
  );
}

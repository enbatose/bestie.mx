import type { ReactNode } from "react";
import { formatRoomAvailableFrom, listingHeroPriceLabel } from "@/lib/listingTags";
import { genderPrefLabel, propertyKindLabel } from "@/lib/listingKeyLabels";
import type { Property, PropertyListing, Room } from "@/types/listing";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function HeaderInfoItem({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-xl leading-none" aria-hidden>
        {emoji}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
        <p className="text-sm font-medium text-body">{value}</p>
      </div>
    </div>
  );
}

export function SingleRoomHeader({
  listing,
  menCount,
  womenCount,
  shareActions,
  title,
}: {
  listing: PropertyListing;
  menCount: number;
  womenCount: number;
  shareActions?: ReactNode;
  title?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-bold text-body">{title ?? listing.title}</h2>
        {shareActions ? <div className="shrink-0">{shareActions}</div> : null}
      </div>
      <p className="text-2xl font-bold text-slate-900">{listingHeroPriceLabel(listing.rentMxn)}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HeaderInfoItem emoji="👥" label="Viven aquí" value={`${menCount} Hombres, ${womenCount} Mujeres`} />
        <HeaderInfoItem
          emoji="⚧️"
          label="Preferencia de género"
          value={genderPrefLabel(listing.roommateGenderPref)}
        />
        <HeaderInfoItem
          emoji="📅"
          label="Disponible desde"
          value={formatRoomAvailableFrom(listing.availableFrom ?? "")}
        />
        <HeaderInfoItem emoji="🏠" label="Tipo de vivienda" value={propertyKindLabel(listing.propertyKind)} />
        <HeaderInfoItem emoji="📍" label="Colonia" value={listing.neighborhood} />
      </div>
    </div>
  );
}

export function PropertyHeader({
  property,
  availableRooms,
  shareActions,
}: {
  property: Property;
  availableRooms: Room[];
  shareActions?: ReactNode;
}) {
  const rents = availableRooms.map((room) => room.rentMxn).filter((rent) => rent > 0);
  const minRent = rents.length ? Math.min(...rents) : 0;
  const maxRent = rents.length ? Math.max(...rents) : 0;
  const firstAvailable = availableRooms[0];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-bold text-body">{property.title}</h2>
        {shareActions ? <div className="shrink-0">{shareActions}</div> : null}
      </div>
      <p className="text-2xl font-bold text-slate-900">
        {rents.length > 1
          ? `${money.format(minRent)} - ${money.format(maxRent)} / mes`
          : `${listingHeroPriceLabel(minRent)}`}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HeaderInfoItem emoji="🛏️" label="Cuartos disponibles" value={String(availableRooms.length)} />
        <HeaderInfoItem
          emoji="👥"
          label="Viven aquí"
          value={`${property.occupiedByMenCount ?? 0} Hombres, ${property.occupiedByWomenCount ?? 0} Mujeres`}
        />
        <HeaderInfoItem
          emoji="⚧️"
          label="Preferencia de género"
          value={firstAvailable ? genderPrefLabel(firstAvailable.roommateGenderPref) : "Hombre o Mujer"}
        />
        <HeaderInfoItem
          emoji="📅"
          label="Disponible desde"
          value={firstAvailable ? formatRoomAvailableFrom(firstAvailable.availableFrom ?? "") : "—"}
        />
        <HeaderInfoItem emoji="🏠" label="Tipo de vivienda" value={propertyKindLabel(property.propertyKind)} />
        <HeaderInfoItem emoji="📍" label="Colonia" value={property.neighborhood} />
      </div>
    </div>
  );
}

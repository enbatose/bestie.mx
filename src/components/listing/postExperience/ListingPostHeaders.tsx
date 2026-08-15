import type { LucideIcon } from "lucide-react";
import { BedDouble, Home, Users, VenusAndMars } from "lucide-react";
import type { ReactNode } from "react";
import { listingHeroPriceLabel } from "@/lib/listingTags";
import { genderPrefLabel, propertyKindLabel } from "@/lib/listingKeyLabels";
import type { Property, PropertyListing, Room } from "@/types/listing";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function HeaderInfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
        <p className="text-sm font-medium text-body">{value}</p>
      </div>
    </div>
  );
}

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
}: {
  listing: PropertyListing;
  menCount: number;
  womenCount: number;
  shareActions?: ReactNode;
  title?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <h2 className="min-w-0 flex-1 text-xl font-bold text-body">{title ?? listing.title}</h2>
        {shareActions ? <div className="max-w-[45%] shrink-0 sm:max-w-none">{shareActions}</div> : null}
      </div>
      <HeaderLocationLine neighborhood={listing.neighborhood} city={listing.city} />
      <p className="text-2xl font-bold text-body">{listingHeroPriceLabel(listing.rentMxn)}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HeaderInfoItem icon={Users} label="Viven aquí" value={`${menCount} Hombres, ${womenCount} Mujeres`} />
        <HeaderInfoItem icon={Home} label="Tipo de vivienda" value={propertyKindLabel(listing.propertyKind)} />
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
      <div className="flex min-w-0 items-start justify-between gap-3">
        <h2 className="min-w-0 flex-1 text-xl font-bold text-body">{property.title}</h2>
        {shareActions ? <div className="max-w-[45%] shrink-0 sm:max-w-none">{shareActions}</div> : null}
      </div>
      <HeaderLocationLine neighborhood={property.neighborhood} city={property.city} />
      <p className="text-2xl font-bold text-body">
        {rents.length > 1
          ? `${money.format(minRent)} – ${money.format(maxRent)} / mes`
          : `${listingHeroPriceLabel(minRent)}`}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HeaderInfoItem icon={BedDouble} label="Cuartos disponibles" value={String(availableRooms.length)} />
        <HeaderInfoItem
          icon={Users}
          label="Viven aquí"
          value={`${property.occupiedByMenCount ?? 0} Hombres, ${property.occupiedByWomenCount ?? 0} Mujeres`}
        />
        <HeaderInfoItem
          icon={VenusAndMars}
          label="Preferencia de género"
          value={firstAvailable ? genderPrefLabel(firstAvailable.roommateGenderPref) : "Hombre o Mujer"}
        />
        <HeaderInfoItem icon={Home} label="Tipo de vivienda" value={propertyKindLabel(property.propertyKind)} />
      </div>
    </div>
  );
}

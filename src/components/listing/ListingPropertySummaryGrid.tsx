import type { LucideIcon } from "lucide-react";
import {
  Bath,
  Bed,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  Maximize2,
  User,
  UserRound,
  Users,
  UserCircle2,
  Wallet,
} from "lucide-react";
import {
  formatRoomAvailableFrom,
  LODGING_TYPE_LABELS,
  minimalStayMonthsLabel,
  PROPERTY_KIND_LABELS,
  propertyBedroomsPreviewLabel,
  ROOMMATE_GENDER_PREF_FIELD_LABEL,
  roommateGenderPrefLabel,
  roomAgeRangeLabel,
  roomBathroomPreviewLabel,
  roomDimensionHintLabel,
  roomDimensionPreviewLabel,
  roomPlazasLabel,
  shouldShowRoomPriceInDetails,
} from "@/lib/listingTags";
import type { ListingTag, LodgingType, PropertyKind, RoomDimension, RoommateGenderPref } from "@/types/listing";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

type StatProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  /** Optional secondary description shown below the value in smaller muted text. */
  detail?: string;
};

function ListingDetailStat({ icon: Icon, label, value, detail }: StatProps) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-bg-light p-3.5">
      <Icon className="size-4 shrink-0 text-primary/80" strokeWidth={2} aria-hidden />
      <div>
        <p className="text-[11px] font-medium uppercase leading-snug tracking-wide text-muted">{label}</p>
        <p className="mt-0.5 text-sm font-semibold leading-snug text-body">{value}</p>
        {detail ? (
          <p className="mt-1 text-[11px] leading-snug text-muted">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}

function PropertyRoommatesStat({
  womenCount,
  menCount,
}: {
  womenCount: number;
  menCount: number;
}) {
  return (
    <div className="col-span-2 flex flex-col gap-2.5 rounded-xl border border-border bg-bg-light p-3.5">
      <Users className="size-4 shrink-0 text-primary/80" strokeWidth={2} aria-hidden />
      <div>
        <p className="text-[11px] font-medium uppercase leading-snug tracking-wide text-muted">
          Besties actuales
        </p>
        <p className="text-[11px] text-muted leading-snug">
          Personas que viven actualmente en la propiedad
        </p>
        <p className="mt-2 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-body">
            <UserRound className="size-3.5 text-primary/70" aria-hidden />
            {womenCount} {womenCount === 1 ? "mujer" : "mujeres"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-body">
            <User className="size-3.5 text-primary/70" aria-hidden />
            {menCount} {menCount === 1 ? "hombre" : "hombres"}
          </span>
        </p>
      </div>
    </div>
  );
}

export function ListingPropertySummaryGrid({
  propertyKind,
  propertyBedroomsTotal,
  occupiedByWomenCount,
  occupiedByMenCount,
}: {
  propertyKind: PropertyKind;
  propertyBedroomsTotal: number;
  occupiedByWomenCount?: number | null;
  occupiedByMenCount?: number | null;
}) {
  const womenCount = occupiedByWomenCount ?? 0;
  const menCount = occupiedByMenCount ?? 0;

  return (
    <div className="grid grid-cols-2 gap-4">
      <ListingDetailStat
        icon={Building2}
        label="Tipo de vivienda"
        value={PROPERTY_KIND_LABELS[propertyKind]}
      />
      <ListingDetailStat
        icon={Bed}
        label="Recámaras en la propiedad"
        value={propertyBedroomsPreviewLabel(propertyBedroomsTotal, propertyKind)}
      />
      <PropertyRoommatesStat womenCount={womenCount} menCount={menCount} />
    </div>
  );
}

export type ListingRoomDetailsInput = {
  rentMxn: number;
  depositMxn?: number;
  lodgingType?: LodgingType;
  roomDimension?: RoomDimension;
  tags: readonly ListingTag[];
  availableFrom?: string;
  minimalStayMonths?: number;
  roomsAvailable: number;
  roommateGenderPref: RoommateGenderPref;
  ageMin: number;
  ageMax: number;
};

export function ListingRoomDetailsGrid({
  room,
  postMode,
  roomCount,
}: {
  room: ListingRoomDetailsInput;
  postMode: "room" | "property";
  roomCount: number;
}) {
  const lodgingKey =
    postMode === "room" && room.lodgingType === "whole_home"
      ? "private_room"
      : (room.lodgingType ?? "private_room");

  const showPricing = shouldShowRoomPriceInDetails(postMode, roomCount);
  const stats: StatProps[] = [];

  if (showPricing) {
    stats.push({ icon: DollarSign, label: "Renta", value: money.format(room.rentMxn) });
    if ((room.depositMxn ?? 0) > 0) {
      stats.push({ icon: Wallet, label: "Depósito", value: money.format(room.depositMxn ?? 0) });
    }
  }

  stats.push(
    { icon: Bed, label: "Tipo de espacio", value: LODGING_TYPE_LABELS[lodgingKey] },
    {
      icon: Maximize2,
      label: "Tamaño",
      value: roomDimensionPreviewLabel(room.roomDimension ?? "medium", postMode),
      detail: roomDimensionHintLabel(room.roomDimension ?? "medium", "room"),
    },
    { icon: Bath, label: "Baño", value: roomBathroomPreviewLabel(room.tags) },
    {
      icon: Calendar,
      label: "Disponible desde",
      value: formatRoomAvailableFrom(room.availableFrom ?? ""),
    },
    {
      icon: Clock,
      label: "Estancia mínima",
      value: minimalStayMonthsLabel(room.minimalStayMonths ?? 1),
    },
  );

  if (postMode === "property") {
    stats.push({ icon: Users, label: "Plazas", value: roomPlazasLabel(room.roomsAvailable) });
  }

  stats.push(
    {
      icon: UserCircle2,
      label: ROOMMATE_GENDER_PREF_FIELD_LABEL,
      value: roommateGenderPrefLabel(room.roommateGenderPref),
    },
    { icon: UserRound, label: "Edades", value: roomAgeRangeLabel(room.ageMin, room.ageMax) },
  );

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <ListingDetailStat key={stat.label} {...stat} />
      ))}
    </div>
  );
}

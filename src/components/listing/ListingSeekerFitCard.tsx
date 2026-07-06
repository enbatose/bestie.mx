import type { LucideIcon } from "lucide-react";
import {
  Bath,
  Bed,
  Calendar,
  Clock,
  DollarSign,
  Maximize2,
  UserCircle2,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import {
  formatRoomAvailableFrom,
  LODGING_TYPE_LABELS,
  minimalStayMonthsLabel,
  previewRoomOccupantsBadgeLabel,
  roommateGenderPrefLabel,
  roomAgeRangeLabel,
  roomBathroomPreviewLabel,
  roomDimensionPreviewLabel,
} from "@/lib/listingTags";
import type { ListingTag, LodgingType, RoomDimension, RoommateGenderPref } from "@/types/listing";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

type FitItem = {
  icon: LucideIcon;
  label: string;
  value: string;
  highlight?: boolean;
};

function FitStat({ icon: Icon, label, value, highlight }: FitItem) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border p-3.5 ${
        highlight ? "border-primary/25 bg-primary/5" : "border-border bg-bg-light"
      }`}
    >
      <Icon
        className={`size-4 shrink-0 ${highlight ? "text-primary" : "text-primary/80"}`}
        strokeWidth={2}
        aria-hidden
      />
      <div>
        <p className="text-[11px] font-medium uppercase leading-snug tracking-wide text-muted">{label}</p>
        <p className="mt-0.5 text-sm font-semibold leading-snug text-body">{value}</p>
      </div>
    </div>
  );
}

function occupantsPlainLabel(
  menCount: number | null | undefined,
  womenCount: number | null | undefined,
): string | null {
  const raw = previewRoomOccupantsBadgeLabel(menCount, womenCount);
  if (!raw) return null;
  return raw.replace(/^Viven aquí:\s*/, "");
}

export function ListingSeekerFitCard({
  rentMxn,
  depositMxn,
  postMode,
  lodgingType,
  roomDimension,
  roomsAvailable,
  tags,
  availableFrom,
  minimalStayMonths,
  roommateGenderPref,
  ageMin,
  ageMax,
  occupiedByWomenCount,
  occupiedByMenCount,
}: {
  rentMxn: number;
  depositMxn: number;
  postMode: "room" | "property";
  lodgingType?: LodgingType;
  roomDimension?: RoomDimension;
  roomsAvailable?: number;
  tags: readonly ListingTag[];
  availableFrom?: string;
  minimalStayMonths?: number;
  roommateGenderPref: RoommateGenderPref;
  ageMin: number;
  ageMax: number;
  occupiedByWomenCount?: number | null;
  occupiedByMenCount?: number | null;
}) {
  const lodgingKey =
    postMode === "room" && lodgingType === "whole_home" ? "private_room" : (lodgingType ?? "private_room");

  const occupants = occupantsPlainLabel(occupiedByMenCount, occupiedByWomenCount);

  const items: FitItem[] = [
    { icon: DollarSign, label: "Renta mensual", value: money.format(rentMxn), highlight: true },
  ];

  if (depositMxn > 0) {
    items.push({ icon: Wallet, label: "Depósito", value: money.format(depositMxn) });
  }

  if (occupants) {
    items.push({ icon: Users, label: "Quién vive aquí", value: occupants, highlight: true });
  }

  items.push(
    {
      icon: UserCircle2,
      label: "Buscan",
      value: roommateGenderPrefLabel(roommateGenderPref),
      highlight: true,
    },
    { icon: UserRound, label: "Rango de edad", value: roomAgeRangeLabel(ageMin, ageMax) },
    {
      icon: Calendar,
      label: "Disponible desde",
      value: formatRoomAvailableFrom(availableFrom ?? ""),
    },
    {
      icon: Clock,
      label: "Estancia mínima",
      value: minimalStayMonthsLabel(minimalStayMonths ?? 1),
    },
    { icon: Bed, label: "Tipo de espacio", value: LODGING_TYPE_LABELS[lodgingKey] },
  );

  if (roomDimension) {
    items.push({
      icon: Maximize2,
      label: "Tamaño",
      value: roomDimensionPreviewLabel(roomDimension, postMode),
    });
  }

  if (postMode === "property" && roomsAvailable != null) {
    items.push({
      icon: Users,
      label: "Plazas disponibles",
      value: `${roomsAvailable} ${roomsAvailable === 1 ? "plaza" : "plazas"}`,
    });
  }

  items.push({ icon: Bath, label: "Baño", value: roomBathroomPreviewLabel(tags) });

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-body">¿Te encaja?</h2>
      <p className="mt-1 text-sm text-muted">Lo esencial para saber si este cuarto puede funcionar para ti.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        {items.map((item) => (
          <FitStat key={item.label} {...item} />
        ))}
      </div>
    </section>
  );
}

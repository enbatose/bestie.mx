import type { LucideIcon } from "lucide-react";
import {
  Bath,
  Bed,
  Calendar,
  Car,
  CheckCircle2,
  Cigarette,
  DollarSign,
  Home,
  KeyRound,
  PawPrint,
  ShieldCheck,
  Sparkles,
  SquareStack,
  Timer,
  UserCheck,
  Users,
  Warehouse,
} from "lucide-react";
import { listingTagLabel } from "@/components/listing/ListingTagChips";
import {
  filterPropertyScopeTags,
  formatRoomAvailableFrom,
  minimalStayMonthsLabel,
  ROOM_IDEAL_PARA_TAG_SET,
  utilitiesBundleSatisfied,
} from "@/lib/listingTags";
import type { ListingTag, Property, PropertyListing, Room, RoommateGenderPref } from "@/types/listing";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export const KEY_LABEL_ROOM_TAG_SLUGS = new Set<ListingTag>([
  "baño-privado",
  "estacionamiento",
  "estudiantes",
  "individuos-solo",
]);

export type KeyLabelItem = {
  icon: LucideIcon;
  title: string;
  value: string;
};

export function yesNo(v: boolean): string {
  return v ? "Sí" : "No";
}

export function genderPrefLabel(pref: RoommateGenderPref): string {
  if (pref === "female") return "Mujer";
  if (pref === "male") return "Hombre";
  return "Hombre o Mujer";
}

export function lodgingLabel(v: PropertyListing["lodgingType"]): string {
  return v === "shared_room" ? "Recámara compartida" : "Recámara privada";
}

export function propertyKindLabel(v: Property["propertyKind"] | PropertyListing["propertyKind"]): string {
  if (v === "apartment") return "Departamento";
  if (v === "loft") return "Loft";
  return "Casa";
}

export function roomDimensionWizardLabel(
  v: Room["roomDimension"] | PropertyListing["roomDimension"],
): string {
  if (v === "small") return "Individual (Cabe cama individual + buró)";
  if (v === "large") return "Grande (Cabe cama Queen/King + área de estar)";
  return "Matrimonial (Cabe cama matrimonial + escritorio)";
}

export function occupiedRoomOccupantLabel(room: Room): string {
  const women = Math.max(0, Math.floor(room.occupantWomenCount ?? 0));
  const men = Math.max(0, Math.floor(room.occupantMenCount ?? 0));
  const parts: string[] = [];
  if (men > 0) parts.push(`${men} ${men === 1 ? "Hombre" : "Hombres"}`);
  if (women > 0) parts.push(`${women} ${women === 1 ? "Mujer" : "Mujeres"}`);
  if (!parts.length) return "Ocupado";
  return `Ocupado por ${parts.join(" y ")}`;
}

export function idealParaKeyLabel(tags: readonly ListingTag[]): string {
  const ideal = tags.filter((tag) => ROOM_IDEAL_PARA_TAG_SET.has(tag));
  return ideal.length ? ideal.map((tag) => listingTagLabel(tag)).join(", ") : "—";
}

export function propertyAmenityKeyLabel(propertyTags: readonly ListingTag[]): string {
  const labels = ["lavadora", "secadora", "cocina-equipada", "wifi"]
    .filter((tag) => propertyTags.includes(tag as ListingTag))
    .map((tag) => listingTagLabel(tag as ListingTag));
  return labels.length ? labels.join(", ") : "—";
}

export function mergePropertyScopeTagsFromRooms(rooms: readonly Room[]): ListingTag[] {
  const set = new Set<ListingTag>();
  for (const room of rooms) {
    for (const tag of filterPropertyScopeTags(room.tags ?? [])) {
      set.add(tag);
    }
  }
  return [...set];
}

export function basicServicesIncludedLabel(tags: readonly ListingTag[]): string {
  return yesNo(tags.includes("servicios-incluidos") || utilitiesBundleSatisfied(tags));
}

export function buildSingleRoomKeyLabels(listing: PropertyListing): KeyLabelItem[] {
  return [
    { icon: DollarSign, title: "Depósito", value: money.format(listing.depositMxn ?? 0) },
    { icon: UserCheck, title: "Preferencia de género", value: genderPrefLabel(listing.roommateGenderPref) },
    {
      icon: Calendar,
      title: "Disponible desde",
      value: formatRoomAvailableFrom(listing.availableFrom ?? ""),
    },
    {
      icon: Timer,
      title: "Estancia mínima",
      value: minimalStayMonthsLabel(listing.minimalStayMonths ?? 1),
    },
    { icon: SquareStack, title: "Tamaño", value: roomDimensionWizardLabel(listing.roomDimension) },
    { icon: KeyRound, title: "Aval", value: yesNo(Boolean(listing.avalRequired)) },
    { icon: Bed, title: "Tipo de recámara", value: lodgingLabel(listing.lodgingType) },
    { icon: CheckCircle2, title: "Servicios básicos incluidos", value: basicServicesIncludedLabel(listing.tags) },
    { icon: Users, title: "Edades", value: `${listing.ageMin} - ${listing.ageMax}` },
    { icon: Bath, title: "Baño privado", value: yesNo(listing.tags.includes("baño-privado")) },
    { icon: Car, title: "Estacionamiento incluido", value: yesNo(listing.tags.includes("estacionamiento")) },
    { icon: Sparkles, title: "Ideal para", value: idealParaKeyLabel(listing.tags) },
  ];
}

export function buildRoomKeyLabels(room: Room): KeyLabelItem[] {
  return [
    { icon: DollarSign, title: "Depósito", value: money.format(room.depositMxn ?? 0) },
    { icon: UserCheck, title: "Preferencia de género", value: genderPrefLabel(room.roommateGenderPref) },
    {
      icon: Calendar,
      title: "Disponible desde",
      value: formatRoomAvailableFrom(room.availableFrom ?? ""),
    },
    {
      icon: Timer,
      title: "Estancia mínima",
      value: minimalStayMonthsLabel(room.minimalStayMonths ?? 1),
    },
    { icon: SquareStack, title: "Tamaño", value: roomDimensionWizardLabel(room.roomDimension) },
    { icon: KeyRound, title: "Aval", value: yesNo(Boolean(room.avalRequired)) },
    { icon: Bed, title: "Tipo de recámara", value: lodgingLabel(room.lodgingType) },
    { icon: CheckCircle2, title: "Servicios básicos incluidos", value: basicServicesIncludedLabel(room.tags) },
    { icon: Users, title: "Edades", value: `${room.ageMin} - ${room.ageMax}` },
    { icon: Bath, title: "Baño privado", value: yesNo(room.tags.includes("baño-privado")) },
    { icon: Car, title: "Estacionamiento incluido", value: yesNo(room.tags.includes("estacionamiento")) },
    { icon: Sparkles, title: "Ideal para", value: idealParaKeyLabel(room.tags) },
  ];
}

export function buildPropertyKeyLabels(
  propertyTags: readonly ListingTag[],
  availableRooms: readonly Room[],
): KeyLabelItem[] {
  return [
    {
      icon: Calendar,
      title: "Disponible desde",
      value: availableRooms[0] ? formatRoomAvailableFrom(availableRooms[0].availableFrom ?? "") : "—",
    },
    { icon: PawPrint, title: "Mascotas", value: yesNo(propertyTags.includes("mascotas")) },
    { icon: Users, title: "Fiestas", value: yesNo(propertyTags.includes("fiestas")) },
    { icon: Cigarette, title: "Fumar en áreas comunes", value: yesNo(propertyTags.includes("fumar")) },
    {
      icon: Warehouse,
      title: "La propiedad cuenta con",
      value: propertyAmenityKeyLabel(propertyTags),
    },
    {
      icon: ShieldCheck,
      title: "Seguridad / Acceso Controlado",
      value: yesNo(propertyTags.includes("seguridad-acceso")),
    },
    { icon: Home, title: "Vigilancia o portería", value: yesNo(propertyTags.includes("vigilancia")) },
  ];
}

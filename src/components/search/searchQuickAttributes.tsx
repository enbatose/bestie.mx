import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  Bath,
  Building2,
  CarFront,
  DoorClosed,
  House,
  SlidersHorizontal,
  UsersRound,
  Venus,
  Warehouse,
} from "lucide-react";
import type { SearchFilters } from "@/lib/searchFilters";
import type { ListingTag, PropertyKind, PropertyListing } from "@/types/listing";

export type SearchQuickAttribute = {
  id: string;
  label: string;
  tooltip: string;
  icon: LucideIcon;
};

type SearchQuickFilterDefinition = SearchQuickAttribute & {
  isActive: (filters: SearchFilters) => boolean;
  toggle: (filters: SearchFilters) => SearchFilters;
};

const PROPERTY_TYPE_META: Record<PropertyKind, SearchQuickAttribute> = {
  house: {
    id: "property-house",
    label: "Casa",
    tooltip: "Propiedad tipo casa",
    icon: House,
  },
  apartment: {
    id: "property-apartment",
    label: "Depa",
    tooltip: "Propiedad tipo departamento",
    icon: Building2,
  },
  loft: {
    id: "property-loft",
    label: "Loft",
    tooltip: "Propiedad tipo loft",
    icon: Warehouse,
  },
};

const ROOM_TYPE_META = {
  private_room: {
    id: "room-private",
    label: "Privado",
    tooltip: "Recámara privada",
    icon: DoorClosed,
  },
  shared_room: {
    id: "room-shared",
    label: "Compartido",
    tooltip: "Recámara compartida",
    icon: UsersRound,
  },
} as const satisfies Record<string, SearchQuickAttribute>;

const GENDER_META = {
  female: {
    id: "gender-female",
    label: "Mujeres",
    tooltip: "Solo mujeres",
    icon: Venus,
  },
  any: {
    id: "gender-mixed",
    label: "Mixto",
    tooltip: "Acepta convivencia mixta o grupal",
    icon: UsersRound,
  },
} as const satisfies Record<string, SearchQuickAttribute>;

const PRIVATE_BATHROOM_META: SearchQuickAttribute = {
  id: "private-bathroom",
  label: "Baño",
  tooltip: "Incluye baño privado",
  icon: Bath,
};

const PRIVATE_PARKING_META: SearchQuickAttribute = {
  id: "private-parking",
  label: "Cochera",
  tooltip: "Incluye cochera o estacionamiento privado",
  icon: CarFront,
};

const FURNISHED_META: SearchQuickAttribute = {
  id: "furnished",
  label: "Amueblado",
  tooltip: "Recámara amueblada",
  icon: Armchair,
};

function withTagToggle(filters: SearchFilters, tag: ListingTag): SearchFilters {
  const tags = filters.tags.includes(tag)
    ? filters.tags.filter((current) => current !== tag)
    : [...filters.tags, tag];
  return { ...filters, tags };
}

export const ADVANCED_FILTERS_META: SearchQuickAttribute = {
  id: "advanced-filters",
  label: "Avanzado",
  tooltip: "Abrir filtros avanzados",
  icon: SlidersHorizontal,
};

export const MAP_QUICK_FILTERS: readonly SearchQuickFilterDefinition[] = [
  {
    ...ROOM_TYPE_META.private_room,
    isActive: (filters) => filters.lodgingType === "private_room",
    toggle: (filters) => ({
      ...filters,
      lodgingType: filters.lodgingType === "private_room" ? null : "private_room",
    }),
  },
  {
    ...GENDER_META.female,
    isActive: (filters) => filters.pref === "female",
    toggle: (filters) => ({ ...filters, pref: filters.pref === "female" ? null : "female" }),
  },
  {
    ...PRIVATE_BATHROOM_META,
    isActive: (filters) => filters.tags.includes("baño-privado"),
    toggle: (filters) => withTagToggle(filters, "baño-privado"),
  },
  {
    ...PRIVATE_PARKING_META,
    isActive: (filters) => filters.tags.includes("estacionamiento"),
    toggle: (filters) => withTagToggle(filters, "estacionamiento"),
  },
  {
    ...FURNISHED_META,
    isActive: (filters) => filters.tags.includes("muebles"),
    toggle: (filters) => withTagToggle(filters, "muebles"),
  },
] as const;

export const ADVANCED_TAG_FILTERS: readonly ListingTag[] = [
  "baño-privado",
  "estacionamiento",
  "muebles",
  "aire-acondicionado",
  "mascotas",
  "lgbt-friendly",
  "parejas",
  "fumar-permitido-recamara",
] as const;

export function listingCardQuickAttributes(listing: PropertyListing): SearchQuickAttribute[] {
  const items: SearchQuickAttribute[] = [];

  if (listing.propertyKind) {
    items.push(PROPERTY_TYPE_META[listing.propertyKind]);
  }

  if (listing.lodgingType === "private_room" || listing.lodgingType === "shared_room") {
    items.push(ROOM_TYPE_META[listing.lodgingType]);
  }

  if (listing.roommateGenderPref === "female") {
    items.push(GENDER_META.female);
  } else if (listing.roommateGenderPref === "any") {
    items.push(GENDER_META.any);
  }

  if (listing.tags.includes("baño-privado")) {
    items.push(PRIVATE_BATHROOM_META);
  }

  if (listing.tags.includes("estacionamiento")) {
    items.push(PRIVATE_PARKING_META);
  }

  if (listing.tags.includes("muebles")) {
    items.push(FURNISHED_META);
  }

  return items;
}

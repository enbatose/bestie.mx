import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  Bath,
  Building2,
  CarFront,
  DoorClosed,
  House,
  Mars,
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
  mobileLabel?: string;
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
    mobileLabel: "Cuarto Privado",
    tooltip: "Buscar cuarto privado",
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
    mobileLabel: "Soy Mujer",
    tooltip: "Buscar opciones para mujer",
    icon: Venus,
  },
  male: {
    id: "gender-male",
    label: "Hombres",
    mobileLabel: "Soy Hombre",
    tooltip: "Buscar opciones para hombre",
    icon: Mars,
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
  mobileLabel: "Baño Privado",
  tooltip: "Solo publicaciones con baño privado",
  icon: Bath,
};

const PRIVATE_PARKING_META: SearchQuickAttribute = {
  id: "private-parking",
  label: "Cochera",
  mobileLabel: "Cochera Incluida",
  tooltip: "Solo publicaciones con cochera incluida",
  icon: CarFront,
};

const FURNISHED_META: SearchQuickAttribute = {
  id: "furnished",
  label: "Amueblado",
  mobileLabel: "Cuarto Amueblado",
  tooltip: "Solo publicaciones con cuarto amueblado",
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
  mobileLabel: "Mas filtros",
  tooltip: "Abrir filtros avanzados",
  icon: SlidersHorizontal,
};

const PRIVATE_ROOM_FILTER: SearchQuickFilterDefinition = {
  ...ROOM_TYPE_META.private_room,
  isActive: (filters) => filters.lodgingType === "private_room",
  toggle: (filters) => ({
    ...filters,
    lodgingType: filters.lodgingType === "private_room" ? null : "private_room",
  }),
};

const LOFT_FILTER: SearchQuickFilterDefinition = {
  ...PROPERTY_TYPE_META.loft,
  mobileLabel: "Busco Loft",
  tooltip: "Buscar publicaciones tipo loft",
  isActive: (filters) => filters.wantLoft,
  toggle: (filters) => ({ ...filters, wantLoft: !filters.wantLoft }),
};

const FEMALE_FILTER: SearchQuickFilterDefinition = {
  ...GENDER_META.female,
  isActive: (filters) => filters.pref === "female",
  toggle: (filters) => ({ ...filters, pref: filters.pref === "female" ? null : "female" }),
};

const MALE_FILTER: SearchQuickFilterDefinition = {
  ...GENDER_META.male,
  isActive: (filters) => filters.pref === "male",
  toggle: (filters) => ({ ...filters, pref: filters.pref === "male" ? null : "male" }),
};

const PRIVATE_BATHROOM_FILTER: SearchQuickFilterDefinition = {
  ...PRIVATE_BATHROOM_META,
  isActive: (filters) => filters.tags.includes("baño-privado"),
  toggle: (filters) => withTagToggle(filters, "baño-privado"),
};

const PRIVATE_PARKING_FILTER: SearchQuickFilterDefinition = {
  ...PRIVATE_PARKING_META,
  isActive: (filters) => filters.tags.includes("estacionamiento"),
  toggle: (filters) => withTagToggle(filters, "estacionamiento"),
};

const FURNISHED_FILTER: SearchQuickFilterDefinition = {
  ...FURNISHED_META,
  isActive: (filters) => filters.tags.includes("muebles"),
  toggle: (filters) => withTagToggle(filters, "muebles"),
};

export const MOBILE_MAP_QUICK_FILTERS: readonly SearchQuickFilterDefinition[] = [
  PRIVATE_ROOM_FILTER,
  LOFT_FILTER,
  FEMALE_FILTER,
  MALE_FILTER,
  PRIVATE_BATHROOM_FILTER,
  PRIVATE_PARKING_FILTER,
  FURNISHED_FILTER,
] as const;

export const MAP_QUICK_FILTERS: readonly SearchQuickFilterDefinition[] = [
  {
    ...PRIVATE_ROOM_FILTER,
  },
  {
    ...FEMALE_FILTER,
  },
  {
    ...PRIVATE_BATHROOM_FILTER,
  },
  {
    ...PRIVATE_PARKING_FILTER,
  },
  {
    ...FURNISHED_FILTER,
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
  } else if (listing.roommateGenderPref === "male") {
    items.push(GENDER_META.male);
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

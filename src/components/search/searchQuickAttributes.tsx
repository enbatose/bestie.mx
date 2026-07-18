import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  Bath,
  BedSingle,
  Building2,
  CarFront,
  Cigarette,
  DoorClosed,
  House,
  PawPrint,
  SlidersHorizontal,
  Users,
  Warehouse,
  Wind,
} from "lucide-react";
import { LgbtTextIcon } from "@/components/icons/LgbtTextIcon";
import { PlusOneIcon } from "@/components/icons/PlusOneIcon";
import {
  GenderMixedIcon,
  HighHeelIcon,
  MustacheIcon,
} from "@/components/icons/GenderFilterIcons";
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

export const PROPERTY_TYPE_META: Record<PropertyKind, SearchQuickAttribute> = {
  house: {
    id: "property-house",
    label: "Casa",
    tooltip: "Casa",
    icon: House,
  },
  apartment: {
    id: "property-apartment",
    label: "Depa",
    tooltip: "Departamento",
    icon: Building2,
  },
  loft: {
    id: "property-loft",
    label: "Loft",
    tooltip: "Propiedad tipo loft",
    icon: Warehouse,
  },
};

export const ROOM_TYPE_META = {
  private_room: {
    id: "room-private",
    label: "Privado",
    mobileLabel: "Cuarto Privado",
    tooltip: "Cuarto Privado",
    icon: DoorClosed,
  },
  shared_room: {
    id: "room-shared",
    label: "Compartido",
    tooltip: "Recámara Compartida",
    icon: PlusOneIcon,
  },
} as const satisfies Record<string, SearchQuickAttribute>;

const GENDER_META = {
  female: {
    id: "gender-female",
    label: "Mujeres",
    mobileLabel: "Soy Mujer",
    tooltip: "Solo Mujeres",
    icon: HighHeelIcon,
  },
  male: {
    id: "gender-male",
    label: "Hombres",
    mobileLabel: "Soy Hombre",
    tooltip: "Solo Hombres",
    icon: MustacheIcon,
  },
  any: {
    id: "gender-mixed",
    label: "Mixto",
    tooltip: "Hombre o Mujer",
    icon: GenderMixedIcon,
  },
} as const satisfies Record<string, SearchQuickAttribute>;

const PRIVATE_BATHROOM_META: SearchQuickAttribute = {
  id: "private-bathroom",
  label: "Baño",
  mobileLabel: "Baño Privado",
  tooltip: "Baño Privado",
  icon: Bath,
};

const PRIVATE_PARKING_META: SearchQuickAttribute = {
  id: "private-parking",
  label: "Cochera",
  mobileLabel: "Cochera Incluida",
  tooltip: "Cochera Incluida",
  icon: CarFront,
};

const FURNISHED_META: SearchQuickAttribute = {
  id: "furnished",
  label: "Amueblado",
  mobileLabel: "Cuarto Amueblado",
  tooltip: "Recámara Amueblada",
  icon: Armchair,
};

const PETS_META: SearchQuickAttribute = {
  id: "tag-mascotas",
  label: "Mascotas",
  mobileLabel: "Aceptan Mascotas",
  tooltip: "Aceptan Mascotas",
  icon: PawPrint,
};

const LGBT_META: SearchQuickAttribute = {
  id: "tag-lgbt-friendly",
  label: "LGBT+",
  mobileLabel: "Comunidad LGBT+",
  tooltip: "LGBT+ Friendly",
  icon: LgbtTextIcon,
};

const AC_META: SearchQuickAttribute = {
  id: "tag-aire-acondicionado",
  label: "Aire ac.",
  mobileLabel: "Aire Acondicionado",
  tooltip: "Aire acondicionado",
  icon: Wind,
};

const COUPLES_META: SearchQuickAttribute = {
  id: "tag-parejas",
  label: "Parejas",
  mobileLabel: "Acepta Parejas",
  tooltip: "Acepta parejas",
  icon: Users,
};

const SMOKING_META: SearchQuickAttribute = {
  id: "tag-fumar-permitido-recamara",
  label: "Fumar",
  mobileLabel: "Fumar en la Recámara",
  tooltip: "Permitido fumar en la recámara",
  icon: Cigarette,
};

/** "Recámara" hospedaje option: rent just a room, not a whole property. Not a `PropertyKind`. */
export const RECAMARA_META: SearchQuickAttribute = {
  id: "hospedaje-recamara",
  label: "Recámara",
  mobileLabel: "Busco Recámara",
  tooltip: "Busco una recámara, no una propiedad completa",
  icon: BedSingle,
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
  mobileLabel: "Más filtros",
  tooltip: "Filtros Avanzados",
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
  tooltip: "Loft",
  isActive: (filters) => filters.wantLoft,
  toggle: (filters) => ({ ...filters, wantLoft: !filters.wantLoft }),
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

const PETS_FILTER: SearchQuickFilterDefinition = {
  ...PETS_META,
  isActive: (filters) => filters.tags.includes("mascotas"),
  toggle: (filters) => withTagToggle(filters, "mascotas"),
};

const LGBT_FILTER: SearchQuickFilterDefinition = {
  ...LGBT_META,
  isActive: (filters) => filters.tags.includes("lgbt-friendly"),
  toggle: (filters) => withTagToggle(filters, "lgbt-friendly"),
};

export const MOBILE_MAP_QUICK_FILTERS: readonly SearchQuickFilterDefinition[] = [
  PRIVATE_ROOM_FILTER,
  LOFT_FILTER,
  PETS_FILTER,
  LGBT_FILTER,
  PRIVATE_BATHROOM_FILTER,
  PRIVATE_PARKING_FILTER,
  FURNISHED_FILTER,
] as const;

export const MAP_QUICK_FILTERS: readonly SearchQuickFilterDefinition[] = [
  {
    ...PRIVATE_ROOM_FILTER,
  },
  {
    ...PETS_FILTER,
  },
  {
    ...LGBT_FILTER,
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

/** Icon + tooltip metadata for every tag shown in the "Detalles del anuncio" advanced filter group. */
export const ADVANCED_TAG_META: Partial<Record<ListingTag, SearchQuickAttribute>> = {
  "baño-privado": PRIVATE_BATHROOM_META,
  estacionamiento: PRIVATE_PARKING_META,
  muebles: FURNISHED_META,
  "aire-acondicionado": AC_META,
  mascotas: PETS_META,
  "lgbt-friendly": LGBT_META,
  parejas: COUPLES_META,
  "fumar-permitido-recamara": SMOKING_META,
};

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

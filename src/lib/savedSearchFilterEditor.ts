import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import {
  Banknote,
  Bed,
  BedDouble,
  BedSingle,
  Building2,
  Calendar,
  CalendarClock,
  DoorClosed,
  House,
  Tag,
  UserRound,
  Warehouse,
} from "lucide-react";
import { ADVANCED_TAG_FILTERS, ADVANCED_TAG_META } from "@/components/search/searchQuickAttributes";
import { PlusOneIcon } from "@/components/icons/PlusOneIcon";
import { HighHeelIcon, MustacheIcon } from "@/components/icons/GenderFilterIcons";
import { isoDateTodayMexicoCity } from "@/lib/dateUtils";
import { activeSearchFilterChips } from "@/lib/searchActiveFilterChips";
import { horizontalBarFilterRows } from "@/lib/horizontalBarFilters";
import { TAG_LABELS, type SearchFilters } from "@/lib/searchFilters";
import type { SearchLocationState } from "@/lib/searchLocation";
import type { ListingTag, RoomDimension } from "@/types/listing";

/** Accepts both lucide's forwardRef icons and the app's plain-function tinted icon components. */
export type FilterIcon = ComponentType<LucideProps>;

export type EditableFilterChip = {
  id: string;
  label: string;
  icon: FilterIcon;
  /** False for chips that describe where you're searching (city/neighborhoods) rather than a toggleable filter. */
  removable: boolean;
};

/**
 * Every currently active filter as a single, flat, removable-chip list — merges the header bar
 * (Renta/Género/Edad), the quick-filter rail, the advanced sheet, and location, so nothing is missed
 * regardless of which UI surface it was set from.
 */
export function editableActiveFilterChips(
  filters: SearchFilters,
  searchLocation: Pick<SearchLocationState, "cityLabel" | "neighborhoods">,
): EditableFilterChip[] {
  const chips: EditableFilterChip[] = [];

  for (const row of horizontalBarFilterRows(filters)) {
    if (!row.active) continue;
    chips.push({ id: row.id, label: `${row.label}: ${row.value}`, icon: row.icon, removable: true });
  }

  for (const chip of activeSearchFilterChips(filters, searchLocation)) {
    chips.push({
      id: chip.id,
      label: chip.label,
      icon: chip.icon,
      removable: !chip.id.startsWith("location-"),
    });
  }

  return chips;
}

/** Clears whatever filter field a given active-chip id represents. No-op for non-removable (location) chips. */
export function removeActiveFilterChip(id: string, filters: SearchFilters): SearchFilters {
  if (id === "horizontal-rent") return { ...filters, budgetMin: null, budgetMax: null };
  if (id === "horizontal-gender") return { ...filters, pref: null };
  if (id === "horizontal-age") return { ...filters, age: null, ageMin: null, ageMax: null };
  if (id === "map-bbox") return { ...filters, bbox: null };
  if (id === "property-house") return { ...filters, wantHouse: false };
  if (id === "property-apartment") return { ...filters, wantApartment: false };
  if (id === "property-loft") return { ...filters, wantLoft: false };
  if (id === "room-private") {
    return { ...filters, lodgingType: filters.lodgingType === "private_room" ? null : filters.lodgingType };
  }
  if (id === "private-bathroom") return { ...filters, tags: filters.tags.filter((t) => t !== "baño-privado") };
  if (id === "private-parking") return { ...filters, tags: filters.tags.filter((t) => t !== "estacionamiento") };
  if (id === "furnished") return { ...filters, tags: filters.tags.filter((t) => t !== "muebles") };
  if (id.startsWith("lodging-")) return { ...filters, lodgingType: null };
  if (id.startsWith("tag-")) {
    const tag = id.slice("tag-".length) as ListingTag;
    return { ...filters, tags: filters.tags.filter((t) => t !== tag) };
  }
  if (id.startsWith("room-dim-")) {
    const dim = id.slice("room-dim-".length) as RoomDimension;
    return { ...filters, roomDimensions: filters.roomDimensions.filter((d) => d !== dim) };
  }
  if (id === "available-from") return { ...filters, availableFrom: null };
  if (id === "min-stay") return { ...filters, minimalStayMonths: null };
  if (id === "aval-yes" || id === "aval-no") return { ...filters, avalRequired: null };
  if (id === "sublet-yes" || id === "sublet-no") return { ...filters, subletAllowed: null };
  return filters;
}

export type AddableFilterOption = {
  id: string;
  group: string;
  label: string;
  icon?: FilterIcon;
  isActive: (f: SearchFilters) => boolean;
  activate: (f: SearchFilters) => SearchFilters;
};

function addRoomDimension(current: RoomDimension[], value: RoomDimension): RoomDimension[] {
  return current.includes(value) ? current : [...current, value];
}

function addTag(current: readonly ListingTag[], tag: ListingTag): ListingTag[] {
  return current.includes(tag) ? [...current] : [...current, tag];
}

/**
 * Every filter value that can be searched for and added from "Encuentra tu filtro". Location
 * (city/neighborhoods/map area) is intentionally excluded — those describe *where* you're
 * searching and are only editable elsewhere, not as an addable filter here.
 */
export const ADDABLE_FILTER_CATALOG: readonly AddableFilterOption[] = [
  {
    id: "budget-max",
    group: "Presupuesto",
    label: "Renta",
    icon: Banknote,
    isActive: (f) => f.budgetMax != null || f.budgetMin != null,
    activate: (f) => ({ ...f, budgetMin: null, budgetMax: f.budgetMax ?? 6000 }),
  },
  {
    id: "age",
    group: "Presupuesto",
    label: "Edad",
    icon: UserRound,
    isActive: (f) => f.age != null || f.ageMin != null || f.ageMax != null,
    activate: (f) => ({ ...f, age: f.age ?? 27, ageMin: null, ageMax: null }),
  },
  {
    id: "gender-female",
    group: "Convivencia",
    label: "Sólo chicas",
    icon: HighHeelIcon,
    isActive: (f) => f.pref === "female",
    activate: (f) => ({ ...f, pref: "female" }),
  },
  {
    id: "gender-male",
    group: "Convivencia",
    label: "Sólo chicos",
    icon: MustacheIcon,
    isActive: (f) => f.pref === "male",
    activate: (f) => ({ ...f, pref: "male" }),
  },
  ...ADVANCED_TAG_FILTERS.map(
    (tag): AddableFilterOption => ({
      id: `tag-${tag}`,
      group: "Convivencia",
      label: TAG_LABELS[tag],
      icon: tag === "lgbt-friendly" ? undefined : ADVANCED_TAG_META[tag]?.icon,
      isActive: (f) => f.tags.includes(tag),
      activate: (f) => ({ ...f, tags: addTag(f.tags, tag) }),
    }),
  ),
  {
    id: "property-house",
    group: "Propiedad",
    label: "Casa",
    icon: House,
    isActive: (f) => f.wantHouse,
    activate: (f) => ({ ...f, wantHouse: true }),
  },
  {
    id: "property-apartment",
    group: "Propiedad",
    label: "Depa",
    icon: Building2,
    isActive: (f) => f.wantApartment,
    activate: (f) => ({ ...f, wantApartment: true }),
  },
  {
    id: "property-loft",
    group: "Propiedad",
    label: "Loft",
    icon: Warehouse,
    isActive: (f) => f.wantLoft,
    activate: (f) => ({ ...f, wantLoft: true }),
  },
  {
    id: "room-private",
    group: "Propiedad",
    label: "Cuarto privado",
    icon: DoorClosed,
    isActive: (f) => f.lodgingType === "private_room",
    activate: (f) => ({ ...f, lodgingType: "private_room" }),
  },
  {
    id: "lodging-shared_room",
    group: "Propiedad",
    label: "Cuarto compartido",
    icon: PlusOneIcon,
    isActive: (f) => f.lodgingType === "shared_room",
    activate: (f) => ({ ...f, lodgingType: "shared_room" }),
  },
  {
    id: "room-dim-small",
    group: "Condiciones",
    label: "Tamaño: Individual",
    icon: BedSingle,
    isActive: (f) => f.roomDimensions.includes("small"),
    activate: (f) => ({ ...f, roomDimensions: addRoomDimension(f.roomDimensions, "small") }),
  },
  {
    id: "room-dim-medium",
    group: "Condiciones",
    label: "Tamaño: Matrimonial",
    icon: BedDouble,
    isActive: (f) => f.roomDimensions.includes("medium"),
    activate: (f) => ({ ...f, roomDimensions: addRoomDimension(f.roomDimensions, "medium") }),
  },
  {
    id: "room-dim-large",
    group: "Condiciones",
    label: "Tamaño: Grande",
    icon: Bed,
    isActive: (f) => f.roomDimensions.includes("large"),
    activate: (f) => ({ ...f, roomDimensions: addRoomDimension(f.roomDimensions, "large") }),
  },
  {
    id: "available-from",
    group: "Condiciones",
    label: "Disponible desde",
    icon: Calendar,
    isActive: (f) => f.availableFrom != null,
    activate: (f) => ({ ...f, availableFrom: f.availableFrom ?? isoDateTodayMexicoCity() }),
  },
  {
    id: "min-stay",
    group: "Condiciones",
    label: "Estancia mínima",
    icon: CalendarClock,
    isActive: (f) => f.minimalStayMonths != null,
    activate: (f) => ({ ...f, minimalStayMonths: f.minimalStayMonths ?? 6 }),
  },
  {
    id: "aval-yes",
    group: "Condiciones",
    label: "Requiere aval",
    icon: Tag,
    isActive: (f) => f.avalRequired === true,
    activate: (f) => ({ ...f, avalRequired: true }),
  },
  {
    id: "aval-no",
    group: "Condiciones",
    label: "Sin aval",
    icon: Tag,
    isActive: (f) => f.avalRequired === false,
    activate: (f) => ({ ...f, avalRequired: false }),
  },
  {
    id: "sublet-yes",
    group: "Condiciones",
    label: "Subarriendo permitido",
    icon: Tag,
    isActive: (f) => f.subletAllowed === true,
    activate: (f) => ({ ...f, subletAllowed: true }),
  },
  {
    id: "sublet-no",
    group: "Condiciones",
    label: "Sin subarriendo",
    icon: Tag,
    isActive: (f) => f.subletAllowed === false,
    activate: (f) => ({ ...f, subletAllowed: false }),
  },
];

function normalizeSearchText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Catalog entries not already active, optionally narrowed by a free-text query (accent/case-insensitive). */
export function searchAddableFilters(filters: SearchFilters, query: string): AddableFilterOption[] {
  const q = normalizeSearchText(query);
  return ADDABLE_FILTER_CATALOG.filter((entry) => {
    if (entry.isActive(filters)) return false;
    if (!q) return true;
    return normalizeSearchText(entry.label).includes(q) || normalizeSearchText(entry.group).includes(q);
  });
}

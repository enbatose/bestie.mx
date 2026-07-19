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

/** A filter chip whose active value is a plain number that can be edited in place (Renta, Edad, Estancia mínima). */
export type NumericEditableFilter = {
  id: string;
  getValue: (f: SearchFilters) => number | null;
  setValue: (f: SearchFilters, value: number) => SearchFilters;
  step: number;
  min: number;
  max?: number;
  /** Shown before the number, e.g. "$" for money. */
  prefix?: string;
  /** Shown after the number, e.g. " años" for age. */
  suffix?: string;
};

export const NUMERIC_EDITABLE_FILTERS: Record<string, NumericEditableFilter> = {
  "horizontal-rent": {
    id: "horizontal-rent",
    getValue: (f) => f.budgetMax ?? f.budgetMin,
    setValue: (f, v) => (f.budgetMax != null ? { ...f, budgetMax: v } : { ...f, budgetMin: v }),
    step: 100,
    min: 0,
    prefix: "$",
  },
  "horizontal-age": {
    id: "horizontal-age",
    getValue: (f) => f.age,
    setValue: (f, v) => ({ ...f, age: v }),
    step: 1,
    min: 18,
    max: 99,
    suffix: " años",
  },
  "min-stay": {
    id: "min-stay",
    getValue: (f) => f.minimalStayMonths,
    setValue: (f, v) => ({ ...f, minimalStayMonths: v }),
    step: 1,
    min: 1,
    max: 36,
    suffix: " meses",
  },
};

export function clampNumericFilterValue(def: NumericEditableFilter, raw: number): number {
  let value = Number.isFinite(raw) ? raw : def.min;
  value = Math.max(def.min, value);
  if (def.max != null) value = Math.min(def.max, value);
  return value;
}

export type AddableFilterOption = {
  id: string;
  group: string;
  label: string;
  icon?: FilterIcon;
  /** Extra search terms (synonyms) so "Cochera" also finds "Estacionamiento", etc. */
  synonyms?: string[];
  isActive: (f: SearchFilters) => boolean;
  activate: (f: SearchFilters) => SearchFilters;
};

function addRoomDimension(current: RoomDimension[], value: RoomDimension): RoomDimension[] {
  return current.includes(value) ? current : [...current, value];
}

function addTag(current: readonly ListingTag[], tag: ListingTag): ListingTag[] {
  return current.includes(tag) ? [...current] : [...current, tag];
}

/** Extra search terms per tag so e.g. "Cochera" also finds "Estacionamiento". */
const TAG_SYNONYMS: Partial<Record<ListingTag, string[]>> = {
  "baño-privado": ["baño", "bathroom", "wc"],
  estacionamiento: ["cochera", "parking", "auto", "carro", "coche"],
  muebles: ["furniture", "amueblado"],
  "aire-acondicionado": ["ac", "clima", "aire"],
  mascotas: ["pets", "perro", "gato", "animales"],
  "lgbt-friendly": ["lgbt", "gay", "friendly", "comunidad"],
  parejas: ["pareja", "couples", "novios"],
  "fumar-permitido-recamara": ["fumar", "smoking", "cigarro"],
};

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
    synonyms: ["presupuesto", "precio", "renta maxima", "renta máxima", "cuanto pagar"],
    isActive: (f) => f.budgetMax != null || f.budgetMin != null,
    activate: (f) => ({ ...f, budgetMin: null, budgetMax: f.budgetMax ?? 6000 }),
  },
  {
    id: "age",
    group: "Presupuesto",
    label: "Edad",
    icon: UserRound,
    synonyms: ["años", "edad minima", "edad maxima"],
    isActive: (f) => f.age != null || f.ageMin != null || f.ageMax != null,
    activate: (f) => ({ ...f, age: f.age ?? 27, ageMin: null, ageMax: null }),
  },
  {
    id: "aval-yes",
    group: "Presupuesto",
    label: "Requiere aval",
    icon: Tag,
    synonyms: ["fiador", "garantia", "con aval"],
    isActive: (f) => f.avalRequired === true,
    activate: (f) => ({ ...f, avalRequired: true }),
  },
  {
    id: "aval-no",
    group: "Presupuesto",
    label: "Sin aval",
    icon: Tag,
    synonyms: ["sin fiador", "sin garantia"],
    isActive: (f) => f.avalRequired === false,
    activate: (f) => ({ ...f, avalRequired: false }),
  },
  {
    id: "gender-female",
    group: "Convivencia",
    label: "Sólo chicas",
    icon: HighHeelIcon,
    synonyms: ["solo mujeres", "mujeres", "mujer", "chicas", "genero femenino"],
    isActive: (f) => f.pref === "female",
    activate: (f) => ({ ...f, pref: "female" }),
  },
  {
    id: "gender-male",
    group: "Convivencia",
    label: "Sólo chicos",
    icon: MustacheIcon,
    synonyms: ["solo hombres", "hombres", "hombre", "chicos", "genero masculino"],
    isActive: (f) => f.pref === "male",
    activate: (f) => ({ ...f, pref: "male" }),
  },
  ...ADVANCED_TAG_FILTERS.map(
    (tag): AddableFilterOption => ({
      id: `tag-${tag}`,
      group: "Convivencia",
      label: TAG_LABELS[tag],
      icon: tag === "lgbt-friendly" ? undefined : ADVANCED_TAG_META[tag]?.icon,
      synonyms: TAG_SYNONYMS[tag],
      isActive: (f) => f.tags.includes(tag),
      activate: (f) => ({ ...f, tags: addTag(f.tags, tag) }),
    }),
  ),
  {
    id: "property-house",
    group: "Propiedad",
    label: "Casa",
    icon: House,
    synonyms: ["house", "casa completa"],
    isActive: (f) => f.wantHouse,
    activate: (f) => ({ ...f, wantHouse: true }),
  },
  {
    id: "property-apartment",
    group: "Propiedad",
    label: "Depa",
    icon: Building2,
    synonyms: ["departamento", "apartamento", "apartment"],
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
    synonyms: ["recamara privada", "privado", "habitacion privada"],
    isActive: (f) => f.lodgingType === "private_room",
    activate: (f) => ({ ...f, lodgingType: "private_room" }),
  },
  {
    id: "lodging-shared_room",
    group: "Propiedad",
    label: "Cuarto compartido",
    icon: PlusOneIcon,
    synonyms: ["recamara compartida", "compartido", "roomie", "habitacion compartida"],
    isActive: (f) => f.lodgingType === "shared_room",
    activate: (f) => ({ ...f, lodgingType: "shared_room" }),
  },
  {
    id: "room-dim-small",
    group: "Propiedad",
    label: "Tamaño: Individual",
    icon: BedSingle,
    synonyms: ["cama individual", "chica", "cama chica"],
    isActive: (f) => f.roomDimensions.includes("small"),
    activate: (f) => ({ ...f, roomDimensions: addRoomDimension(f.roomDimensions, "small") }),
  },
  {
    id: "room-dim-medium",
    group: "Propiedad",
    label: "Tamaño: Matrimonial",
    icon: BedDouble,
    synonyms: ["cama matrimonial", "cama queen", "mediana", "doble"],
    isActive: (f) => f.roomDimensions.includes("medium"),
    activate: (f) => ({ ...f, roomDimensions: addRoomDimension(f.roomDimensions, "medium") }),
  },
  {
    id: "room-dim-large",
    group: "Propiedad",
    label: "Tamaño: Grande",
    icon: Bed,
    synonyms: ["cama king", "cama grande", "amplia"],
    isActive: (f) => f.roomDimensions.includes("large"),
    activate: (f) => ({ ...f, roomDimensions: addRoomDimension(f.roomDimensions, "large") }),
  },
  {
    id: "available-from",
    group: "Condiciones",
    label: "Disponible desde",
    icon: Calendar,
    synonyms: ["fecha de mudanza", "fecha disponible", "mudanza", "cuando puedo mudarme"],
    isActive: (f) => f.availableFrom != null,
    activate: (f) => ({ ...f, availableFrom: f.availableFrom ?? isoDateTodayMexicoCity() }),
  },
  {
    id: "min-stay",
    group: "Condiciones",
    label: "Estancia mínima",
    icon: CalendarClock,
    synonyms: ["meses minimos", "tiempo minimo", "renta minima en meses"],
    isActive: (f) => f.minimalStayMonths != null,
    activate: (f) => ({ ...f, minimalStayMonths: f.minimalStayMonths ?? 6 }),
  },
  {
    id: "sublet-yes",
    group: "Condiciones",
    label: "Subarriendo permitido",
    icon: Tag,
    synonyms: ["subarrendar", "subletting", "rentar a otra persona"],
    isActive: (f) => f.subletAllowed === true,
    activate: (f) => ({ ...f, subletAllowed: true }),
  },
  {
    id: "sublet-no",
    group: "Condiciones",
    label: "Sin subarriendo",
    icon: Tag,
    synonyms: ["sin subarrendar", "no subletting"],
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
    if (normalizeSearchText(entry.label).includes(q) || normalizeSearchText(entry.group).includes(q)) return true;
    return (entry.synonyms ?? []).some((synonym) => normalizeSearchText(synonym).includes(q));
  });
}

import type { ListingTag, LodgingType, PropertyKind, RoomDimension, RoommateGenderPref } from "@/types/listing";

/** Utilities bundle check (p. ej. filtros que equivalen a `servicios-incluidos` en datos legacy). */
export const BASIC_UTILITIES_TAGS = ["agua", "luz", "gas", "wifi"] as const satisfies readonly ListingTag[];

export function utilitiesBundleSatisfied(tags: readonly ListingTag[]): boolean {
  return BASIC_UTILITIES_TAGS.every((t) => tags.includes(t));
}

/** Allowed room tag slugs; keep in sync with `server/src/listingTags.ts`. */
export const LISTING_TAG_SLUGS: readonly ListingTag[] = [
  "wifi",
  "agua",
  "luz",
  "gas",
  "mascotas",
  "estacionamiento",
  "muebles",
  "baño-privado",
  "fumar",
  "fumar-habitacion",
  "fumar-permitido-recamara",
  "ventilador",
  "closet",
  "fiestas",
  "aire-acondicionado",
  "seguridad-acceso",
  "vigilancia",
  "lavanderia",
  "lavadora",
  "secadora",
  "cocina-equipada",
  "terraza",
  "lgbt-friendly",
  "profesionistas",
  "estudiantes",
  "residentes-medicos",
  "nomadas-digitales",
  "individuos-solo",
  "parejas",
  "familiar-ninos",
  "servicios-incluidos",
  "cerradura-cuarto",
  "agua-caliente",
  "cerca-transporte",
] as const;

export const LISTING_TAG_SLUG_SET = new Set<string>(LISTING_TAG_SLUGS);

export type ListingTagGroup = {
  title: string;
  tags: readonly ListingTag[];
};

/** Amenidades de la propiedad (wizard paso 3 — “La propiedad cuenta con”). */
export const PROPERTY_AMENITY_TAG_SLUGS = [
  "wifi",
  "agua",
  "luz",
  "gas",
  "cocina-equipada",
  "lavadora",
  "secadora",
  "cerca-transporte",
  "seguridad-acceso",
  "vigilancia",
] as const satisfies readonly ListingTag[];

/** Reglas de convivencia en áreas comunes (wizard paso 3 — “Se permite”). */
export const PROPERTY_PERMITIDO_TAG_SLUGS = [
  "mascotas",
  "fiestas",
  "fumar",
] as const satisfies readonly ListingTag[];

export const PROPERTY_TAG_GROUPS: readonly ListingTagGroup[] = [
  { title: "La propiedad cuenta con", tags: PROPERTY_AMENITY_TAG_SLUGS },
  { title: "Se permite", tags: PROPERTY_PERMITIDO_TAG_SLUGS },
];

/** Tags almacenados en `draft.propertyTags`. */
export const PROPERTY_SCOPE_TAG_SLUGS: readonly ListingTag[] = [
  ...PROPERTY_AMENITY_TAG_SLUGS,
  ...PROPERTY_PERMITIDO_TAG_SLUGS,
];

export const PROPERTY_SCOPE_TAG_SET = new Set<string>(PROPERTY_SCOPE_TAG_SLUGS);

/** Afinidades de perfil (ámbito recámara — “Ideal para”). */
export const ROOM_IDEAL_PARA_TAG_SLUGS = [
  "lgbt-friendly",
  "profesionistas",
  "estudiantes",
  "nomadas-digitales",
  "individuos-solo",
  "parejas",
  "familiar-ninos",
] as const satisfies readonly ListingTag[];

export const ROOM_IDEAL_PARA_TAG_SET = new Set<string>(ROOM_IDEAL_PARA_TAG_SLUGS);

const ROOM_PHYSICAL_TAG_SLUGS = [
  "baño-privado",
  "aire-acondicionado",
  "estacionamiento",
  "muebles",
  "terraza",
  "cerradura-cuarto",
  "ventilador",
  "closet",
  "fumar-permitido-recamara",
] as const satisfies readonly ListingTag[];

/** Grupos de tags editables por recámara (wizard paso Recámaras + preview). */
export const ROOM_TAG_GROUPS: readonly ListingTagGroup[] = [
  {
    title: "Propiedades de la recámara",
    tags: ROOM_PHYSICAL_TAG_SLUGS,
  },
  {
    title: "Ideal para",
    tags: ROOM_IDEAL_PARA_TAG_SLUGS,
  },
];

export const ROOM_SCOPE_TAG_SLUGS: readonly ListingTag[] = [
  ...ROOM_PHYSICAL_TAG_SLUGS,
  ...ROOM_IDEAL_PARA_TAG_SLUGS,
];

export const ROOM_SCOPE_TAG_SET = new Set<string>(ROOM_SCOPE_TAG_SLUGS);

/** Slugs que antes vivían en `propertyTags` y ahora pertenecen a la recámara. */
export const LEGACY_PROPERTY_TO_ROOM_TAG_SLUGS: readonly ListingTag[] = [
  ...ROOM_IDEAL_PARA_TAG_SLUGS,
  "fumar-habitacion",
];

export const LEGACY_PROPERTY_TO_ROOM_TAG_SET = new Set<string>(LEGACY_PROPERTY_TO_ROOM_TAG_SLUGS);

/**
 * Soft hyphen (U+00AD). Invisible unless the line breaks here; then a visible "-" is shown.
 * Use in constrained pills/chips when a Spanish word is too long to fit (see `.cursor/rules/chip-label-soft-hyphens.mdc`).
 */
export const SOFT_HYPHEN = "\u00AD";

/** Etiquetas con copy distinto en wizard / preview (full / display name). */
export const LISTING_TAG_LABEL_OVERRIDES: Partial<Record<ListingTag, string>> = {
  estacionamiento: `Estacionami${SOFT_HYPHEN}ento privado`,
  muebles: "Amueblado",
  "fumar-permitido-recamara": "Permitido fumar",
};

/**
 * Compact one-line labels for wizard / editor choice pills (2-column grids).
 * Full names stay in `TAG_LABELS` / overrides and appear in the section info dialog.
 */
export const LISTING_TAG_CHIP_LABELS: Partial<Record<ListingTag, string>> = {
  "cerca-transporte": "Transporte",
  "seguridad-acceso": "Seguridad",
  vigilancia: "Portería",
  fumar: "Fumar (comunes)",
  "cerradura-cuarto": "Con llave",
  "aire-acondicionado": "A/C",
  estacionamiento: "Estacionam.",
  terraza: "Terraza",
  "nomadas-digitales": "Nómada Dig.",
  "individuos-solo": "Individuos",
  "familiar-ninos": "Familiar",
  "cocina-equipada": "Cocina",
  muebles: "Amueblado",
  "fumar-permitido-recamara": "Fumar OK",
  "lgbt-friendly": "LGBT+",
  "baño-privado": "Baño priv.",
  profesionistas: "Profesionistas",
  estudiantes: "Estudiantes",
  parejas: "Parejas",
  lavadora: "Lavadora",
  secadora: "Secadora",
  ventilador: "Ventilador",
  closet: "Closet",
  wifi: "Wi‑Fi",
  agua: "Agua",
  luz: "Luz",
  gas: "Gas",
  mascotas: "Mascotas",
  fiestas: "Fiestas",
};

export const LODGING_TYPE_LABELS: Record<LodgingType, string> = {
  private_room: "Recámara privada",
  shared_room: "Recámara compartida",
  whole_home: "Vivienda completa",
};

/** Etiqueta de tamaño / tipo de cama para preview y listados. */
export function roomDimensionPreviewLabel(
  dimension: RoomDimension,
  postMode: "room" | "property",
): string {
  if (postMode === "room") {
    const labels: Record<RoomDimension, string> = {
      small: "Individual",
      medium: "Matrimonial",
      large: "Grande",
    };
    return labels[dimension];
  }
  const labels: Record<RoomDimension, string> = {
    small: "Pequeña",
    medium: "Mediana",
    large: "Grande",
  };
  return labels[dimension];
}

/** Descripción guía del tamaño (LOV hint) para mostrar debajo del valor principal. */
export function roomDimensionHintLabel(
  dimension: RoomDimension,
  postMode: "room" | "property",
): string {
  if (postMode === "room") {
    const hints: Record<RoomDimension, string> = {
      small: "Cabe cama individual + buró",
      medium: "Cabe cama matrimonial + escritorio",
      large: "Cabe cama Queen/King + área de estar",
    };
    return hints[dimension];
  }
  const hints: Record<RoomDimension, string> = {
    small: "Cabe cama individual",
    medium: "Cabe cama matrimonial",
    large: "Cabe cama Queen/King",
  };
  return hints[dimension];
}

export function roomBathroomPreviewLabel(tags: readonly ListingTag[]): string {
  return tags.includes("baño-privado") ? "Baño privado" : "Baño compartido";
}

/** Etiqueta del campo en wizard y preview (no confundir con el valor seleccionado). */
export const ROOMMATE_GENDER_PREF_FIELD_LABEL = "Preferencia de Género";

export function roommateGenderPrefLabel(pref: RoommateGenderPref): string {
  if (pref === "female") return "Solo Mujeres";
  if (pref === "male") return "Solo Hombres";
  return "Hombre o Mujer";
}

/** ISO `YYYY-MM-DD` → fecha legible en español (México). */
export function formatRoomAvailableFrom(iso: string): string {
  const trimmed = iso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed || "—";
  const [y, m, d] = trimmed.split("-").map(Number);
  if (!y || !m || !d) return trimmed;
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

export function minimalStayMonthsLabel(months: number): string {
  if (!Number.isFinite(months) || months < 1) return "—";
  return months === 1 ? "1 mes" : `${months} meses`;
}

export function roomPlazasLabel(count: number): string {
  if (!Number.isFinite(count) || count < 1) return "—";
  return count === 1 ? "1 plaza" : `${count} plazas`;
}

export function roomAgeRangeLabel(min: number, max: number): string {
  return `${min}–${max} años`;
}

export const PROPERTY_KIND_LABELS: Record<PropertyKind, string> = {
  house: "Casa",
  apartment: "Departamento",
  loft: "Loft",
};

/** Renta/depósito en el grid de recámara solo cuando hay varios cuartos en modo propiedad. */
export function shouldShowRoomPriceInDetails(postMode: "room" | "property", roomCount: number): boolean {
  if (postMode === "room") return false;
  return roomCount > 1;
}

export function propertyBedroomsPreviewLabel(
  bedroomsTotal: number,
  propertyKind: PropertyKind,
): string {
  if (propertyKind === "loft") return "1 recámara (loft)";
  return bedroomsTotal === 1 ? "1 recámara" : `${bedroomsTotal} recámaras`;
}

export function propertySpacesPreviewLabel(
  bedroomsTotal: number,
  bathrooms: number,
  propertyKind: PropertyKind,
): string {
  const beds =
    propertyKind === "loft"
      ? "1 Recámara"
      : bedroomsTotal === 1
        ? "1 Recámara"
        : `${bedroomsTotal} Recámaras`;
  const baths = bathrooms === 1 ? "1 Baño" : `${bathrooms} Baños`;
  return `${beds} • ${baths}`;
}

export function currentOccupantsPreviewLabel(
  menCount: number | null | undefined,
  womenCount: number | null | undefined,
): string {
  const men = menCount ?? 0;
  const women = womenCount ?? 0;
  const parts: string[] = [];
  if (men > 0) parts.push(`${men} ${men === 1 ? "Hombre" : "Hombres"}`);
  if (women > 0) parts.push(`${women} ${women === 1 ? "Mujer" : "Mujeres"}`);
  if (!parts.length) return "Viven aquí: sin habitantes registrados";
  return `Viven aquí: ${parts.join(", ")}`;
}

export function previewRoomHeaderTitle(
  lodgingType: LodgingType,
  neighborhood: string,
  postMode: "room" | "property",
): string {
  const key = postMode === "room" && lodgingType === "whole_home" ? "private_room" : lodgingType;
  return `${LODGING_TYPE_LABELS[key]} en ${neighborhood}`;
}

export function previewPropertyHeaderTitle(propertyKind: PropertyKind, neighborhood: string): string {
  return `${PROPERTY_KIND_LABELS[propertyKind]} en ${neighborhood}`;
}

/** Badge de habitantes actuales; null si ambos contadores son 0. */
export function previewRoomOccupantsBadgeLabel(
  menCount: number | null | undefined,
  womenCount: number | null | undefined,
): string | null {
  const men = menCount ?? 0;
  const women = womenCount ?? 0;
  if (men <= 0 && women <= 0) return null;
  const parts: string[] = [];
  if (men > 0) parts.push(`${men} ${men === 1 ? "Hombre" : "Hombres"}`);
  if (women > 0) parts.push(`${women} ${women === 1 ? "Mujer" : "Mujeres"}`);
  return `Viven aquí: ${parts.join(", ")}`;
}

export function previewRoommateSoughtBadgeLabel(pref: RoommateGenderPref): string {
  return `Buscan: ${roommateGenderPrefLabel(pref)}`;
}

/** Badge de disponibilidad; null si no hay fecha. */
export function previewAvailableFromBadgeLabel(iso: string): string | null {
  const trimmed = iso.trim();
  if (!trimmed) return null;
  return `Disponible: ${formatRoomAvailableFrom(trimmed)}`;
}

export function previewPropertySpacesBadgeLabel(
  bedroomsTotal: number,
  bathrooms: number,
  propertyKind: PropertyKind,
): string {
  const beds = propertyKind === "loft" ? 1 : bedroomsTotal;
  const bedsLabel = beds === 1 ? "1 Recámara" : `${beds} Recámaras`;
  const bathsLabel = bathrooms === 1 ? "1 Baño" : `${bathrooms} Baños`;
  return `${bedsLabel} • ${bathsLabel}`;
}

export const PREVIEW_PETS_FRIENDLY_BADGE = "Aceptan mascotas";

/** Chip style for explicit header badges (preview + public listing pages). */
export const LISTING_HEADER_BADGE_CLASS =
  "rounded-full bg-bg-light px-3 py-1.5 text-xs font-semibold text-body ring-1 ring-border";

export type PublicListingHeaderBadge = { id: string; label: string };

/** Explicit header badges for room vs property posts (shared by preview and public pages). */
export function publicListingHeaderBadges(opts: {
  postMode: "room" | "property";
  roommateGenderPref: RoommateGenderPref;
  availableFrom?: string;
  occupiedByMenCount?: number | null;
  occupiedByWomenCount?: number | null;
  propertyBedroomsTotal?: number;
  propertyBathrooms?: number;
  propertyKind?: PropertyKind;
  tags?: readonly ListingTag[];
}): PublicListingHeaderBadge[] {
  const badges: PublicListingHeaderBadge[] = [];

  if (opts.postMode === "room") {
    const occupants = previewRoomOccupantsBadgeLabel(
      opts.occupiedByMenCount,
      opts.occupiedByWomenCount,
    );
    if (occupants) badges.push({ id: "occupants", label: occupants });
    badges.push({ id: "sought", label: previewRoommateSoughtBadgeLabel(opts.roommateGenderPref) });
    const available = previewAvailableFromBadgeLabel(opts.availableFrom ?? "");
    if (available) badges.push({ id: "available", label: available });
  } else {
    badges.push({
      id: "spaces",
      label: previewPropertySpacesBadgeLabel(
        opts.propertyBedroomsTotal ?? 1,
        opts.propertyBathrooms ?? 1,
        opts.propertyKind ?? "house",
      ),
    });
    const propTags = opts.tags ? filterPropertyScopeTags(opts.tags) : [];
    if (propTags.includes("mascotas")) {
      badges.push({ id: "pets", label: PREVIEW_PETS_FRIENDLY_BADGE });
    }
  }

  return badges;
}

export function listingHeroPriceLabel(rentMxn: number): string {
  return `${rentMxn.toLocaleString("es-MX")} MXN / mes`;
}

/** True when rent is unset or zero — not a publishable monthly price. */
export function isListingRentMissing(rentMxn: number | null | undefined): boolean {
  return !Number.isFinite(rentMxn) || (rentMxn as number) <= 0;
}

export function isPropertyScopeTag(tag: string): tag is ListingTag {
  return PROPERTY_SCOPE_TAG_SET.has(tag);
}

export function isRoomScopeTag(tag: string): tag is ListingTag {
  return ROOM_SCOPE_TAG_SET.has(tag);
}

export function isRoomIdealParaTag(tag: string): tag is ListingTag {
  return ROOM_IDEAL_PARA_TAG_SET.has(tag);
}

export function filterPropertyScopeTags(tags: readonly ListingTag[]): ListingTag[] {
  return tags.filter((t) => isPropertyScopeTag(t));
}

export function filterRoomScopeTags(tags: readonly ListingTag[]): ListingTag[] {
  return tags.filter((t) => isRoomScopeTag(t));
}

/** Orden de visualización alineado con `ROOM_TAG_GROUPS`. */
export function sortRoomScopeTags(tags: readonly ListingTag[]): ListingTag[] {
  const order = new Map(ROOM_SCOPE_TAG_SLUGS.map((t, i) => [t, i]));
  return [...tags].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
}

/** Migra tags de propiedad reubicados al ámbito recámara (ideal para, fumar en habitación legacy). */
export function migrateDraftTagScopes<T extends { propertyTags: ListingTag[]; rooms: { tags: ListingTag[] }[] }>(
  draft: T,
): T {
  const movedFromProperty = draft.propertyTags.filter((t) => LEGACY_PROPERTY_TO_ROOM_TAG_SET.has(t));
  const hadMuebles = draft.propertyTags.includes("muebles");
  const propertyTags = filterPropertyScopeTags(draft.propertyTags);
  if (!movedFromProperty.length && !hadMuebles && propertyTags.length === draft.propertyTags.length) {
    return { ...draft, propertyTags };
  }

  const rooms = draft.rooms.map((room) => {
    const tags = new Set(room.tags);
    for (const t of movedFromProperty) {
      if (t === "fumar-habitacion") {
        tags.add("fumar-permitido-recamara");
      } else {
        tags.add(t);
      }
    }
    if (hadMuebles) {
      tags.add("muebles");
    }
    return { ...room, tags: [...tags].filter((t): t is ListingTag => LISTING_TAG_SLUG_SET.has(t)) };
  });

  return { ...draft, propertyTags, rooms };
}

/** Chip order in publish wizard (most-used / comfort first). */
export const TAG_CHIP_ORDER: readonly ListingTag[] = [
  "wifi",
  "agua",
  "luz",
  "gas",
  "aire-acondicionado",
  "muebles",
  "baño-privado",
  "estacionamiento",
  "lavadora",
  "secadora",
  "lavanderia",
  "cocina-equipada",
  "terraza",
  "seguridad-acceso",
  "vigilancia",
  "cerradura-cuarto",
  "cerca-transporte",
  "agua-caliente",
  "servicios-incluidos",
  "mascotas",
  "lgbt-friendly",
  "profesionistas",
  "estudiantes",
  "residentes-medicos",
  "nomadas-digitales",
  "individuos-solo",
  "parejas",
  "familiar-ninos",
  "fumar",
  "fumar-habitacion",
  "fumar-permitido-recamara",
  "ventilador",
  "closet",
  "fiestas",
];

/** Quick-filter tags shown on the map rail (Detalle section). */
export const SEARCH_RAIL_DETALLE_TAG_SLUGS = [
  "baño-privado",
  "estacionamiento",
  "muebles",
  "aire-acondicionado",
  "mascotas",
  "lgbt-friendly",
  "parejas",
  "fumar-permitido-recamara",
] as const satisfies readonly ListingTag[];

export const SEARCH_RAIL_TAG_LABELS: Partial<Record<ListingTag, string>> = {
  estacionamiento: `Estacionami${SOFT_HYPHEN}ento privado`,
  muebles: "Amueblado",
  "fumar-permitido-recamara": "Permitido fumar",
};

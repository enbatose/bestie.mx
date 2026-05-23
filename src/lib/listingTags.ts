import type { ListingTag } from "@/types/listing";

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
  "muebles",
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
  "residentes-medicos",
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
  "terraza",
  "cerradura-cuarto",
  "ventilador",
  "closet",
] as const satisfies readonly ListingTag[];

export const ROOM_SMOKING_TAG_SLUGS = ["fumar-permitido-recamara"] as const satisfies readonly ListingTag[];

/** Grupos de tags editables por recámara (wizard paso Recámaras + preview). */
export const ROOM_TAG_GROUPS: readonly ListingTagGroup[] = [
  {
    title: "Propiedades de la recámara",
    tags: ROOM_PHYSICAL_TAG_SLUGS,
  },
  {
    title: "Permitido fumar en la recámara",
    tags: ROOM_SMOKING_TAG_SLUGS,
  },
  {
    title: "Ideal para",
    tags: ROOM_IDEAL_PARA_TAG_SLUGS,
  },
];

export const ROOM_SCOPE_TAG_SLUGS: readonly ListingTag[] = [
  ...ROOM_PHYSICAL_TAG_SLUGS,
  ...ROOM_SMOKING_TAG_SLUGS,
  ...ROOM_IDEAL_PARA_TAG_SLUGS,
];

export const ROOM_SCOPE_TAG_SET = new Set<string>(ROOM_SCOPE_TAG_SLUGS);

/** Slugs que antes vivían en `propertyTags` y ahora pertenecen a la recámara. */
export const LEGACY_PROPERTY_TO_ROOM_TAG_SLUGS: readonly ListingTag[] = [
  ...ROOM_IDEAL_PARA_TAG_SLUGS,
  "fumar-habitacion",
];

export const LEGACY_PROPERTY_TO_ROOM_TAG_SET = new Set<string>(LEGACY_PROPERTY_TO_ROOM_TAG_SLUGS);

/** Etiquetas con copy distinto en wizard / preview. */
export const LISTING_TAG_LABEL_OVERRIDES: Partial<Record<ListingTag, string>> = {
  estacionamiento: "Estacionamiento incluido",
  "fumar-permitido-recamara": "Permitido fumar en la recámara",
};

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

/** Migra tags de propiedad reubicados al ámbito recámara (ideal para, fumar en habitación legacy). */
export function migrateDraftTagScopes<T extends { propertyTags: ListingTag[]; rooms: { tags: ListingTag[] }[] }>(
  draft: T,
): T {
  const movedFromProperty = draft.propertyTags.filter((t) => LEGACY_PROPERTY_TO_ROOM_TAG_SET.has(t));
  const propertyTags = filterPropertyScopeTags(draft.propertyTags);
  if (!movedFromProperty.length && propertyTags.length === draft.propertyTags.length) {
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
    return { ...room, tags: [...tags].filter((t): t is ListingTag => LISTING_TAG_SLUG_SET.has(t)) };
  });

  return { ...draft, propertyTags, rooms };
}

/** Chip order in publish wizard and search rail (most-used / comfort first). */
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

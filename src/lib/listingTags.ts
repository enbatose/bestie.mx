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
  "servicios-incluidos",
  "cerradura-cuarto",
  "agua-caliente",
  "cerca-transporte",
] as const;

export const LISTING_TAG_SLUG_SET = new Set<string>(LISTING_TAG_SLUGS);

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
  "fumar",
  "fumar-habitacion",
  "fiestas",
];

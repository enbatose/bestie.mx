import type { ListingTag } from "./types.js";

/** Tags implied when “Servicios básicos incluidos” is on in the publish wizard. */
export const BASIC_UTILITIES_TAGS = ["agua", "luz", "gas", "wifi"] as const;

export function utilitiesBundleSatisfied(tags: readonly string[]): boolean {
  return BASIC_UTILITIES_TAGS.every((t) => tags.includes(t));
}

/** Allowed room tag slugs (JSON `tags_json`); keep in sync with `src/types/listing.ts`. */
export const LISTING_TAG_SLUGS = [
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
  "servicios-incluidos",
  "cerradura-cuarto",
  "agua-caliente",
  "cerca-transporte",
] as const;

const TAG_SET = new Set<string>(LISTING_TAG_SLUGS);

export function isListingTag(t: string): t is ListingTag {
  return TAG_SET.has(t);
}

export function listingTagSet(): Set<string> {
  return new Set(TAG_SET);
}

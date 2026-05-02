import type { ListingTag } from "./types.js";

/** Allowed room tag slugs (JSON `tags_json`); keep in sync with `src/types/listing.ts`. */
export const LISTING_TAG_SLUGS = [
  "wifi",
  "mascotas",
  "estacionamiento",
  "muebles",
  "baño-privado",
  "fumar",
  "fiestas",
  "aire-acondicionado",
  "seguridad-acceso",
  "vigilancia",
  "lavanderia",
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

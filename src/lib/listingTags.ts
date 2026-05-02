import type { ListingTag } from "@/types/listing";

/** Allowed room tag slugs; keep in sync with `server/src/listingTags.ts`. */
export const LISTING_TAG_SLUGS: readonly ListingTag[] = [
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

export const LISTING_TAG_SLUG_SET = new Set<string>(LISTING_TAG_SLUGS);

/** Chip order in publish wizard and search rail (most-used / comfort first). */
export const TAG_CHIP_ORDER: readonly ListingTag[] = [
  "wifi",
  "aire-acondicionado",
  "muebles",
  "baño-privado",
  "estacionamiento",
  "lavanderia",
  "cocina-equipada",
  "agua-caliente",
  "terraza",
  "seguridad-acceso",
  "vigilancia",
  "cerradura-cuarto",
  "cerca-transporte",
  "servicios-incluidos",
  "mascotas",
  "lgbt-friendly",
  "fumar",
  "fiestas",
];

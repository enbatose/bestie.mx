import type { ListingTag } from "@/types/listing";
import {
  LISTING_TAG_LABEL_OVERRIDES,
  PROPERTY_AMENITY_TAG_SLUGS,
  PROPERTY_PERMITIDO_TAG_SLUGS,
  PROPERTY_SCOPE_TAG_SLUGS,
  PROPERTY_SCOPE_TAG_SET,
  ROOM_IDEAL_PARA_TAG_SLUGS,
  ROOM_TAG_GROUPS,
} from "@/lib/listingTags";

/** @deprecated Use `ROOM_TAG_GROUPS` from `@/lib/listingTags`. */
export const WIZARD_ROOM_TAG_GROUPS = ROOM_TAG_GROUPS;

/** @deprecated Use `LISTING_TAG_LABEL_OVERRIDES` from `@/lib/listingTags`. */
export const WIZARD_STEP4_TAG_LABELS = LISTING_TAG_LABEL_OVERRIDES;

/** @deprecated Use slugs from `@/lib/listingTags`. */
export const WIZARD_PROPERTY_AMENITY_SLUGS = PROPERTY_AMENITY_TAG_SLUGS;

/** @deprecated Use slugs from `@/lib/listingTags`. */
export const WIZARD_PROPERTY_PERMITIDO_SLUGS = PROPERTY_PERMITIDO_TAG_SLUGS;

/** @deprecated Use `ROOM_IDEAL_PARA_TAG_SLUGS` from `@/lib/listingTags`. */
export const WIZARD_ROOM_IDEAL_PARA_SLUGS = ROOM_IDEAL_PARA_TAG_SLUGS;

/** @deprecated Use `PROPERTY_SCOPE_TAG_SLUGS` from `@/lib/listingTags`. */
export const WIZARD_STEP3_TAG_SLUGS = PROPERTY_SCOPE_TAG_SLUGS;

/** @deprecated Use `PROPERTY_SCOPE_TAG_SET` from `@/lib/listingTags`. */
export const WIZARD_STEP3_TAG_SET = PROPERTY_SCOPE_TAG_SET;

export const ROOM_SINGLE_FLOW_PHOTO_HINT =
  "Sube fotos en bloque de la recámara y de las áreas comunes de la propiedad (cocina, sala, baño, etc.). No es necesario separarlas por categorías en este flujo";

/** Plazas en modo cuarto según tags “Individuos” / “Parejas”. */
export function roomsAvailableFromIdealTags(tags: readonly ListingTag[]): number {
  return tags.includes("parejas") ? 2 : 1;
}

import type { ListingTag } from "@/types/listing";

/** Solo paso Recámaras — propiedades físicas de la recámara. */
export const WIZARD_ROOM_TAG_GROUPS: { title: string; tags: readonly ListingTag[] }[] = [
  {
    title: "Propiedades de la Recámara",
    tags: [
      "baño-privado",
      "aire-acondicionado",
      "estacionamiento",
      "terraza",
      "cerradura-cuarto",
      "fumar-permitido-recamara",
      "ventilador",
      "closet",
    ],
  },
];

export const WIZARD_STEP4_TAG_LABELS: Partial<Record<ListingTag, string>> = {
  estacionamiento: "Estacionamiento incluido",
};

export const ROOM_SINGLE_FLOW_PHOTO_HINT =
  "Sube fotos en bloque de la recámara y de las áreas comunes de la propiedad (cocina, sala, baño, etc.). No es necesario separarlas por categorías en este flujo";

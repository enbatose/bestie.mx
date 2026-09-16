/**
 * Amenity capture for chat publishing.
 *
 * WhatsApp interactive lists are single-select, so multi-select would cost one
 * round trip per amenity. A numbered menu answered with "1,3,5" captures the
 * high-value labels in one message, which is what listing cards and the search
 * filters read.
 */
import type { ListingTag } from "./types.js";

export type ChatAmenityOption = {
  n: number;
  slug: ListingTag;
  label: string;
};

/** Ordered by how often seekers filter on them in GDL. */
export const CHAT_AMENITY_OPTIONS: readonly ChatAmenityOption[] = [
  { n: 1, slug: "wifi", label: "Wifi" },
  { n: 2, slug: "muebles", label: "Amueblado" },
  { n: 3, slug: "baño-privado", label: "Baño privado" },
  { n: 4, slug: "servicios-incluidos", label: "Servicios incluidos" },
  { n: 5, slug: "estacionamiento", label: "Estacionamiento" },
  { n: 6, slug: "lavadora", label: "Lavadora" },
  { n: 7, slug: "cocina-equipada", label: "Cocina equipada" },
  { n: 8, slug: "mascotas", label: "Mascotas OK" },
  { n: 9, slug: "closet", label: "Clóset" },
  { n: 10, slug: "agua-caliente", label: "Agua caliente" },
];

const BY_NUMBER = new Map(CHAT_AMENITY_OPTIONS.map((o) => [o.n, o]));

const TAG_LABELS: Partial<Record<ListingTag, string>> = {
  ...Object.fromEntries(CHAT_AMENITY_OPTIONS.map((o) => [o.slug, o.label])),
  agua: "Agua",
  luz: "Luz",
  gas: "Gas",
  secadora: "Secadora",
  lavanderia: "Área de lavado",
  terraza: "Terraza",
  ventilador: "Ventilador",
  "aire-acondicionado": "Aire acondicionado",
  "seguridad-acceso": "Acceso controlado",
  vigilancia: "Vigilancia",
  "cerca-transporte": "Cerca del transporte",
  "cerradura-cuarto": "Cerradura en el cuarto",
  fumar: "Fumar permitido",
  fiestas: "Reuniones permitidas",
  "lgbt-friendly": "LGBT friendly",
  estudiantes: "Estudiantes",
  profesionistas: "Profesionistas",
  "residentes-medicos": "Residentes médicos",
  "nomadas-digitales": "Nómadas digitales",
  "individuos-solo": "Para vivir solo",
  parejas: "Parejas",
  "familiar-ninos": "Con niños",
};

export function chatTagLabel(slug: ListingTag): string {
  return TAG_LABELS[slug] ?? slug;
}

export function chatTagLabels(slugs: readonly ListingTag[]): string[] {
  return slugs.map(chatTagLabel);
}

/** The numbered menu, two options per line so it stays short on a phone. */
export function chatAmenityMenuText(already: readonly ListingTag[]): string {
  const have = new Set(already);
  const lines: string[] = [];
  for (let i = 0; i < CHAT_AMENITY_OPTIONS.length; i += 2) {
    lines.push(
      CHAT_AMENITY_OPTIONS.slice(i, i + 2)
        .map((o) => `${o.n}. ${o.label}${have.has(o.slug) ? " ✅" : ""}`)
        .join("   "),
    );
  }
  return lines.join("\n");
}

/** Parses "1,3 5" / "1 y 3" into tags. Ignores numbers outside the menu. */
export function parseChatAmenityReply(text: string): ListingTag[] {
  const out = new Set<ListingTag>();
  for (const raw of text.match(/\d{1,2}/g) ?? []) {
    const opt = BY_NUMBER.get(Number(raw));
    if (opt) out.add(opt.slug);
  }
  return [...out];
}

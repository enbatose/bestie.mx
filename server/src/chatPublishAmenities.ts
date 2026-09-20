/**
 * Amenity capture for chat publishing.
 *
 * WhatsApp interactive lists are single-select, so multi-select would cost one
 * round trip per amenity. A short numbered menu answered with "1,3,5" captures
 * high-signal labels in one message (cards + seeker filters). Full amenity
 * grids and revisions stay on the web editor — chat is create-only.
 */
import type { ListingTag } from "./types.js";

export type ChatAmenityOption = {
  n: number;
  slug: ListingTag;
  label: string;
};

/**
 * Six filter-aligned amenities for chat. Map quick filters that matter most:
 * baño privado, estacionamiento, amueblado, mascotas — plus wifi/lavadora for
 * card comfort. Everything else is edited on the site.
 */
export const CHAT_AMENITY_OPTIONS: readonly ChatAmenityOption[] = [
  { n: 1, slug: "wifi", label: "Wifi" },
  { n: 2, slug: "muebles", label: "Amueblado" },
  { n: 3, slug: "baño-privado", label: "Baño privado" },
  { n: 4, slug: "estacionamiento", label: "Estacionamiento" },
  { n: 5, slug: "mascotas", label: "Mascotas OK" },
  { n: 6, slug: "lavadora", label: "Lavadora" },
];

const BY_NUMBER = new Map(CHAT_AMENITY_OPTIONS.map((o) => [o.n, o]));
const MENU_SLUGS = new Set(CHAT_AMENITY_OPTIONS.map((o) => o.slug));

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
  "cocina-equipada": "Cocina equipada",
  "servicios-incluidos": "Servicios incluidos",
  closet: "Clóset",
  "agua-caliente": "Agua caliente",
};

export function chatTagLabel(slug: ListingTag): string {
  return TAG_LABELS[slug] ?? slug;
}

export function chatTagLabels(slugs: readonly ListingTag[]): string[] {
  return slugs.map(chatTagLabel);
}

export function isChatAmenitySlug(slug: string): slug is ListingTag {
  return MENU_SLUGS.has(slug as ListingTag);
}

/** Tags from the chat menu that are already on the draft. */
export function chatAmenitySelected(tags: readonly ListingTag[]): ChatAmenityOption[] {
  return CHAT_AMENITY_OPTIONS.filter((o) => tags.includes(o.slug));
}

/** Full 1–6 menu; already-known rows get a checkmark (no hidden numbers). */
export function chatAmenityMenuText(already: readonly ListingTag[]): string {
  const have = new Set(already);
  return CHAT_AMENITY_OPTIONS.map(
    (o) => `${o.n}. ${o.label}${have.has(o.slug) ? " ✅" : ""}`,
  ).join("\n");
}

/** Parses "1,3 5" / "1 y 3" into amenity tags. Ignores numbers outside the menu. */
export function parseChatAmenityReply(text: string): ListingTag[] {
  const out = new Set<ListingTag>();
  for (const raw of text.match(/\d{1,2}/g) ?? []) {
    const opt = BY_NUMBER.get(Number(raw));
    if (opt) out.add(opt.slug);
  }
  return [...out];
}

/**
 * Amenity capture for chat publishing.
 *
 * WhatsApp interactive lists are single-select, so multi-select would cost one
 * round trip per amenity. A short numbered menu answered with "1,3,5" captures
 * high-signal labels in one message (cards + seeker filters). Full amenity
 * grids stay on the web editor.
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

/** Enough detected tags to skip the full checklist and ask for a confirm. */
export const CHAT_AMENITY_CONFIRM_MIN = 2;

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

export function chatAmenityConfirmEligible(tags: readonly ListingTag[]): boolean {
  return chatAmenitySelected(tags).length >= CHAT_AMENITY_CONFIRM_MIN;
}

/**
 * Numbered menu. Prefer `onlyMissing` after confirm → add, so the wall shrinks.
 * Numbers stay stable (option.n) even when some rows are hidden.
 */
export function chatAmenityMenuText(
  already: readonly ListingTag[],
  opts?: { onlyMissing?: boolean },
): string {
  const have = new Set(already);
  const rows = opts?.onlyMissing
    ? CHAT_AMENITY_OPTIONS.filter((o) => !have.has(o.slug))
    : CHAT_AMENITY_OPTIONS;
  if (!rows.length) return "(Ya marcaste las 6 de esta lista.)";
  return rows.map((o) => `${o.n}. ${o.label}${have.has(o.slug) ? " ✅" : ""}`).join("\n");
}

/** Remove menu: renumber 1…N over currently selected chat amenities. */
export function chatAmenityRemoveMenuText(already: readonly ListingTag[]): string {
  const selected = chatAmenitySelected(already);
  if (!selected.length) return "(No hay etiquetas de esta lista para quitar.)";
  return selected.map((o, i) => `${i + 1}. ${o.label}`).join("\n");
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

/** Parses remove-menu numbers (1…N of currently selected). */
export function parseChatAmenityRemoveReply(
  text: string,
  already: readonly ListingTag[],
): ListingTag[] {
  const selected = chatAmenitySelected(already);
  const out = new Set<ListingTag>();
  for (const raw of text.match(/\d{1,2}/g) ?? []) {
    const idx = Number(raw) - 1;
    if (idx >= 0 && idx < selected.length) out.add(selected[idx]!.slug);
  }
  return [...out];
}

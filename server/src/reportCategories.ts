/** Predefined report categories for listing/photo reports. */
export const POST_REPORT_CATEGORIES = [
  { id: "estafa", label: "Estafa o fraude" },
  { id: "fotos_falsas", label: "Fotos falsas o engañosas" },
  { id: "contenido_inapropiado", label: "Contenido inapropiado" },
  { id: "spam", label: "Spam o publicidad" },
  { id: "info_falsa", label: "Información falsa" },
  { id: "otro", label: "Otro" },
] as const;

export type PostReportCategoryId = (typeof POST_REPORT_CATEGORIES)[number]["id"];

/** Predefined report categories for private chat misconduct. */
export const CHAT_REPORT_CATEGORIES = [
  { id: "ofensas", label: "Ofensas o insultos" },
  { id: "falta_respeto", label: "Falta de respeto" },
  { id: "discriminacion", label: "Discriminación" },
  { id: "acoso", label: "Acoso o intimidación" },
  { id: "spam", label: "Spam o publicidad" },
  { id: "otro", label: "Otro" },
] as const;

export type ChatReportCategoryId = (typeof CHAT_REPORT_CATEGORIES)[number]["id"];

const POST_IDS = new Set(POST_REPORT_CATEGORIES.map((c) => c.id));
const CHAT_IDS = new Set(CHAT_REPORT_CATEGORIES.map((c) => c.id));

export function normalizePostReportCategories(raw: unknown): PostReportCategoryId[] {
  if (!Array.isArray(raw)) return [];
  const out: PostReportCategoryId[] = [];
  for (const v of raw) {
    if (typeof v === "string" && POST_IDS.has(v as PostReportCategoryId)) {
      const id = v as PostReportCategoryId;
      if (!out.includes(id)) out.push(id);
    }
  }
  return out;
}

export function normalizeChatReportCategories(raw: unknown): ChatReportCategoryId[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatReportCategoryId[] = [];
  for (const v of raw) {
    if (typeof v === "string" && CHAT_IDS.has(v as ChatReportCategoryId)) {
      const id = v as ChatReportCategoryId;
      if (!out.includes(id)) out.push(id);
    }
  }
  return out;
}

export function categoryLabels(
  ids: readonly string[],
  list: readonly { id: string; label: string }[],
): string[] {
  const map = new Map(list.map((c) => [c.id, c.label]));
  return ids.map((id) => map.get(id) ?? id);
}

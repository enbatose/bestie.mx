/** Client mirror of server post/chat report categories. */
export const POST_REPORT_CATEGORIES = [
  { id: "estafa", label: "Estafa o fraude" },
  { id: "fotos_falsas", label: "Fotos falsas o engañosas" },
  { id: "contenido_inapropiado", label: "Contenido inapropiado" },
  { id: "spam", label: "Spam o publicidad" },
  { id: "info_falsa", label: "Información falsa" },
  { id: "otro", label: "Otro" },
] as const;

export const CHAT_REPORT_CATEGORIES = [
  { id: "estafa", label: "Estafa o fraude" },
  { id: "ofensas", label: "Ofensas o insultos" },
  { id: "falta_respeto", label: "Falta de respeto" },
  { id: "discriminacion", label: "Discriminación" },
  { id: "acoso", label: "Acoso o intimidación" },
  { id: "spam", label: "Spam o publicidad" },
  { id: "otro", label: "Otro" },
] as const;

export type PostReportCategoryId = (typeof POST_REPORT_CATEGORIES)[number]["id"];
export type ChatReportCategoryId = (typeof CHAT_REPORT_CATEGORIES)[number]["id"];

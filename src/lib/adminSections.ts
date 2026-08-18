export const ADMIN_NAV_COUNT_KEYS = ["verifiedUsers", "publishedPosts", "unreadSupportMessages"] as const;
export type AdminNavCountKey = (typeof ADMIN_NAV_COUNT_KEYS)[number];

export const ADMIN_SECTIONS = [
  { id: "users", slug: "usuarios", label: "Usuarios", countKey: "verifiedUsers", inNav: true },
  { id: "property", slug: "posts", label: "Posts", countKey: "publishedPosts", inNav: true },
  { id: "soporte", slug: "soporte", label: "Soporte", countKey: "unreadSupportMessages", inNav: true },
  { id: "outreach", slug: "outreach", label: "Outreach", inNav: true },
  { id: "analytics", slug: "metricas", label: "Métricas", inNav: true },
  { id: "cities", slug: "ciudades", label: "Ciudades", inNav: false },
] as const;

export type AdminSectionId = (typeof ADMIN_SECTIONS)[number]["id"];

export const ADMIN_NAV_SECTIONS = ADMIN_SECTIONS.filter((section) => section.inNav !== false);

export const ADMIN_DEFAULT_PATH = "/admin/usuarios";

export function adminSectionPath(id: AdminSectionId): string {
  const match = ADMIN_SECTIONS.find((section) => section.id === id);
  return match ? `/admin/${match.slug}` : ADMIN_DEFAULT_PATH;
}

export function parseAdminSectionSlug(slug: string | undefined): AdminSectionId | null {
  if (!slug) return null;
  return ADMIN_SECTIONS.find((section) => section.slug === slug)?.id ?? null;
}

export function adminSupportConversationPath(conversationId: string): string {
  const id = conversationId.trim();
  return id ? `/admin/soporte?c=${encodeURIComponent(id)}` : "/admin/soporte";
}

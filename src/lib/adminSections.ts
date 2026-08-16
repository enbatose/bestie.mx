export const ADMIN_SECTIONS = [
  { id: "users", slug: "usuarios", label: "Usuarios" },
  { id: "cities", slug: "ciudades", label: "Ciudades" },
  { id: "analytics", slug: "metricas", label: "Métricas" },
  { id: "property", slug: "posts", label: "Posts" },
  { id: "soporte", slug: "soporte", label: "Soporte" },
  { id: "outreach", slug: "outreach", label: "Outreach" },
] as const;

export type AdminSectionId = (typeof ADMIN_SECTIONS)[number]["id"];

export const ADMIN_DEFAULT_PATH = "/admin/usuarios";

export function adminSectionPath(id: AdminSectionId): string {
  const match = ADMIN_SECTIONS.find((section) => section.id === id);
  return match ? `/admin/${match.slug}` : ADMIN_DEFAULT_PATH;
}

export function parseAdminSectionSlug(slug: string | undefined): AdminSectionId | null {
  if (!slug) return null;
  return ADMIN_SECTIONS.find((section) => section.slug === slug)?.id ?? null;
}

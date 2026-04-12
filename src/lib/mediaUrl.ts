/** Turn `/api/uploads/...` into an absolute URL for `<img src>` when the SPA talks to a separate API host. */
export function apiAbsoluteUrl(relativeOrAbsolute: string): string {
  const t = relativeOrAbsolute.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  const base = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, "") ?? "";
  if (!base) return t;
  return `${base}${t.startsWith("/") ? t : `/${t}`}`;
}

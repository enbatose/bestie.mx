import { apiBase } from "@/lib/apiBase";

/** Turn `/api/uploads/...` into an absolute URL for `<img src>` when the API host is not the page origin. */
export function apiAbsoluteUrl(relativeOrAbsolute: string): string {
  const t = relativeOrAbsolute.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  const base = apiBase();
  if (!base) return t;
  return `${base}${t.startsWith("/") ? t : `/${t}`}`;
}

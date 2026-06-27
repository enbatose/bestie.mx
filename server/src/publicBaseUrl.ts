/** Canonical public site origin for links in emails (no trailing slash). */
export function publicBaseUrl(): string {
  const raw =
    process.env.PUBLIC_BASE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    process.env.WEB_ORIGIN?.trim();
  return (raw || "https://www.bestie.mx").replace(/\/+$/, "");
}

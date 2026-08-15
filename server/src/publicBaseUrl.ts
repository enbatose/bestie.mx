const PRODUCTION_PUBLIC_HOSTS = new Set(["www.bestie.mx", "bestie.mx"]);

/** Canonical public site origin for links in emails (no trailing slash). */
export function publicBaseUrl(): string {
  const raw =
    process.env.PUBLIC_BASE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    process.env.WEB_ORIGIN?.trim() ||
    // Railway Dev/Prod already set this for OAuth redirects; honor it for share/email links too.
    process.env.PUBLIC_WEB_ORIGIN?.trim();
  return (raw || "https://www.bestie.mx").replace(/\/+$/, "");
}

/**
 * True only on real Prod (`www.bestie.mx` / apex). Railway Dev (`dev.bestie.mx`),
 * local, and preview origins stay false even when NODE_ENV=production.
 */
export function isProductionPublicSite(): boolean {
  try {
    const host = new URL(publicBaseUrl()).hostname.toLowerCase();
    return PRODUCTION_PUBLIC_HOSTS.has(host);
  } catch {
    return false;
  }
}

/**
 * Origin for Open Graph / social preview assets.
 * Prefer the request Host so Dev listings point scrapers at `dev.bestie.mx`
 * uploads (not Prod `www`, where Dev files 404). Falls back to {@link publicBaseUrl}.
 */
export function sharePreviewBaseUrl(req: {
  get(name: string): string | undefined;
}): string {
  const rawHost = (req.get("x-forwarded-host") ?? req.get("host") ?? "")
    .split(",")[0]
    ?.trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
  if (rawHost === "dev.bestie.mx" || rawHost === "www.bestie.mx" || rawHost === "bestie.mx") {
    const host = rawHost === "bestie.mx" ? "www.bestie.mx" : rawHost;
    return `https://${host}`;
  }
  return publicBaseUrl();
}

/**
 * Base URL for API requests (no trailing slash).
 * - Set `VITE_API_URL` for static hosts (e.g. GitHub Pages): build must embed your real API origin.
 * - Leave empty for same-origin `/api/...` (Vite dev proxy, or Node serving SPA+API together).
 * - Production canonical API is `https://www.bestie.mx`; if a stale/static bare-domain page is served
 *   without `VITE_API_URL`, route API calls there instead of posting to static hosting.
 */
export function apiBase(): string {
  const raw = (import.meta.env.VITE_API_URL ?? "").trim();
  if (raw) return raw.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location.hostname === "bestie.mx") {
    return "https://www.bestie.mx";
  }
  return "";
}

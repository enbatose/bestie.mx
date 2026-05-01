/**
 * Base URL for API requests (no trailing slash).
 * - Set `VITE_API_URL` for static hosts (e.g. GitHub Pages): build must embed your real API origin.
 * - Leave empty for same-origin `/api/...` (Vite dev proxy, or Node serving SPA+API together).
 */
export function apiBase(): string {
  const raw = (import.meta.env.VITE_API_URL ?? "").trim();
  if (raw) return raw.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location.hostname.endsWith("bestie.mx")) {
    return window.location.origin;
  }
  return "";
}

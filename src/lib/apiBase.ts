/**
 * Base URL for API requests (no trailing slash).
 * - Leave empty for same-origin `/api/...` (Vite dev proxy, or Railway serving SPA+API together).
 * - Set `VITE_API_URL` only for local dev when the API runs on another port (see `scripts/write-env-local.mjs`).
 */
export function apiBase(): string {
  const raw = (import.meta.env.VITE_API_URL ?? "").trim();
  if (raw) return raw.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location.hostname.endsWith("bestie.mx")) {
    return window.location.origin;
  }
  return "";
}

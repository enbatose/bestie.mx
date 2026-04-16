/**
 * Base URL for API requests (no trailing slash).
 * - Set `VITE_API_URL` when the API is on another origin (typical CDN + API split).
 * - Leave unset: requests use same-origin `/api/...` (Vite dev proxy, or production
 *   when the API is mounted on the same host as this bundle).
 */
export function apiBase(): string {
  const raw = import.meta.env.VITE_API_URL?.trim() ?? "";
  return raw.replace(/\/$/, "");
}

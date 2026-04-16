/**
 * Base URL for API requests (no trailing slash).
 * - Set `VITE_API_URL` in production or when the API is on another origin.
 * - Leave unset in local dev: requests use same-origin `/api/...` and Vite proxies
 *   to the backend (see `vite.config.ts`).
 */
export function apiBase(): string {
  const raw = import.meta.env.VITE_API_URL?.trim() ?? "";
  return raw.replace(/\/$/, "");
}

/** True when the app can reach the API (explicit URL or dev + proxy). */
export function isApiReachable(): boolean {
  if (apiBase().length > 0) return true;
  return Boolean(import.meta.env.DEV);
}

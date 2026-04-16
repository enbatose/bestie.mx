/**
 * Base URL for API requests (no trailing slash).
 * - Prefer `VITE_API_URL` when the API is on another host (CI / .env.production).
 * - On **bestie.mx** / **www.bestie.mx** in production, if unset, default to
 *   `https://api.bestie.mx` so POST `/api/...` is not sent to a static CDN (405).
 * - Otherwise empty: same-origin `/api/...` (Vite dev proxy, or Node serving SPA+API).
 */
export function apiBase(): string {
  const raw = (import.meta.env.VITE_API_URL ?? "").trim();
  if (raw) return raw.replace(/\/$/, "");

  if (typeof window !== "undefined" && import.meta.env.PROD) {
    const h = window.location.hostname.toLowerCase();
    if (h === "bestie.mx" || h === "www.bestie.mx") {
      const override = (import.meta.env.VITE_API_ORIGIN_FALLBACK ?? "").trim();
      return (override || "https://api.bestie.mx").replace(/\/$/, "");
    }
  }

  return "";
}

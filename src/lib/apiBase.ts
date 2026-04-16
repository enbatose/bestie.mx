/**
 * Base URL for API requests (no trailing slash).
 * - Set `VITE_API_URL` for static hosts (e.g. GitHub Pages): build must embed your real API origin.
 * - Leave empty for same-origin `/api/...` (Vite dev proxy, or Node serving SPA+API together).
 */
export function apiBase(): string {
  const raw = (import.meta.env.VITE_API_URL ?? "").trim();
  if (raw) return raw.replace(/\/$/, "");

  if (typeof window !== "undefined" && import.meta.env.PROD) {
    const h = window.location.hostname.toLowerCase();
    if (h === "bestie.mx" || h === "www.bestie.mx" || h.includes("github.io")) {
      return "https://api.bestie.mx";
    }
  }

  return "";
}

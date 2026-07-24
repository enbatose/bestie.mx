export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

/** Web Share when available, clipboard otherwise. Used by Mis Anuncios card actions. */
export async function shareListingLink(path: string, title: string): Promise<ShareResult> {
  const url = `${window.location.origin}${path}`;
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ title, url });
      return "shared";
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return "copied";
    }
  } catch {
    // fall through to failed
  }
  return "failed";
}

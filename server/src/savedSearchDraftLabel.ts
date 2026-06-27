import { metroTimeZone } from "./metroCities.js";
import type { SavedSearchLocationSnapshot } from "./savedSearchMatch.js";

/** "26 jun 2025, 14:35 · Ciudad de México · Roma Norte, Condesa" */
export function formatSavedSearchDraftLabel(
  location: SavedSearchLocationSnapshot,
  at: Date = new Date(),
): string {
  const tz = metroTimeZone(location.cityCode);
  const parts = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).formatToParts(at);

  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = (parts.find((p) => p.type === "month")?.value ?? "").replace(/\.$/, "");
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "";
  const dateTime = `${day} ${month} ${year}, ${hour}:${minute}`;

  const city = location.cityLabel?.trim() || location.cityCode.toUpperCase();
  const segments = [dateTime, city];
  if (location.neighborhoods.length) {
    segments.push(location.neighborhoods.map((n) => n.name).join(", "));
  }
  return segments.join(" · ");
}

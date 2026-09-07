import type { SearchFilters } from "./searchFilters.js";
import type { SavedSearchLocationSnapshot } from "./savedSearchMatch.js";

function moneyMx(n: number): string {
  return `$${Math.round(n).toLocaleString("es-MX")}`;
}

/** "Providencia · máx. $8,000" — zone plus one budget chip, not a timestamp. */
export function formatSavedSearchDraftLabel(
  location: SavedSearchLocationSnapshot,
  filters?: SearchFilters | null,
): string {
  const zone = location.neighborhoods.length
    ? location.neighborhoods.map((n) => n.name.trim()).filter(Boolean).join(", ")
    : location.cityLabel?.trim() || location.cityCode.toUpperCase();
  const budget =
    filters?.budgetMax != null
      ? `máx. ${moneyMx(filters.budgetMax)}`
      : filters?.budgetMin != null
        ? `mín. ${moneyMx(filters.budgetMin)}`
        : "";
  return [zone, budget].filter(Boolean).join(" · ").slice(0, 200);
}

import { activeSearchFilterChips } from "@/lib/searchActiveFilterChips";
import type { SearchFilters } from "@/lib/searchFilters";
import type { SearchLocationState } from "@/lib/searchLocation";

type Props = {
  filters: SearchFilters;
  searchLocation: Pick<SearchLocationState, "cityLabel" | "neighborhoods">;
};

export function ActiveSearchFilterChips({ filters, searchLocation }: Props) {
  const chips = activeSearchFilterChips(filters, searchLocation);
  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => {
        const Icon = chip.icon;
        return (
          <span
            key={chip.id}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/15 bg-surface px-2.5 py-1 text-xs font-medium text-body shadow-sm"
          >
            <Icon className="size-3.5 shrink-0 text-primary" aria-hidden strokeWidth={2.1} />
            <span className="truncate">{chip.label}</span>
          </span>
        );
      })}
    </div>
  );
}

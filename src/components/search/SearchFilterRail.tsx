import {
  ADVANCED_FILTERS_META,
  MAP_QUICK_FILTERS,
} from "@/components/search/searchQuickAttributes";
import type { SearchFilters } from "@/lib/searchFilters";

type Props = {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  onOpenAdvanced: () => void;
};

const railBtnClass = (active: boolean) =>
  `pointer-events-auto flex min-h-[4.25rem] min-w-[4.5rem] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border px-3 py-2 text-center text-[11px] font-semibold shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 sm:min-h-[4.5rem] sm:min-w-[4.75rem] ${
    active
      ? "border-secondary bg-primary text-primary-fg ring-2 ring-secondary/35"
      : "border-border bg-surface/95 text-primary hover:border-secondary/60 hover:bg-surface"
  }`;

export function SearchFilterRail({ filters, onChange, onOpenAdvanced }: Props) {
  const AdvancedIcon = ADVANCED_FILTERS_META.icon;
  return (
    <aside
      className="pointer-events-none absolute inset-x-0 top-0 z-[1100] p-2 sm:p-3"
      aria-label="Filtros rápidos"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <div className="flex min-w-max snap-x snap-mandatory items-stretch gap-2 pb-1">
            {MAP_QUICK_FILTERS.map((filterMeta) => {
              const active = filterMeta.isActive(filters);
              const Icon = filterMeta.icon;
              return (
                <button
                  key={filterMeta.id}
                  type="button"
                  title={filterMeta.tooltip}
                  aria-label={filterMeta.tooltip}
                  aria-pressed={active}
                  onClick={() => onChange(filterMeta.toggle(filters))}
                  className={`${railBtnClass(active)} snap-start`}
                >
                  <Icon className="size-[1.15rem]" aria-hidden="true" />
                  <span className="leading-none">{filterMeta.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="pointer-events-auto shrink-0">
          <button
            type="button"
            title={ADVANCED_FILTERS_META.tooltip}
            aria-label={ADVANCED_FILTERS_META.tooltip}
            onClick={onOpenAdvanced}
            className={railBtnClass(false)}
          >
            <AdvancedIcon className="size-[1.15rem]" aria-hidden="true" />
            <span className="leading-none">{ADVANCED_FILTERS_META.label}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

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
  `pointer-events-auto inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 sm:size-10 ${
    active
      ? "border-secondary bg-primary text-primary-fg ring-2 ring-secondary/35"
      : "border-border bg-surface/95 text-primary hover:border-secondary/60 hover:bg-surface"
  }`;

export function SearchFilterRail({ filters, onChange, onOpenAdvanced }: Props) {
  const AdvancedIcon = ADVANCED_FILTERS_META.icon;
  return (
    <aside
      className="pointer-events-none absolute left-2 top-20 z-[1100] sm:left-3 sm:top-24"
      aria-label="Filtros rápidos"
    >
      <div className="pointer-events-auto flex flex-col gap-2 rounded-2xl bg-surface/92 p-2 shadow-lg ring-1 ring-border backdrop-blur sm:p-2.5">
        {MAP_QUICK_FILTERS.map((filterMeta) => {
          const active = filterMeta.isActive(filters);
          const Icon = filterMeta.icon;
          return (
            <div key={filterMeta.id} className="flex items-center gap-2">
              <button
                type="button"
                title={filterMeta.tooltip}
                aria-label={filterMeta.tooltip}
                aria-pressed={active}
                onClick={() => onChange(filterMeta.toggle(filters))}
                className={railBtnClass(active)}
              >
                <Icon className="size-[0.95rem] sm:size-4" aria-hidden="true" />
              </button>
              <span
                className={`select-none text-xs font-semibold leading-none sm:text-[13px] ${
                  active ? "text-primary" : "text-body"
                }`}
              >
                {filterMeta.label}
              </span>
            </div>
          );
        })}
        <div className="mt-1 border-t border-border/80 pt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              title={ADVANCED_FILTERS_META.tooltip}
              aria-label={ADVANCED_FILTERS_META.tooltip}
              onClick={onOpenAdvanced}
              className={railBtnClass(false)}
            >
              <AdvancedIcon className="size-[0.95rem] sm:size-4" aria-hidden="true" />
            </button>
            <span className="select-none text-xs font-semibold leading-none text-body sm:text-[13px]">
              {ADVANCED_FILTERS_META.label}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

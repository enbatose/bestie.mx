import { useEffect, useState } from "react";
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

const MOBILE_FILTER_RAIL_SEEN_KEY = "bestie:mobile-search-filter-rail-seen";

function getMobileRailDefaultExpanded() {
  if (typeof window === "undefined") return true;
  if (!window.matchMedia("(max-width: 639px)").matches) return true;

  try {
    return window.sessionStorage.getItem(MOBILE_FILTER_RAIL_SEEN_KEY) !== "1";
  } catch {
    return true;
  }
}

const railBtnClass = (active: boolean) =>
  `pointer-events-auto inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 sm:size-10 ${
    active
      ? "border-secondary bg-primary text-primary-fg ring-2 ring-secondary/35"
      : "border-border bg-surface/95 text-primary hover:border-secondary/60 hover:bg-surface"
  }`;

export function SearchFilterRail({ filters, onChange, onOpenAdvanced }: Props) {
  const [mobileExpanded, setMobileExpanded] = useState(getMobileRailDefaultExpanded);
  const AdvancedIcon = ADVANCED_FILTERS_META.icon;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 639px)").matches) return;

    try {
      window.sessionStorage.setItem(MOBILE_FILTER_RAIL_SEEN_KEY, "1");
    } catch {
      /* session storage unavailable */
    }
  }, []);

  return (
    <aside
      className="pointer-events-none absolute left-2 top-20 z-[1100] sm:left-3 sm:top-24"
      aria-label="Filtros rápidos"
    >
      <div className="pointer-events-auto flex items-start gap-1 sm:hidden">
        <div className="flex flex-col gap-2 rounded-[2rem] bg-surface/76 p-2 shadow-lg ring-1 ring-border/80 backdrop-blur-md">
          {MAP_QUICK_FILTERS.map((filterMeta) => {
            const active = filterMeta.isActive(filters);
            const Icon = filterMeta.icon;
            return (
              <div key={filterMeta.id} className="flex items-center">
                <button
                  type="button"
                  title={filterMeta.tooltip}
                  aria-label={filterMeta.tooltip}
                  aria-pressed={active}
                  onClick={() => onChange(filterMeta.toggle(filters))}
                  className={railBtnClass(active)}
                >
                  <Icon className="size-[0.95rem]" aria-hidden="true" />
                </button>
                <span
                  className={`overflow-hidden whitespace-nowrap text-xs font-semibold leading-none transition-[width,opacity,margin] duration-200 ease-out ${
                    active ? "text-primary" : "text-body"
                  } ${mobileExpanded ? "ml-2 w-[7.25rem] opacity-100" : "ml-0 w-0 opacity-0"}`}
                >
                  {filterMeta.label}
                </span>
              </div>
            );
          })}

          <div className="mt-1 border-t border-border/80 pt-2">
            <div className="flex items-center">
              <button
                type="button"
                title={ADVANCED_FILTERS_META.tooltip}
                aria-label={ADVANCED_FILTERS_META.tooltip}
                onClick={onOpenAdvanced}
                className={railBtnClass(false)}
              >
                <AdvancedIcon className="size-[0.95rem]" aria-hidden="true" />
              </button>
              <span
                className={`overflow-hidden whitespace-nowrap text-xs font-semibold leading-none text-body transition-[width,opacity,margin] duration-200 ease-out ${
                  mobileExpanded ? "ml-2 w-[7.25rem] opacity-100" : "ml-0 w-0 opacity-0"
                }`}
              >
                {ADVANCED_FILTERS_META.label}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileExpanded((current) => !current)}
          aria-label={mobileExpanded ? "Colapsar etiquetas de filtros" : "Expandir etiquetas de filtros"}
          aria-expanded={mobileExpanded}
          className="mt-3 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-surface/70 text-primary/70 shadow-sm ring-1 ring-border/70 backdrop-blur-md transition hover:bg-surface/90 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className={`transition-transform duration-200 ${mobileExpanded ? "" : "rotate-180"}`}
            aria-hidden
          >
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m15 6-6 6 6 6" />
          </svg>
        </button>
      </div>

      <div className="hidden sm:flex sm:flex-col sm:gap-2 sm:rounded-2xl sm:bg-surface/92 sm:p-2.5 sm:shadow-lg sm:ring-1 sm:ring-border sm:backdrop-blur">
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
                <Icon className="size-4" aria-hidden="true" />
              </button>
              <span
                className={`select-none text-[13px] font-semibold leading-none ${
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
              <AdvancedIcon className="size-4" aria-hidden="true" />
            </button>
            <span className="select-none text-[13px] font-semibold leading-none text-body">
              {ADVANCED_FILTERS_META.label}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

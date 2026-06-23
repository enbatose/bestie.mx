import { Filter } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  ADVANCED_FILTERS_META,
  MAP_QUICK_FILTERS,
  MOBILE_MAP_QUICK_FILTERS,
} from "@/components/search/searchQuickAttributes";
import type { SearchFilters } from "@/lib/searchFilters";

type Props = {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  onOpenAdvanced: () => void;
};

const MOBILE_FILTER_RAIL_SEEN_KEY = "bestie:mobile-search-filter-rail-seen";
const MOBILE_RAIL_AUTO_COLLAPSE_TOTAL_MS = 7_000;
const MOBILE_RAIL_COLLAPSE_HINT_MS = 1_800;

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
  const [showCollapseHint, setShowCollapseHint] = useState(false);
  const AdvancedIcon = ADVANCED_FILTERS_META.icon;
  const initialMobileExpandedRef = useRef(mobileExpanded);
  const mobileRailInteractedRef = useRef(false);
  const mobileRailHintTimerRef = useRef<number | null>(null);
  const mobileRailCollapseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 639px)").matches) return;

    try {
      window.sessionStorage.setItem(MOBILE_FILTER_RAIL_SEEN_KEY, "1");
    } catch {
      /* session storage unavailable */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!initialMobileExpandedRef.current) return;
    if (!window.matchMedia("(max-width: 639px)").matches) return;

    mobileRailHintTimerRef.current = window.setTimeout(() => {
      if (mobileRailInteractedRef.current) return;
      setShowCollapseHint(true);

      mobileRailCollapseTimerRef.current = window.setTimeout(() => {
        if (mobileRailInteractedRef.current) return;
        setShowCollapseHint(false);
        setMobileExpanded(false);
      }, MOBILE_RAIL_COLLAPSE_HINT_MS);
    }, Math.max(0, MOBILE_RAIL_AUTO_COLLAPSE_TOTAL_MS - MOBILE_RAIL_COLLAPSE_HINT_MS));

    return () => {
      if (mobileRailHintTimerRef.current != null) window.clearTimeout(mobileRailHintTimerRef.current);
      if (mobileRailCollapseTimerRef.current != null) window.clearTimeout(mobileRailCollapseTimerRef.current);
    };
  }, []);

  return (
    <aside
      className="pointer-events-none absolute left-2 top-3 z-[1100] sm:left-3 sm:top-24"
      aria-label="Filtros rápidos"
    >
      <div className="pointer-events-auto flex items-start gap-0.5 sm:hidden">
        <div className="flex flex-col gap-2 rounded-[2rem] bg-surface/76 p-2 shadow-lg ring-1 ring-border/80 backdrop-blur-md">
          {MOBILE_MAP_QUICK_FILTERS.map((filterMeta) => {
            const active = filterMeta.isActive(filters);
            const Icon = filterMeta.icon;
            const mobileLabel = filterMeta.mobileLabel ?? filterMeta.label;
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
                  className={`overflow-hidden text-[11px] font-semibold leading-tight transition-[width,opacity,margin] duration-200 ease-out ${
                    active ? "text-primary" : "text-body"
                  } ${mobileExpanded ? "ml-2 w-[8rem] opacity-100" : "ml-0 w-0 opacity-0"}`}
                >
                  {mobileLabel}
                </span>
              </div>
            );
          })}

          <div>
            <div className="flex items-center">
              <button
                type="button"
                title={ADVANCED_FILTERS_META.tooltip}
                aria-label={ADVANCED_FILTERS_META.tooltip}
                onClick={onOpenAdvanced}
                className="pointer-events-auto inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 border-primary bg-surface/95 text-body shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 hover:bg-surface"
              >
                <Filter className="size-[0.95rem]" aria-hidden="true" />
              </button>
              <span
                className={`overflow-hidden text-[11px] font-semibold leading-tight text-body transition-[width,opacity,margin] duration-200 ease-out ${
                  mobileExpanded ? "ml-2 w-[8rem] opacity-100" : "ml-0 w-0 opacity-0"
                }`}
              >
                Más Filtros
              </span>
            </div>
          </div>
        </div>
        <div className="relative mt-3">
          {showCollapseHint ? (
            <svg className="pointer-events-none absolute -inset-1 z-10" viewBox="0 0 44 52" aria-hidden>
              <rect
                x="1.5"
                y="1.5"
                width="41"
                height="49"
                rx="14"
                ry="14"
                fill="none"
                stroke="#065f46"
                strokeWidth="3.25"
                pathLength="1"
                strokeDasharray="0.22 0.78"
                className="animate-[autosave-ring-travel_1.8s_linear_forwards] drop-shadow-[0_0_8px_rgba(6,95,70,0.55)]"
              />
            </svg>
          ) : null}
          <button
            type="button"
            onClick={() => {
              mobileRailInteractedRef.current = true;
              if (mobileRailHintTimerRef.current != null) window.clearTimeout(mobileRailHintTimerRef.current);
              if (mobileRailCollapseTimerRef.current != null) window.clearTimeout(mobileRailCollapseTimerRef.current);
              setShowCollapseHint(false);
              setMobileExpanded((current) => !current);
            }}
            aria-label={mobileExpanded ? "Colapsar etiquetas de filtros" : "Expandir etiquetas de filtros"}
            aria-expanded={mobileExpanded}
            className="relative z-20 inline-flex h-11 w-9 shrink-0 items-center justify-center rounded-r-2xl rounded-l-md border-2 border-white/90 bg-primary text-primary-fg shadow-[0_10px_24px_rgba(0,0,0,0.22)] ring-1 ring-primary/35 transition hover:scale-[1.03] hover:bg-primary/92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className={`transition-transform duration-200 ${mobileExpanded ? "" : "rotate-180"}`}
              aria-hidden
            >
              <path strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="m14 6-6 6 6 6" />
            </svg>
          </button>
        </div>
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

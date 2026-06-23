import { Filter } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  ADVANCED_FILTERS_META,
  MOBILE_MAP_QUICK_FILTERS,
} from "@/components/search/searchQuickAttributes";
import type { SearchFilters } from "@/lib/searchFilters";

type Props = {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  onOpenAdvanced: () => void;
};

const FILTER_RAIL_SEEN_KEY = "bestie:search-filter-rail-seen";
const LEGACY_FILTER_RAIL_SEEN_KEY = "bestie:mobile-search-filter-rail-seen";
const RAIL_AUTO_COLLAPSE_TOTAL_MS = 7_000;
const RAIL_COLLAPSE_HINT_MS = 1_800;

function getRailDefaultExpanded() {
  if (typeof window === "undefined") return true;

  try {
    const seen =
      window.sessionStorage.getItem(FILTER_RAIL_SEEN_KEY) === "1" ||
      window.sessionStorage.getItem(LEGACY_FILTER_RAIL_SEEN_KEY) === "1";
    return !seen;
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

function quickFilterIconClass(filterId: string) {
  if (filterId === "tag-lgbt-friendly") {
    return "h-full w-full px-0.5";
  }

  return "size-[0.95rem] sm:size-4";
}

export function SearchFilterRail({ filters, onChange, onOpenAdvanced }: Props) {
  const [labelsExpanded, setLabelsExpanded] = useState(getRailDefaultExpanded);
  const [showCollapseHint, setShowCollapseHint] = useState(false);
  const initialExpandedRef = useRef(labelsExpanded);
  const railInteractedRef = useRef(false);
  const railHintTimerRef = useRef<number | null>(null);
  const railCollapseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.sessionStorage.setItem(FILTER_RAIL_SEEN_KEY, "1");
      window.sessionStorage.setItem(LEGACY_FILTER_RAIL_SEEN_KEY, "1");
    } catch {
      /* session storage unavailable */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!initialExpandedRef.current) return;

    railHintTimerRef.current = window.setTimeout(() => {
      if (railInteractedRef.current) return;
      setShowCollapseHint(true);

      railCollapseTimerRef.current = window.setTimeout(() => {
        if (railInteractedRef.current) return;
        setShowCollapseHint(false);
        setLabelsExpanded(false);
      }, RAIL_COLLAPSE_HINT_MS);
    }, Math.max(0, RAIL_AUTO_COLLAPSE_TOTAL_MS - RAIL_COLLAPSE_HINT_MS));

    return () => {
      if (railHintTimerRef.current != null) window.clearTimeout(railHintTimerRef.current);
      if (railCollapseTimerRef.current != null) window.clearTimeout(railCollapseTimerRef.current);
    };
  }, []);

  return (
    <aside
      className="pointer-events-none absolute left-2 top-6 z-[1100] sm:left-3 sm:top-24"
      aria-label="Filtros rápidos"
    >
      <div className="pointer-events-auto flex items-start gap-0.5">
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
                  <Icon className={quickFilterIconClass(filterMeta.id)} aria-hidden="true" />
                </button>
                <span
                  className={`overflow-hidden text-[11px] font-semibold leading-tight transition-[width,opacity,margin] duration-200 ease-out ${
                    active ? "text-primary" : "text-body"
                  } ${labelsExpanded ? "ml-2 w-[8rem] opacity-100" : "ml-0 w-0 opacity-0"}`}
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
                className="pointer-events-auto inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 border-primary bg-surface/95 text-body shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 hover:bg-surface sm:size-10"
              >
                <Filter className="size-[0.95rem]" aria-hidden="true" />
              </button>
              <span
                className={`overflow-hidden text-[11px] font-semibold leading-tight text-body transition-[width,opacity,margin] duration-200 ease-out ${
                  labelsExpanded ? "ml-2 w-[8rem] opacity-100" : "ml-0 w-0 opacity-0"
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
              railInteractedRef.current = true;
              if (railHintTimerRef.current != null) window.clearTimeout(railHintTimerRef.current);
              if (railCollapseTimerRef.current != null) window.clearTimeout(railCollapseTimerRef.current);
              setShowCollapseHint(false);
              setLabelsExpanded((current) => !current);
            }}
            aria-label={labelsExpanded ? "Colapsar etiquetas de filtros" : "Expandir etiquetas de filtros"}
            aria-expanded={labelsExpanded}
            className="relative z-20 inline-flex h-11 w-9 shrink-0 items-center justify-center rounded-r-2xl rounded-l-md border-2 border-white/90 bg-primary text-primary-fg shadow-[0_10px_24px_rgba(0,0,0,0.22)] ring-1 ring-primary/35 transition hover:scale-[1.03] hover:bg-primary/92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className={`transition-transform duration-200 ${labelsExpanded ? "" : "rotate-180"}`}
              aria-hidden
            >
              <path strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="m14 6-6 6 6 6" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

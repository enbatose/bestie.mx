import { List, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MOBILE_LIST_DRAWER_LEFT_CLASS } from "@/components/search/SearchFilterRail";
import { SearchResultsList } from "@/components/search/SearchResultsList";
import type { SearchReturnContext } from "@/lib/searchReturn";
import type { PropertyListing } from "@/types/listing";

type Props = {
  listings: PropertyListing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchReturn: SearchReturnContext;
  filterRailLabelsExpanded: boolean;
  countLabel: ReactNode;
  onDrawerOpen?: () => void;
};

const LIST_TAB_WIDTH = "2.5rem";

export function SearchMobileResultsPanel({
  listings,
  selectedId,
  onSelect,
  searchReturn,
  filterRailLabelsExpanded,
  countLabel,
  onDrawerOpen,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const restoreAfterLegendCollapseRef = useRef(false);
  const userClosedListRef = useRef(false);
  const prevLegendExpandedRef = useRef(filterRailLabelsExpanded);

  useEffect(() => {
    const wasLegend = prevLegendExpandedRef.current;
    const isLegend = filterRailLabelsExpanded;
    prevLegendExpandedRef.current = isLegend;

    if (!wasLegend && isLegend) {
      setExpanded((current) => {
        if (current) {
          restoreAfterLegendCollapseRef.current = true;
          userClosedListRef.current = false;
          return false;
        }
        return current;
      });
      return;
    }

    if (
      wasLegend &&
      !isLegend &&
      restoreAfterLegendCollapseRef.current &&
      !userClosedListRef.current
    ) {
      restoreAfterLegendCollapseRef.current = false;
      setExpanded(true);
    }
  }, [filterRailLabelsExpanded]);

  const toggleDrawer = () => {
    setExpanded((current) => {
      const next = !current;
      if (next) {
        userClosedListRef.current = false;
        restoreAfterLegendCollapseRef.current = false;
        onDrawerOpen?.();
      } else {
        userClosedListRef.current = true;
        restoreAfterLegendCollapseRef.current = false;
      }
      return next;
    });
  };

  const closeDrawer = () => {
    userClosedListRef.current = true;
    restoreAfterLegendCollapseRef.current = false;
    setExpanded(false);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-[1090] lg:hidden">
      <div
        className={`pointer-events-auto absolute inset-y-0 right-0 flex min-w-0 transition-[left,width] duration-300 ease-out ${
          expanded ? MOBILE_LIST_DRAWER_LEFT_CLASS : "left-auto"
        }`}
        style={{
          width: expanded ? undefined : LIST_TAB_WIDTH,
        }}
      >
        <button
          type="button"
          onClick={toggleDrawer}
          aria-label={expanded ? "Ocultar listado" : "Mostrar listado"}
          aria-expanded={expanded}
          className="relative z-10 inline-flex h-11 w-10 shrink-0 items-center justify-center self-center rounded-l-2xl rounded-r-md border-2 border-white/90 bg-primary text-primary-fg shadow-[0_10px_24px_rgba(0,0,0,0.22)] ring-1 ring-primary/35 transition hover:scale-[1.03] hover:bg-primary/92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90"
        >
          <List className="size-4" aria-hidden="true" />
        </button>

        {expanded ? (
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-l border-border bg-surface/97 shadow-[-12px_0_32px_rgba(0,0,0,0.12)] backdrop-blur-md">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
              <h2 className="text-sm font-semibold text-body">Listados</h2>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted">{countLabel}</p>
                <button
                  type="button"
                  onClick={closeDrawer}
                  aria-label="Cerrar listado"
                  className="inline-flex size-7 items-center justify-center rounded-full border border-border bg-surface/90 text-primary shadow-sm transition hover:border-secondary/60 hover:bg-bg-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
              <SearchResultsList
                dense
                cardVariant="mobile-drawer"
                listings={listings}
                selectedId={selectedId}
                onSelect={onSelect}
                searchReturn={searchReturn}
              />
              {listings.length ? (
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface/95 px-3 py-3 text-sm font-semibold text-primary shadow-sm transition hover:border-secondary/60 hover:bg-bg-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
                >
                  <X className="size-4" aria-hidden="true" />
                  Cerrar listado
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

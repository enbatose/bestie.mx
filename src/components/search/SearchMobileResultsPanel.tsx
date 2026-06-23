import { List } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { MOBILE_FILTER_RAIL_INSET_COLLAPSED } from "@/components/search/SearchFilterRail";
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
};

const LIST_TAB_WIDTH = "2.5rem";

export function SearchMobileResultsPanel({
  listings,
  selectedId,
  onSelect,
  searchReturn,
  filterRailLabelsExpanded,
  countLabel,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const restoreAfterLegendCollapseRef = useRef(false);
  const prevLegendExpandedRef = useRef(filterRailLabelsExpanded);

  useEffect(() => {
    const wasLegend = prevLegendExpandedRef.current;
    const isLegend = filterRailLabelsExpanded;
    prevLegendExpandedRef.current = isLegend;

    if (!wasLegend && isLegend) {
      setExpanded((current) => {
        if (current) {
          restoreAfterLegendCollapseRef.current = true;
          return false;
        }
        return current;
      });
      return;
    }

    if (wasLegend && !isLegend && restoreAfterLegendCollapseRef.current) {
      restoreAfterLegendCollapseRef.current = false;
      setExpanded(true);
    }
  }, [filterRailLabelsExpanded]);

  const drawerStyle: CSSProperties = expanded
    ? { left: MOBILE_FILTER_RAIL_INSET_COLLAPSED, right: 0 }
    : { left: "auto", right: 0, width: LIST_TAB_WIDTH };

  return (
    <div className="pointer-events-none absolute inset-0 z-[1090] lg:hidden">
      <div
        className="pointer-events-auto absolute inset-y-0 flex min-w-0 transition-[left,width] duration-300 ease-out"
        style={drawerStyle}
        aria-hidden={!expanded}
      >
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-label={expanded ? "Ocultar listado" : "Mostrar listado"}
          aria-expanded={expanded}
          className="inline-flex h-11 w-10 shrink-0 items-center justify-center self-center rounded-l-2xl rounded-r-md border-2 border-white/90 bg-primary text-primary-fg shadow-[0_10px_24px_rgba(0,0,0,0.22)] ring-1 ring-primary/35 transition hover:scale-[1.03] hover:bg-primary/92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90"
        >
          <List className="size-4" aria-hidden="true" />
        </button>

        <div
          className={`flex min-w-0 flex-1 flex-col overflow-hidden border-l border-border bg-surface/97 shadow-[-12px_0_32px_rgba(0,0,0,0.12)] backdrop-blur-md transition-opacity duration-200 ${
            expanded ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <h2 className="text-sm font-semibold text-body">Listados</h2>
            <p className="text-xs text-muted">{countLabel}</p>
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
          </div>
        </div>
      </div>
    </div>
  );
}

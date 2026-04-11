import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PropertyMap } from "@/components/map/PropertyMap";
import { SearchFilterRail } from "@/components/search/SearchFilterRail";
import { SearchResultsList } from "@/components/search/SearchResultsList";
import { SearchTopBar } from "@/components/search/SearchTopBar";
import { SEED_LISTINGS } from "@/data/seedListings";
import {
  filterListings,
  filtersToParams,
  parseFilters,
  type SearchFilters,
} from "@/lib/searchFilters";

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  const filtered = useMemo(() => filterListings(SEED_LISTINGS, filters), [filters]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchOnMapMove, setSearchOnMapMove] = useState(false);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((cur) => (cur && filtered.some((l) => l.id === cur) ? cur : filtered[0]!.id));
  }, [filtered]);

  function applyFilters(next: SearchFilters) {
    setSearchParams(filtersToParams(next), { replace: true });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg-light">
      <SearchTopBar
        filters={filters}
        onChange={applyFilters}
        searchOnMapMove={searchOnMapMove}
        onSearchOnMapMoveChange={setSearchOnMapMove}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ~2/3: rail + map (Roomix-style) */}
        <section className="relative flex min-h-0 min-w-0 flex-[2] flex-col border-border lg:border-r">
          <SearchFilterRail filters={filters} onChange={applyFilters} />
          <div className="relative min-h-[42vh] flex-1 lg:min-h-[calc(100dvh-10.5rem)]">
            <div className="absolute inset-0">
              <PropertyMap
                embed
                className="h-full"
                listings={filtered}
                selectedId={selectedId}
                onSelect={(id) => setSelectedId(id)}
              />
            </div>
          </div>
        </section>

        {/* ~1/3: scrollable listings */}
        <aside className="flex max-h-[46vh] min-h-0 min-w-0 flex-1 flex-col border-t border-border bg-surface lg:max-h-none lg:min-w-[280px] lg:flex-[1] lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3 sm:px-4">
            <h2 className="text-sm font-semibold text-body sm:text-base">Listados</h2>
            <p className="text-xs text-muted sm:text-sm">
              {filtered.length}/{SEED_LISTINGS.length}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
            <SearchResultsList
              dense
              listings={filtered}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id)}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

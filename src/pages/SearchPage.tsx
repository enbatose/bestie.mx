import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PropertyMap } from "@/components/map/PropertyMap";
import { SearchAdvancedSheet } from "@/components/search/SearchAdvancedSheet";
import { SearchFilterRail } from "@/components/search/SearchFilterRail";
import { SearchResultsList } from "@/components/search/SearchResultsList";
import { SearchTopBar } from "@/components/search/SearchTopBar";
import { SEED_LISTINGS } from "@/data/seedListings";
import { fetchListingsFromApi, isListingsApiConfigured } from "@/lib/listingsApi";
import {
  DEFAULT_SEARCH_CITY,
  GUADALAJARA_LA_MINERVA_CENTER,
  GUADALAJARA_LA_MINERVA_ZOOM,
  isDefaultSearchCity,
  withDefaultSearchCity,
} from "@/lib/searchDefaults";
import {
  filterListings,
  filtersToParams,
  parseFilters,
  type Bbox,
  type SearchFilters,
} from "@/lib/searchFilters";
import type { PropertyListing } from "@/types/listing";

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const normalizedFilters = useMemo(
    () => ({ ...filters, q: withDefaultSearchCity(filters.q) }),
    [filters],
  );
  const filterQueryKey = useMemo(() => filtersToParams(normalizedFilters).toString(), [normalizedFilters]);

  const apiOn = isListingsApiConfigured();
  const [apiListings, setApiListings] = useState<PropertyListing[] | undefined>(undefined);
  const [apiBusy, setApiBusy] = useState(false);
  const [apiErr, setApiErr] = useState<string | null>(null);

  useEffect(() => {
    if (!apiOn) return;
    const ac = new AbortController();
    setApiBusy(true);
    setApiErr(null);
    setApiListings(undefined);
    fetchListingsFromApi(new URLSearchParams(filterQueryKey), ac.signal)
      .then((rows) => {
        setApiListings(rows);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setApiErr("No se pudieron cargar los anuncios.");
        setApiListings([]);
      })
      .finally(() => {
        setApiBusy(false);
      });
    return () => ac.abort();
  }, [apiOn, filterQueryKey]);

  const filtered = useMemo(() => {
    if (!apiOn) return filterListings(SEED_LISTINGS, normalizedFilters);
    return apiListings ?? [];
  }, [apiOn, apiListings, normalizedFilters]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchOnMapMove, setSearchOnMapMove] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const isGuadalajaraSearch = isDefaultSearchCity(normalizedFilters.q);

  useEffect(() => {
    if (searchParams.get("q")?.trim()) return;
    setSearchParams(
      (prev) => {
        const nextFilters = parseFilters(new URLSearchParams(prev));
        return filtersToParams({ ...nextFilters, q: DEFAULT_SEARCH_CITY });
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((cur) => {
      if (cur && filtered.some((l) => l.id === cur)) return cur;
      return isGuadalajaraSearch ? null : filtered[0]!.id;
    });
  }, [filtered, isGuadalajaraSearch]);

  function applyFilters(next: SearchFilters) {
    setSearchParams(filtersToParams({ ...next, q: withDefaultSearchCity(next.q) }), { replace: true });
  }

  const onViewportBbox = useCallback(
    (bbox: Bbox) => {
      setSearchParams(
        (prev) => {
          const f = parseFilters(new URLSearchParams(prev));
          return filtersToParams({ ...f, bbox });
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg-light">
      <SearchAdvancedSheet
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        filters={normalizedFilters}
        onChange={applyFilters}
      />
      <SearchTopBar
        filters={filters}
        onChange={applyFilters}
        searchOnMapMove={searchOnMapMove}
        onSearchOnMapMoveChange={(v) => {
          setSearchOnMapMove(v);
          if (!v) {
            setSearchParams(
              (prev) => {
                const f = parseFilters(new URLSearchParams(prev));
                return filtersToParams({ ...f, q: withDefaultSearchCity(f.q), bbox: null });
              },
              { replace: true },
            );
          }
        }}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ~2/3: rail + map */}
        <section className="relative flex min-h-0 min-w-0 flex-[2] flex-col border-border lg:border-r">
          <SearchFilterRail
            filters={normalizedFilters}
            onChange={applyFilters}
            onOpenAdvanced={() => setAdvancedOpen(true)}
          />
          <div className="relative min-h-[42vh] flex-1 lg:min-h-[calc(100dvh-10.5rem)]">
            <div className="absolute inset-0">
              <PropertyMap
                embed
                className="h-full"
                listings={filtered}
                selectedId={selectedId}
                onSelect={(id) => setSelectedId(id)}
                defaultCenter={isGuadalajaraSearch ? GUADALAJARA_LA_MINERVA_CENTER : undefined}
                defaultZoom={isGuadalajaraSearch ? GUADALAJARA_LA_MINERVA_ZOOM : undefined}
                preferDefaultView={isGuadalajaraSearch && selectedId == null}
                searchOnMapMove={searchOnMapMove}
                onViewportBbox={searchOnMapMove ? onViewportBbox : undefined}
              />
            </div>
          </div>
        </section>

        {/* ~1/3: scrollable listings */}
        <aside className="flex max-h-[46vh] min-h-0 min-w-0 flex-1 flex-col border-t border-border bg-surface lg:max-h-none lg:min-w-[280px] lg:flex-[1] lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3 sm:px-4">
            <h2 className="text-sm font-semibold text-body sm:text-base">Listados</h2>
            <p className="text-xs text-muted sm:text-sm">
              {apiOn && apiBusy ? (
                apiListings === undefined ? "Cargando…" : "Actualizando…"
              ) : apiOn && apiErr ? (
                <span className="text-red-600">{apiErr}</span>
              ) : (
                <>
                  {filtered.length}
                  {!apiOn ? `/${SEED_LISTINGS.length}` : ""}
                </>
              )}
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

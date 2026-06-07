import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "@/lib/searchDefaults";
import {
  filterListings,
  filtersToParams,
  hasActiveSearchFilters,
  parseFilters,
  resetSearchFilters,
  type Bbox,
  type SearchFilters,
} from "@/lib/searchFilters";
import type { PropertyListing } from "@/types/listing";

function bboxEquals(a: Bbox | null, b: Bbox | null) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return (
    a.minLat === b.minLat &&
    a.minLng === b.minLng &&
    a.maxLat === b.maxLat &&
    a.maxLng === b.maxLng
  );
}

function dominantCity(listings: PropertyListing[]) {
  const counts = new Map<string, number>();
  listings.forEach((listing) => {
    const city = listing.city.trim();
    if (!city) return;
    counts.set(city, (counts.get(city) ?? 0) + 1);
  });
  let bestCity: string | null = null;
  let bestCount = 0;
  counts.forEach((count, city) => {
    if (count > bestCount) {
      bestCity = city;
      bestCount = count;
    }
  });
  return bestCity;
}

function listingsInBbox(listings: PropertyListing[], bbox: Bbox | null) {
  if (bbox == null) return listings;
  return listings.filter(
    (listing) =>
      listing.lat >= bbox.minLat &&
      listing.lat <= bbox.maxLat &&
      listing.lng >= bbox.minLng &&
      listing.lng <= bbox.maxLng,
  );
}

function stripLocationPrefix(value: string) {
  return value.replace(/^[A-Z]{3}\s-\s/, "").trim();
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const normalizedFilters = useMemo(() => ({ ...filters, q: stripLocationPrefix(filters.q) }), [filters]);
  const filterQueryKey = useMemo(() => filtersToParams(normalizedFilters).toString(), [normalizedFilters]);
  const locationClearedRef = useRef(false);
  const clearedBboxRef = useRef<Bbox | null>(null);

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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const isGuadalajaraSearch = searchParams.has("q")
    ? isDefaultSearchCity(normalizedFilters.q)
    : true;
  const locationSourceListings = useMemo(
    () => (apiOn ? (apiListings ?? []) : SEED_LISTINGS),
    [apiOn, apiListings],
  );
  const bboxScopedLocationListings = useMemo(
    () => listingsInBbox(locationSourceListings, filters.bbox),
    [filters.bbox, locationSourceListings],
  );

  useEffect(() => {
    if (searchParams.has("q")) return;
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
    locationClearedRef.current = next.q.trim() === "";
    clearedBboxRef.current = next.q.trim() === "" ? next.bbox : null;
    setSearchParams(filtersToParams(next), { replace: true });
  }

  const clearFilters = useCallback(() => {
    applyFilters(resetSearchFilters(normalizedFilters));
  }, [normalizedFilters]);

  const hasActiveFilters = useMemo(
    () => hasActiveSearchFilters(normalizedFilters),
    [normalizedFilters],
  );

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

  useEffect(() => {
    if (!locationClearedRef.current) return;
    if (filters.q.trim() !== "") {
      locationClearedRef.current = false;
      clearedBboxRef.current = null;
      return;
    }
    if (bboxEquals(filters.bbox, clearedBboxRef.current)) return;
    if (apiOn && apiListings === undefined) return;

    const detectedCity = dominantCity(bboxScopedLocationListings);
    if (!detectedCity) return;

    locationClearedRef.current = false;
    clearedBboxRef.current = null;
    setSearchParams(
      (prev) => {
        const nextFilters = parseFilters(new URLSearchParams(prev));
        return filtersToParams({ ...nextFilters, q: detectedCity });
      },
      { replace: true },
    );
  }, [apiListings, apiOn, bboxScopedLocationListings, filters.bbox, filters.q, setSearchParams]);

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
        listings={filtered}
        onChange={applyFilters}
        onOpenAdvanced={() => setAdvancedOpen(true)}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ~2/3: rail + map */}
        <section className="relative flex min-h-0 min-w-0 flex-[1.35] flex-col border-border lg:flex-[2] lg:border-r">
          <div className="relative min-h-[38vh] flex-1 sm:min-h-[42vh] lg:min-h-[calc(100dvh-11rem)]">
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
                onViewportBbox={onViewportBbox}
              />
            </div>
            <SearchFilterRail
              filters={normalizedFilters}
              onChange={applyFilters}
              onOpenAdvanced={() => setAdvancedOpen(true)}
            />
          </div>
        </section>

        {/* ~1/3: scrollable listings */}
        <aside className="hidden max-h-[48vh] min-h-0 min-w-0 flex-1 flex-col border-t border-border bg-surface sm:max-h-[52vh] lg:flex lg:max-h-none lg:min-w-[300px] lg:flex-[1] lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:px-4 sm:py-3">
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

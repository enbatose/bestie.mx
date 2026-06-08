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

type SearchMapLocation = {
  label: string;
  lat: number;
  lng: number;
  zoom: number;
};

const DEFAULT_SEARCH_LOCATION: SearchMapLocation = {
  label: DEFAULT_SEARCH_CITY,
  lat: GUADALAJARA_LA_MINERVA_CENTER[0],
  lng: GUADALAJARA_LA_MINERVA_CENTER[1],
  zoom: GUADALAJARA_LA_MINERVA_ZOOM,
};

function parseNumberParam(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseSearchLocation(params: URLSearchParams): SearchMapLocation {
  const label = params.get("loc")?.trim() || DEFAULT_SEARCH_LOCATION.label;
  const lat = parseNumberParam(params.get("lat")) ?? DEFAULT_SEARCH_LOCATION.lat;
  const lng = parseNumberParam(params.get("lng")) ?? DEFAULT_SEARCH_LOCATION.lng;
  const zoom = parseNumberParam(params.get("z")) ?? DEFAULT_SEARCH_LOCATION.zoom;
  return { label, lat, lng, zoom };
}

function writeSearchLocation(params: URLSearchParams, location: SearchMapLocation) {
  params.set("loc", location.label);
  params.set("lat", String(location.lat));
  params.set("lng", String(location.lng));
  params.set("z", String(location.zoom));
  return params;
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const normalizedFilters = useMemo(() => ({ ...filters, q: "" }), [filters]);
  const searchLocation = useMemo(() => parseSearchLocation(searchParams), [searchParams]);
  const filterQueryKey = useMemo(() => filtersToParams(normalizedFilters).toString(), [normalizedFilters]);

  const apiOn = isListingsApiConfigured();
  const [apiListings, setApiListings] = useState<PropertyListing[] | undefined>(undefined);
  const [apiBusy, setApiBusy] = useState(false);
  const [apiErr, setApiErr] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

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
  const isDefaultLocationView = searchLocation.label === DEFAULT_SEARCH_CITY;

  useEffect(() => {
    if (searchParams.has("loc") && searchParams.has("lat") && searchParams.has("lng") && searchParams.has("z")) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        return writeSearchLocation(next, DEFAULT_SEARCH_LOCATION);
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
      return isDefaultLocationView ? null : filtered[0]!.id;
    });
  }, [filtered, isDefaultLocationView]);

  function applyFilters(next: SearchFilters) {
    setLocationError(null);
    setSearchParams(
      (prev) => {
        const nextParams = filtersToParams({ ...next, q: "" });
        return writeSearchLocation(nextParams, parseSearchLocation(new URLSearchParams(prev)));
      },
      { replace: true },
    );
  }

  const clearFilters = useCallback(() => {
    setLocationError(null);
    setSearchParams(
      () => writeSearchLocation(filtersToParams(resetSearchFilters(normalizedFilters)), DEFAULT_SEARCH_LOCATION),
      { replace: true },
    );
  }, [normalizedFilters]);

  const hasActiveFilters = useMemo(
    () => hasActiveSearchFilters(normalizedFilters),
    [normalizedFilters],
  );

  const onViewportBbox = useCallback(
    (bbox: Bbox) => {
      setLocationError(null);
      setSearchParams(
        (prev) => {
          const f = parseFilters(new URLSearchParams(prev));
          return writeSearchLocation(filtersToParams({ ...f, q: "", bbox }), parseSearchLocation(new URLSearchParams(prev)));
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
        filters={normalizedFilters}
        listings={filtered}
        onChange={applyFilters}
        onOpenAdvanced={() => setAdvancedOpen(true)}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
        locationValue={searchLocation.label}
        locationError={locationError}
        onLocationInput={() => setLocationError(null)}
        onLocationSelect={(location) => {
          setLocationError(null);
          setSearchParams(
            (prev) => {
              const f = parseFilters(new URLSearchParams(prev));
              return writeSearchLocation(
                filtersToParams({ ...f, q: "", bbox: null }),
                {
                  label: location.label,
                  lat: location.lat,
                  lng: location.lng,
                  zoom: location.zoom,
                },
              );
            },
            { replace: true },
          );
        }}
        onLocationReset={() => {
          setLocationError(null);
          setSearchParams(
            (prev) => {
              const f = parseFilters(new URLSearchParams(prev));
              return writeSearchLocation(filtersToParams({ ...f, q: "", bbox: null }), DEFAULT_SEARCH_LOCATION);
            },
            { replace: true },
          );
        }}
        onLocationNotFound={(query) => {
          setLocationError(`No se encontró la colonia "${query}". Mostramos la última ubicación.`);
        }}
        onLocationErrorDismiss={() => setLocationError(null)}
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
                defaultCenter={[searchLocation.lat, searchLocation.lng]}
                defaultZoom={searchLocation.zoom}
                preferDefaultView
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

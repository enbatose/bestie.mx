import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PropertyMap } from "@/components/map/PropertyMap";
import { SearchAdvancedSheet } from "@/components/search/SearchAdvancedSheet";
import { SearchFilterRail } from "@/components/search/SearchFilterRail";
import { SearchResultsList } from "@/components/search/SearchResultsList";
import { SearchTopBar } from "@/components/search/SearchTopBar";
import { SEED_LISTINGS } from "@/data/seedListings";
import { fetchListingsFromApi, isListingsApiConfigured, type LocationSuggestion } from "@/lib/listingsApi";
import { findMetroCity, resolveMetroCity } from "@/lib/metroCities";
import {
  filterListings,
  filtersToParams,
  hasActiveSearchFilters,
  parseFilters,
  resetSearchFilters,
  type Bbox,
  type SearchFilters,
} from "@/lib/searchFilters";
import {
  metroDefaultLocation,
  parseSearchLocation,
  searchPathForCity,
  stripMetroLabelPrefix,
  writeSearchLocation,
  type SearchLocationState,
} from "@/lib/searchLocation";
import type { PropertyListing } from "@/types/listing";

function hasLocationCoords(params: URLSearchParams) {
  return params.has("lat") && params.has("lng") && params.has("z");
}

export function SearchPage() {
  const navigate = useNavigate();
  const { cityCode: routeCityCode } = useParams<{ cityCode?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const normalizedFilters = useMemo(() => ({ ...filters, q: "" }), [filters]);
  const metro = useMemo(() => resolveMetroCity(routeCityCode), [routeCityCode]);
  const searchLocation = useMemo(
    () => parseSearchLocation(searchParams, routeCityCode),
    [routeCityCode, searchParams],
  );
  const filterQueryKey = useMemo(() => filtersToParams(normalizedFilters).toString(), [normalizedFilters]);
  const mapFallbackLocationRef = useRef<SearchLocationState>(searchLocation);

  const apiOn = isListingsApiConfigured();
  const [apiListings, setApiListings] = useState<PropertyListing[] | undefined>(undefined);
  const [apiBusy, setApiBusy] = useState(false);
  const [apiErr, setApiErr] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    mapFallbackLocationRef.current = searchLocation;
  }, [searchLocation]);

  useEffect(() => {
    const requested = findMetroCity(routeCityCode);
    if (!routeCityCode) {
      navigate(
        {
          pathname: searchPathForCity(metro.code),
          search: searchParams.toString() ? `?${searchParams.toString()}` : "",
        },
        { replace: true },
      );
      return;
    }
    if (requested && !requested.enabled) {
      navigate(
        {
          pathname: searchPathForCity(metro.code),
          search: searchParams.toString() ? `?${searchParams.toString()}` : "",
        },
        { replace: true },
      );
    }
  }, [metro.code, navigate, routeCityCode, searchParams]);

  useEffect(() => {
    if (hasLocationCoords(searchParams)) return;
    setSearchParams(
      (prev) => writeSearchLocation(new URLSearchParams(prev), metroDefaultLocation(metro)),
      { replace: true },
    );
  }, [metro, searchParams, setSearchParams]);

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

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((cur) => {
      if (cur && filtered.some((l) => l.id === cur)) return cur;
      return null;
    });
  }, [filtered]);

  useEffect(() => {
    setSelectedId(null);
  }, [searchLocation.cityCode, searchLocation.neighborhood, searchLocation.lat, searchLocation.lng, searchLocation.zoom]);

  const applyLocation = useCallback(
    (next: SearchLocationState) => {
      setLocationError(null);
      const path = searchPathForCity(next.cityCode);
      const params = writeSearchLocation(
        filtersToParams({ ...normalizedFilters, q: "", bbox: null }),
        next,
      );
      navigate({ pathname: path, search: `?${params.toString()}` }, { replace: true });
    },
    [navigate, normalizedFilters],
  );

  function applyFilters(next: SearchFilters) {
    setLocationError(null);
    setSearchParams(
      (prev) => {
        const nextParams = filtersToParams({ ...next, q: "" });
        return writeSearchLocation(nextParams, parseSearchLocation(new URLSearchParams(prev), routeCityCode));
      },
      { replace: true },
    );
  }

  const clearFilters = useCallback(() => {
    setLocationError(null);
    const defaultLocation = metroDefaultLocation(metro);
    setSearchParams(
      () => writeSearchLocation(filtersToParams(resetSearchFilters(normalizedFilters)), defaultLocation),
      { replace: true },
    );
    navigate({ pathname: searchPathForCity(metro.code), search: "" }, { replace: true });
  }, [metro, navigate, normalizedFilters, setSearchParams]);

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
          return writeSearchLocation(
            filtersToParams({ ...f, q: "", bbox }),
            parseSearchLocation(new URLSearchParams(prev), routeCityCode),
          );
        },
        { replace: true },
      );
    },
    [routeCityCode, setSearchParams],
  );

  const handleCitySelect = useCallback(
    (location: LocationSuggestion) => {
      applyLocation({
        cityCode: location.cityCode,
        cityAbbr: resolveMetroCity(location.cityCode).abbr,
        cityLabel: location.city,
        neighborhood: null,
        lat: location.lat,
        lng: location.lng,
        zoom: location.zoom,
      });
    },
    [applyLocation],
  );

  const handleNeighborhoodSelect = useCallback(
    (location: LocationSuggestion) => {
      const metro = resolveMetroCity(location.cityCode);
      const neighborhood =
        stripMetroLabelPrefix(metro.abbr, location.neighborhood ?? location.label) ??
        location.neighborhood;
      applyLocation({
        cityCode: location.cityCode,
        cityAbbr: metro.abbr,
        cityLabel: location.city,
        neighborhood,
        lat: location.lat,
        lng: location.lng,
        zoom: location.zoom,
      });
    },
    [applyLocation],
  );

  const handleCityClear = useCallback(() => {
    setLocationError(null);
    applyLocation({
      ...searchLocation,
      neighborhood: null,
    });
  }, [applyLocation, searchLocation]);

  const handleNeighborhoodClear = useCallback(() => {
    setLocationError(null);
    applyLocation({
      ...searchLocation,
      neighborhood: null,
      lat: metro.defaultCenter[0],
      lng: metro.defaultCenter[1],
      zoom: metro.defaultZoom,
    });
  }, [applyLocation, metro, searchLocation]);

  const handleCityRestore = useCallback(() => {
    setLocationError(null);
    applyLocation(mapFallbackLocationRef.current);
  }, [applyLocation]);

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
        searchLocation={searchLocation}
        locationError={locationError}
        onCitySelect={handleCitySelect}
        onNeighborhoodSelect={handleNeighborhoodSelect}
        onCityClear={handleCityClear}
        onNeighborhoodClear={handleNeighborhoodClear}
        onCityRestore={handleCityRestore}
        onLocationInput={() => setLocationError(null)}
        onLocationNotFound={(query) => {
          setLocationError(`No se encontró la colonia "${query}". Mostramos la última ubicación.`);
        }}
        onLocationErrorDismiss={() => setLocationError(null)}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
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

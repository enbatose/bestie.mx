import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PropertyMap } from "@/components/map/PropertyMap";
import { AppConfirmDialog, replaceActiveSavedSearchNotifyMessage } from "@/components/AppConfirmDialog";
import { FollowSearchNotifyModal } from "@/components/search/FollowSearchNotifyModal";
import { SaveSearchModal } from "@/components/search/SaveSearchModal";
import { SearchAdvancedSheet } from "@/components/search/SearchAdvancedSheet";
import { SearchFilterRail, getFilterRailDefaultExpanded, type SearchFilterRailHandle } from "@/components/search/SearchFilterRail";
import { SearchMobileResultsPanel } from "@/components/search/SearchMobileResultsPanel";
import { SearchResultsList } from "@/components/search/SearchResultsList";
import { SearchTopBar, type SearchTopBarHandle } from "@/components/search/SearchTopBar";
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
  computeNeighborhoodsViewport,
  metroDefaultLocation,
  neighborhoodNamesMatch,
  parseSearchLocation,
  searchPathForCity,
  stripMetroLabelPrefix,
  writeSearchLocation,
  type SearchLocationState,
} from "@/lib/searchLocation";
import { SEARCH_SELECTED_PARAM, searchReturnFromLocation, type SearchReturnContext } from "@/lib/searchReturn";
import { authMe, type AuthMe } from "@/lib/authApi";
import { useAuthModal } from "@/contexts/AuthModalContext";
import {
  buildSavedSearchUrl,
  enableSavedSearchNotify,
  fetchSavedSearches,
  promoteSearchDraft,
  upsertSearchDraft,
  type SavedSearchDto,
} from "@/lib/savedSearchesApi";
import {
  consumeSaveSearchPendingAction,
  dismissSaveSearchGuestNudge,
  isSaveSearchGuestNudgeDismissed,
  setSaveSearchPendingAction,
} from "@/lib/saveSearchSession";
import type { PropertyListing } from "@/types/listing";

const AUTO_SAVE_DEBOUNCE_MS = 5000;

function hasLocationCoords(params: URLSearchParams) {
  return params.has("lat") && params.has("lng") && params.has("z");
}

function normalizeMobileNeighborhoodFilter(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\b(colonia|col|barrio|zona)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mobileListingMatchesSelectedNeighborhood(listing: PropertyListing, selectedName: string) {
  const selected = normalizeMobileNeighborhoodFilter(selectedName);
  if (!selected) return false;

  return [listing.neighborhood, listing.city].some((candidate) => {
    const normalized = normalizeMobileNeighborhoodFilter(candidate);
    return normalized === selected;
  });
}

export function SearchPage() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const mapSectionRef = useRef<HTMLDivElement>(null);
  const filterRailRef = useRef<SearchFilterRailHandle>(null);
  const searchTopBarRef = useRef<SearchTopBarHandle>(null);
  const searchReturn = useMemo(
    (): SearchReturnContext => searchReturnFromLocation(location.pathname, location.search),
    [location.pathname, location.search],
  );

  const apiOn = isListingsApiConfigured();
  const [apiListings, setApiListings] = useState<PropertyListing[] | undefined>(undefined);
  const [apiBusy, setApiBusy] = useState(false);
  const [apiErr, setApiErr] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationFitNonce, setLocationFitNonce] = useState(0);

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

  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get(SEARCH_SELECTED_PARAM));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [filterRailLabelsExpanded, setFilterRailLabelsExpanded] = useState(getFilterRailDefaultExpanded);
  const { openLogin } = useAuthModal();
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveModalFilters, setSaveModalFilters] = useState<SearchFilters | null>(null);
  const [followModalOpen, setFollowModalOpen] = useState(false);
  const [followSuccessOpen, setFollowSuccessOpen] = useState(false);
  const [followEmailSent, setFollowEmailSent] = useState<boolean | null>(null);
  const [followReplaceNotifyLabel, setFollowReplaceNotifyLabel] = useState<string | null>(null);
  const [followEnableBusy, setFollowEnableBusy] = useState(false);
  const [searchDraft, setSearchDraft] = useState<SavedSearchDto | null>(null);
  const [saveSearchPulse, setSaveSearchPulse] = useState(false);
  const [guestNudgeVisible, setGuestNudgeVisible] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  useEffect(() => {
    const load = () => void authMe().then(setMe).catch(() => setMe(null));
    load();
    window.addEventListener("bestie:me-changed", load);
    return () => window.removeEventListener("bestie:me-changed", load);
  }, []);

  const saveSearchPayload = useMemo(
    () => ({
      cityCode: searchLocation.cityCode,
      filters: normalizedFilters,
      location: {
        cityCode: searchLocation.cityCode,
        cityLabel: searchLocation.cityLabel,
        neighborhoods: searchLocation.neighborhoods,
        lat: searchLocation.lat,
        lng: searchLocation.lng,
        zoom: searchLocation.zoom,
      },
      searchUrl: buildSavedSearchUrl(location.pathname, normalizedFilters, searchLocation),
    }),
    [location.pathname, normalizedFilters, searchLocation],
  );

  const saveModalEffectiveFilters = saveModalFilters ?? normalizedFilters;

  const saveModalPayload = useMemo(
    () => ({
      cityCode: searchLocation.cityCode,
      filters: saveModalEffectiveFilters,
      location: {
        cityCode: searchLocation.cityCode,
        cityLabel: searchLocation.cityLabel,
        neighborhoods: searchLocation.neighborhoods,
        lat: searchLocation.lat,
        lng: searchLocation.lng,
        zoom: searchLocation.zoom,
      },
      searchUrl: buildSavedSearchUrl(location.pathname, saveModalEffectiveFilters, searchLocation),
    }),
    [location.pathname, saveModalEffectiveFilters, searchLocation],
  );

  const openSaveSearchModal = useCallback(() => {
    const flushed = searchTopBarRef.current?.commitPendingHorizontalFilters() ?? normalizedFilters;
    setSaveModalFilters(flushed);
    setSaveModalOpen(true);
  }, [normalizedFilters]);

  const autoSaveSignature = useMemo(
    () => JSON.stringify(saveSearchPayload),
    [saveSearchPayload],
  );

  useEffect(() => {
    if (!me?.id) return;
    const t = window.setTimeout(() => {
      void upsertSearchDraft(saveSearchPayload)
        .then((row) => {
          setSearchDraft(row);
          setSaveSearchPulse(true);
          window.setTimeout(() => setSaveSearchPulse(false), 2400);
        })
        .catch(() => {});
    }, AUTO_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [me?.id, autoSaveSignature, saveSearchPayload]);

  const returnTo = `${location.pathname}${location.search}`;

  const openAuthForSearchAction = useCallback(
    (action: "save" | "follow") => {
      setSaveSearchPendingAction(action);
      openLogin(returnTo);
    },
    [openLogin, returnTo],
  );

  const finishFollowEnable = useCallback(async () => {
    await upsertSearchDraft(saveSearchPayload);
    const promoted = await promoteSearchDraft();
    const result = await enableSavedSearchNotify(promoted.id);
    setSearchDraft(null);
    setFollowEmailSent(result.emailSent ?? true);
    setFollowSuccessOpen(true);
    setSaveNotice("Alertas por correo activadas para esta búsqueda.");
    window.setTimeout(() => setSaveNotice(null), 5000);
  }, [saveSearchPayload]);

  const runFollowEnable = useCallback(
    async (skipReplaceConfirm = false) => {
      if (!me?.id) return;

      if (!me.email?.trim()) {
        setFollowModalOpen(true);
        return;
      }

      if (!skipReplaceConfirm) {
        const rows = await fetchSavedSearches();
        const other = rows.find((r) => r.emailNotifyEnabled);
        if (other) {
          setFollowReplaceNotifyLabel(other.label);
          return;
        }
      }

      setFollowEnableBusy(true);
      try {
        await finishFollowEnable();
      } finally {
        setFollowEnableBusy(false);
      }
    },
    [me, finishFollowEnable],
  );

  const onConfirmFollowReplaceNotify = useCallback(() => {
    setFollowReplaceNotifyLabel(null);
    setFollowEnableBusy(true);
    void finishFollowEnable()
      .catch((x) => {
        setSaveNotice(x instanceof Error ? x.message : "No se pudieron activar las alertas.");
        window.setTimeout(() => setSaveNotice(null), 5000);
      })
      .finally(() => setFollowEnableBusy(false));
  }, [finishFollowEnable]);

  const onSaveSearchClick = useCallback(() => {
    searchTopBarRef.current?.commitPendingHorizontalFilters();
    if (!me?.id) {
      setSaveSearchPendingAction("save");
      openLogin(returnTo);
      return;
    }
    openSaveSearchModal();
  }, [me?.id, openLogin, openSaveSearchModal, returnTo]);

  const onFollowSearchClick = useCallback(() => {
    searchTopBarRef.current?.commitPendingHorizontalFilters();
    if (!me?.id) {
      openAuthForSearchAction("follow");
      return;
    }
    if (!me.email?.trim()) {
      setFollowModalOpen(true);
      return;
    }
    void runFollowEnable().catch((x) => {
      setSaveNotice(x instanceof Error ? x.message : "No se pudieron activar las alertas.");
      window.setTimeout(() => setSaveNotice(null), 5000);
    });
  }, [me, openAuthForSearchAction, runFollowEnable]);

  const onGuestNudgeClick = useCallback(() => {
    dismissSaveSearchGuestNudge();
    setGuestNudgeVisible(false);
    onSaveSearchClick();
  }, [onSaveSearchClick]);

  const dismissGuestNudge = useCallback(() => {
    dismissSaveSearchGuestNudge();
    setGuestNudgeVisible(false);
  }, []);

  useEffect(() => {
    if (!me?.id) return;
    const action = consumeSaveSearchPendingAction();
    if (action === "save") openSaveSearchModal();
    if (action === "follow") {
      if (me.email?.trim()) {
        void runFollowEnable().catch(() => setFollowModalOpen(true));
      } else {
        setFollowModalOpen(true);
      }
    }
  }, [me, runFollowEnable]);

  const handleMobileDrawerOpen = useCallback(() => {
    filterRailRef.current?.collapseLegend();
  }, []);

  useEffect(() => {
    const sel = searchParams.get(SEARCH_SELECTED_PARAM);
    if (sel) setSelectedId(sel);
  }, [searchParams]);

  useEffect(() => {
    if (!filtered.length) {
      if (apiOn && apiBusy) return;
      setSelectedId(null);
      return;
    }
    setSelectedId((cur) => {
      if (cur && filtered.some((l) => l.id === cur)) return cur;
      return null;
    });
  }, [apiBusy, apiOn, filtered]);

  const neighborhoodSelectionKey = useMemo(
    () => searchLocation.neighborhoods.map((pin) => pin.name).join("|"),
    [searchLocation.neighborhoods],
  );

  useEffect(() => {
    setSelectedId(null);
  }, [searchLocation.cityCode, neighborhoodSelectionKey]);

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
    const viewport = computeNeighborhoodsViewport([], metro);
    const nextLocation = {
      ...searchLocation,
      neighborhoods: [],
      ...viewport,
    };
    const nextParams = writeSearchLocation(
      filtersToParams(resetSearchFilters(normalizedFilters)),
      nextLocation,
    );
    navigate(
      {
        pathname: searchPathForCity(nextLocation.cityCode),
        search: `?${nextParams.toString()}`,
      },
      { replace: true },
    );
  }, [metro, navigate, normalizedFilters, searchLocation]);

  const hasActiveFilters = useMemo(
    () => hasActiveSearchFilters(normalizedFilters) || searchLocation.neighborhoods.length > 0,
    [normalizedFilters, searchLocation.neighborhoods.length],
  );

  useEffect(() => {
    if (me?.id) return;
    if (isSaveSearchGuestNudgeDismissed()) return;
    if (!hasActiveFilters) return;
    setGuestNudgeVisible(true);
  }, [me?.id, hasActiveFilters]);

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
      const metro = resolveMetroCity(location.cityCode);
      applyLocation({
        cityCode: location.cityCode,
        cityAbbr: metro.abbr,
        cityLabel: location.city,
        neighborhoods: [],
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
      const name =
        stripMetroLabelPrefix(metro.abbr, location.neighborhood ?? location.label) ??
        location.neighborhood ??
        location.label;
      if (!name) return;

      const alreadySelected = searchLocation.neighborhoods.some((pin) =>
        neighborhoodNamesMatch(pin.name, name),
      );
      if (alreadySelected) return;

      const neighborhoods = [
        ...searchLocation.neighborhoods,
        { name, lat: location.lat, lng: location.lng },
      ];
      const viewport = computeNeighborhoodsViewport(neighborhoods, metro);

      applyLocation({
        cityCode: location.cityCode,
        cityAbbr: metro.abbr,
        cityLabel: location.city,
        neighborhoods,
        ...viewport,
      });
    },
    [applyLocation, searchLocation],
  );

  const handleCityClear = useCallback(() => {
    setLocationError(null);
    applyLocation({
      ...searchLocation,
      neighborhoods: [],
    });
  }, [applyLocation, searchLocation]);

  const handleNeighborhoodRemove = useCallback(
    (name: string) => {
      setLocationError(null);
      const neighborhoods = searchLocation.neighborhoods.filter(
        (pin) => !neighborhoodNamesMatch(pin.name, name),
      );
      const viewport = computeNeighborhoodsViewport(neighborhoods, metro);
      applyLocation({
        ...searchLocation,
        neighborhoods,
        ...viewport,
      });
    },
    [applyLocation, metro, searchLocation],
  );

  const handleCityRestore = useCallback(() => {
    setLocationError(null);
    applyLocation(mapFallbackLocationRef.current);
  }, [applyLocation]);

  const resultsCountLabel =
    apiOn && apiBusy ? (
      apiListings === undefined ? "Cargando…" : "Actualizando…"
    ) : apiOn && apiErr ? (
      <span className="text-error">{apiErr}</span>
    ) : (
      <>
        {filtered.length}
        {!apiOn ? `/${SEED_LISTINGS.length}` : ""}
      </>
    );
  const mobileDrawerListings = useMemo(() => {
    if (searchLocation.neighborhoods.length < 2) return filtered;
    return filtered.filter((listing) =>
      searchLocation.neighborhoods.some((pin) =>
        mobileListingMatchesSelectedNeighborhood(listing, pin.name),
      ),
    );
  }, [filtered, searchLocation.neighborhoods]);
  const mobileResultsCountLabel =
    apiOn && apiBusy ? (
      apiListings === undefined ? "Cargando…" : "Actualizando…"
    ) : apiOn && apiErr ? (
      <span className="text-error">{apiErr}</span>
    ) : (
      <>
        {mobileDrawerListings.length}
        {!apiOn ? `/${SEED_LISTINGS.length}` : ""}
      </>
    );
  const farNeighborhoodAutoOpenKey =
    searchLocation.neighborhoods.length > 1 && searchLocation.zoom <= metro.neighborhoodZoom - 3
      ? `${searchLocation.cityCode}:${neighborhoodSelectionKey}:${searchLocation.zoom}`
      : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg-light">
      <SearchAdvancedSheet
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        filters={normalizedFilters}
        onChange={applyFilters}
      />
      <SearchTopBar
        ref={searchTopBarRef}
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
        onNeighborhoodRemove={handleNeighborhoodRemove}
        onCityRestore={handleCityRestore}
        onLocationInput={() => setLocationError(null)}
        onNeighborhoodSearchCommit={() => {
          setLocationError(null);
          if (searchLocation.neighborhoods.length > 0) {
            setLocationFitNonce((current) => current + 1);
          }
        }}
        onLocationNotFound={(query) => {
          setLocationError(`No se encontró la colonia "${query}". Mostramos la última ubicación.`);
        }}
        onLocationErrorDismiss={() => setLocationError(null)}
        onSaveClick={onSaveSearchClick}
        onFollowClick={onFollowSearchClick}
        saveSearchPulse={saveSearchPulse}
        guestSaveNudge={
          !me?.id && guestNudgeVisible
            ? { visible: true, onDismiss: dismissGuestNudge, onClick: onGuestNudgeClick }
            : undefined
        }
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col border-border lg:flex-[2] lg:border-r">
          <div ref={mapSectionRef} className="relative min-h-0 flex-1 lg:min-h-[calc(100dvh-11rem)]">
            <div className="absolute inset-0">
              <PropertyMap
                embed
                className="h-full"
                listings={filtered}
                selectedId={selectedId}
                onSelect={(id) => setSelectedId(id)}
                searchReturn={searchReturn}
                popupOverlayHostRef={mapSectionRef}
                defaultCenter={[searchLocation.lat, searchLocation.lng]}
                defaultZoom={searchLocation.zoom}
                locationPins={searchLocation.neighborhoods}
                locationFitNonce={locationFitNonce}
                preferDefaultView
                onViewportBbox={onViewportBbox}
              />
            </div>
            <SearchFilterRail
              ref={filterRailRef}
              filters={normalizedFilters}
              onChange={applyFilters}
              onOpenAdvanced={() => setAdvancedOpen(true)}
              onLabelsExpandedChange={setFilterRailLabelsExpanded}
            />
            <SearchMobileResultsPanel
              listings={mobileDrawerListings}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id)}
              searchReturn={searchReturn}
              filterRailLabelsExpanded={filterRailLabelsExpanded}
              countLabel={mobileResultsCountLabel}
              autoExpandKey={farNeighborhoodAutoOpenKey}
              onDrawerOpen={handleMobileDrawerOpen}
            />
          </div>
        </section>

        <aside className="hidden min-h-0 min-w-0 flex-col border-border bg-surface lg:flex lg:min-w-[300px] lg:flex-[1] lg:border-l">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold text-body">Listados</h2>
            <p className="text-sm text-muted">{resultsCountLabel}</p>
          </div>
          {saveNotice ? (
            <p className="border-b border-border bg-secondary/10 px-4 py-2 text-xs text-body">{saveNotice}</p>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            <SearchResultsList
              dense
              listings={filtered}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id)}
              searchReturn={searchReturn}
            />
          </div>
        </aside>
      </div>

      {me?.id ? (
        <>
          <AppConfirmDialog
            open={followReplaceNotifyLabel != null}
            title="Cambiar alertas activas"
            message={replaceActiveSavedSearchNotifyMessage(followReplaceNotifyLabel ?? "")}
            confirmLabel="Sí, cambiar"
            busy={followEnableBusy}
            onConfirm={onConfirmFollowReplaceNotify}
            onCancel={() => setFollowReplaceNotifyLabel(null)}
          />
          <SaveSearchModal
            open={saveModalOpen}
            onClose={() => {
              setSaveModalOpen(false);
              setSaveModalFilters(null);
            }}
            me={me}
            payload={saveModalPayload}
            filters={saveModalEffectiveFilters}
            searchLocation={searchLocation}
            draft={searchDraft}
            onDraftChange={setSearchDraft}
            onMeUpdated={(next) => {
              setMe(next);
              window.dispatchEvent(new Event("bestie:me-changed"));
            }}
            onSaved={() => {
              setSearchDraft(null);
              setSaveNotice("Búsqueda guardada. Puedes verla en Mis Búsquedas.");
              window.setTimeout(() => setSaveNotice(null), 5000);
            }}
          />
          <FollowSearchNotifyModal
            open={followModalOpen}
            onClose={() => setFollowModalOpen(false)}
            me={me}
            payload={saveSearchPayload}
            onMeUpdated={(next) => {
              setMe(next);
              window.dispatchEvent(new Event("bestie:me-changed"));
            }}
            onEnabled={(emailSent) => {
              setSearchDraft(null);
              setFollowEmailSent(emailSent);
              setFollowModalOpen(false);
              setFollowSuccessOpen(true);
              setSaveNotice("Alertas por correo activadas para esta búsqueda.");
              window.setTimeout(() => setSaveNotice(null), 5000);
            }}
          />
        </>
      ) : null}

      {followSuccessOpen ? (
        <div
          className="fixed inset-0 z-[2100] flex items-end justify-center bg-black/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="follow-success-title"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) setFollowSuccessOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2 id="follow-success-title" className="text-lg font-bold text-primary">
              Alertas activadas
            </h2>
            <p className="mt-2 text-sm text-body">
              {followEmailSent === false
                ? "Las alertas quedaron activas. No pudimos enviar el correo inicial (revisa la configuración del servidor)."
                : "Te enviaremos un correo con los anuncios que coincidan. Las alertas se agrupan como máximo cada 3 horas."}
            </p>
            <button
              type="button"
              onClick={() => setFollowSuccessOpen(false)}
              className="mt-5 w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg hover:brightness-110"
            >
              Entendido
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

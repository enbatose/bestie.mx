import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { fetchLocationSuggestions, type LocationSuggestion } from "@/lib/listingsApi";
import { resolveMetroCity, type MetroCity } from "@/lib/metroCities";
import { DEFAULT_SEARCH_FILTERS, filtersToParams } from "@/lib/searchFilters";
import {
  computeNeighborhoodsViewport,
  metroDefaultLocation,
  neighborhoodChipLabel,
  neighborhoodNamesMatch,
  searchPathForCity,
  stripMetroLabelPrefix,
  writeSearchLocation,
  type SearchNeighborhoodPin,
} from "@/lib/searchLocation";
import { track } from "@/lib/analytics";

function suggestionLabel(option: LocationSuggestion): string {
  if (option.kind === "neighborhood" && option.neighborhood) {
    return option.neighborhood;
  }
  return option.label;
}

function pinFromSuggestion(option: LocationSuggestion): SearchNeighborhoodPin | null {
  const metro = resolveMetroCity(option.cityCode);
  const name =
    stripMetroLabelPrefix(metro.abbr, option.neighborhood ?? option.label) ??
    option.neighborhood ??
    option.label;
  if (!name) return null;
  return { name, lat: option.lat, lng: option.lng };
}

function buildSearchParams(metro: MetroCity, neighborhoods: readonly SearchNeighborhoodPin[]) {
  if (!neighborhoods.length) {
    return writeSearchLocation(
      filtersToParams({ ...DEFAULT_SEARCH_FILTERS, q: "" }),
      metroDefaultLocation(metro),
    );
  }
  const viewport = computeNeighborhoodsViewport(neighborhoods, metro);
  return writeSearchLocation(filtersToParams({ ...DEFAULT_SEARCH_FILTERS, q: "" }), {
    cityCode: metro.code,
    cityAbbr: metro.abbr,
    cityLabel: metro.label,
    neighborhoods: [...neighborhoods],
    ...viewport,
  });
}

function mergeNeighborhood(
  current: readonly SearchNeighborhoodPin[],
  pin: SearchNeighborhoodPin,
): SearchNeighborhoodPin[] {
  if (current.some((row) => neighborhoodNamesMatch(row.name, pin.name))) return [...current];
  return [...current, pin];
}

type Props = {
  metro: MetroCity;
  className?: string;
};

/**
 * Hero location search used on city landing pages (GDL chip prefilled).
 * Country home no longer shows this — users pick a city first.
 */
export function HomeLocationSearch({ metro, className = "" }: Props) {
  const navigate = useNavigate();
  const locationMenuId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const blurCloseTimerRef = useRef<number | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<SearchNeighborhoodPin[]>([]);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const goToSearch = useCallback(
    (neighborhoods: readonly SearchNeighborhoodPin[]) => {
      navigate({
        pathname: searchPathForCity(metro.code),
        search: `?${buildSearchParams(metro, neighborhoods).toString()}`,
      });
    },
    [metro, navigate],
  );

  const addNeighborhood = useCallback((option: LocationSuggestion) => {
    const pin = pinFromSuggestion(option);
    if (!pin) return;
    setSelectedNeighborhoods((current) => mergeNeighborhood(current, pin));
    setSearchQuery("");
    setSuggestions([]);
    setMenuOpen(false);
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  const removeNeighborhood = useCallback((name: string) => {
    setSelectedNeighborhoods((current) =>
      current.filter((pin) => !neighborhoodNamesMatch(pin.name, name)),
    );
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  const resolvePendingPin = useCallback(async (): Promise<SearchNeighborhoodPin | null> => {
    const query = searchQuery.trim();
    if (query.length < 2) return null;

    if (suggestions[0]) {
      return pinFromSuggestion(suggestions[0]);
    }

    try {
      const rows = await fetchLocationSuggestions(query, {
        cityCode: metro.code,
        scope: "neighborhood",
      });
      return rows[0] ? pinFromSuggestion(rows[0]) : null;
    } catch {
      return null;
    }
  }, [metro.code, searchQuery, suggestions]);

  const tryAddBestMatch = useCallback(async () => {
    const pin = await resolvePendingPin();
    if (!pin) return;
    setSelectedNeighborhoods((current) => mergeNeighborhood(current, pin));
    setSearchQuery("");
    setSuggestions([]);
    setMenuOpen(false);
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [resolvePendingPin]);

  const handleBuscar = useCallback(async () => {
    const pending = await resolvePendingPin();
    const neighborhoods = pending
      ? mergeNeighborhood(selectedNeighborhoods, pending)
      : selectedNeighborhoods;
    track("home_search_submitted", { neighborhood_count: neighborhoods.length });
    goToSearch(neighborhoods);
  }, [goToSearch, resolvePendingPin, selectedNeighborhoods]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetchLocationSuggestions(query, {
        cityCode: metro.code,
        scope: "neighborhood",
        signal: ac.signal,
      })
        .then((rows) => {
          const visible = rows.filter((option) => {
            const pin = pinFromSuggestion(option);
            if (!pin) return true;
            return !selectedNeighborhoods.some((row) => neighborhoodNamesMatch(row.name, pin.name));
          });
          setSuggestions(visible);
          setMenuOpen(true);
        })
        .catch(() => {
          if (ac.signal.aborted) return;
          setSuggestions([]);
        })
        .finally(() => {
          if (!ac.signal.aborted) setLoading(false);
        });
    }, 220);

    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [metro.code, searchQuery, selectedNeighborhoods]);

  useEffect(() => {
    return () => {
      if (blurCloseTimerRef.current != null) window.clearTimeout(blurCloseTimerRef.current);
    };
  }, []);

  function openMenu() {
    if (blurCloseTimerRef.current != null) {
      window.clearTimeout(blurCloseTimerRef.current);
      blurCloseTimerRef.current = null;
    }
    setMenuOpen(true);
  }

  function scheduleMenuClose() {
    if (blurCloseTimerRef.current != null) window.clearTimeout(blurCloseTimerRef.current);
    blurCloseTimerRef.current = window.setTimeout(() => {
      setMenuOpen(false);
      blurCloseTimerRef.current = null;
    }, 120);
  }

  function handleSuggestionSelect(option: LocationSuggestion) {
    if (blurCloseTimerRef.current != null) window.clearTimeout(blurCloseTimerRef.current);
    addNeighborhood(option);
  }

  const showMenu = menuOpen && searchQuery.trim().length >= 2;
  const inputPlaceholder = selectedNeighborhoods.length
    ? "Agregar otra colonia…"
    : "Buscar colonia…";

  return (
    <div
      id="hero-busqueda"
      className={`home-hero-rise home-hero-rise--delay w-full max-w-[32rem] scroll-mt-24 sm:max-w-[36rem] ${className}`}
    >
      <label className="sr-only" htmlFor="search-q">
        Buscar colonia en {metro.label}
      </label>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2">
        <div className="relative min-w-0 flex-1" onFocus={openMenu} onBlur={scheduleMenuClose}>
          <div className="flex min-h-12 w-full flex-wrap items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/40">
            <span
              className="inline-flex shrink-0 items-center rounded-full border border-primary/35 bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-fg"
              aria-label={`Ciudad ${metro.label}`}
            >
              {metro.abbr}
            </span>
            {selectedNeighborhoods.map((pin) => {
              const label = neighborhoodChipLabel(pin.name, metro.abbr);
              return (
                <span
                  key={pin.name}
                  className="inline-flex max-w-[9rem] shrink-0 items-center gap-0.5 rounded-full border border-primary/20 bg-bg-light px-2 py-0.5 text-xs font-semibold text-body"
                >
                  <span className="truncate">{label}</span>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => removeNeighborhood(pin.name)}
                    className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-body transition hover:bg-surface"
                    aria-label={`Quitar colonia ${label}`}
                  >
                    <X className="size-3.5" aria-hidden strokeWidth={2.5} />
                  </button>
                </span>
              );
            })}
            <Search className="size-4 shrink-0 text-muted" aria-hidden strokeWidth={2.25} />
            <input
              ref={searchInputRef}
              id="search-q"
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setMenuOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void tryAddBestMatch();
                }
                if (e.key === "Escape") {
                  setMenuOpen(false);
                }
                if (
                  e.key === "Backspace" &&
                  searchQuery === "" &&
                  selectedNeighborhoods.length > 0
                ) {
                  removeNeighborhood(selectedNeighborhoods[selectedNeighborhoods.length - 1]!.name);
                }
              }}
              placeholder={inputPlaceholder}
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-expanded={showMenu}
              aria-controls={locationMenuId}
              aria-autocomplete="list"
              className="min-h-9 min-w-[7rem] flex-1 bg-transparent py-1.5 text-base font-medium text-body caret-primary placeholder:text-muted outline-none"
            />
          </div>

          {showMenu ? (
            <div
              id={locationMenuId}
              role="listbox"
              aria-label="Colonias sugeridas"
              className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-border bg-surface text-left shadow-xl"
            >
              {loading && suggestions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted">Buscando colonias…</div>
              ) : suggestions.length > 0 ? (
                suggestions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    role="option"
                    className="w-full px-4 py-3 text-left text-sm font-medium text-body transition hover:bg-bg-light"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSuggestionSelect(option)}
                  >
                    {suggestionLabel(option)}
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-muted">
                  Sin coincidencias. Sigue escribiendo o busca en el mapa.
                </div>
              )}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void handleBuscar()}
          className="min-h-12 shrink-0 rounded-full bg-secondary px-7 text-base font-semibold text-primary shadow-md transition hover:brightness-95 active:scale-[0.99]"
        >
          Buscar
        </button>
      </div>
    </div>
  );
}

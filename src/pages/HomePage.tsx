import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPinned, Search, SlidersHorizontal, UsersRound, X, type LucideIcon } from "lucide-react";
import { HeroAnimatedLockup } from "@/components/HeroAnimatedLockup";
import { fetchLocationSuggestions, type LocationSuggestion } from "@/lib/listingsApi";
import { DEFAULT_METRO_CITY, resolveMetroCity } from "@/lib/metroCities";
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

const PROXIMAS_CITIES = [
  "Puerto Vallarta",
  "Sayulita",
  "Morelia",
  "Aguascalientes",
  "León",
] as const;

const STEPS: ReadonlyArray<{
  icon: LucideIcon;
  title: string;
  body: string;
}> = [
  {
    icon: MapPinned,
    title: "Elige tu zona",
    body: "Empieza por ciudad o colonia. El mapa y la lista se mueven juntos.",
  },
  {
    icon: SlidersHorizontal,
    title: "Filtra lo que importa",
    body: "Género, edad, baño privado, estacionamiento y más — sin ruido.",
  },
  {
    icon: UsersRound,
    title: "Conoce a tu roomie",
    body: "Abre el anuncio, revisa el espacio y da el siguiente paso con confianza.",
  },
];

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

function buildSearchParams(neighborhoods: readonly SearchNeighborhoodPin[]) {
  const metro = DEFAULT_METRO_CITY;
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

export function HomePage() {
  const navigate = useNavigate();
  const locationMenuId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const blurCloseTimerRef = useRef<number | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<SearchNeighborhoodPin[]>([]);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const goToSearch = useCallback((neighborhoods: readonly SearchNeighborhoodPin[]) => {
    navigate({
      pathname: searchPathForCity(DEFAULT_METRO_CITY.code),
      search: `?${buildSearchParams(neighborhoods).toString()}`,
    });
  }, [navigate]);

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
        cityCode: DEFAULT_METRO_CITY.code,
        scope: "neighborhood",
      });
      return rows[0] ? pinFromSuggestion(rows[0]) : null;
    } catch {
      return null;
    }
  }, [searchQuery, suggestions]);

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
        cityCode: DEFAULT_METRO_CITY.code,
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
  }, [searchQuery, selectedNeighborhoods]);

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
    <>
      {/* Hero — overflow only on decor layer so the suggestion menu can escape */}
      <section className="home-hero relative bg-primary px-4 pb-16 pt-12 text-primary-fg sm:px-6 sm:pb-20 sm:pt-16">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="home-hero-orb absolute -left-20 -top-16 h-72 w-72 rounded-full bg-secondary/25 blur-3xl" />
          <div className="home-hero-orb home-hero-orb--delay absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
          <div className="absolute left-1/2 top-1/3 h-40 w-40 -translate-x-1/2 rounded-full bg-secondary/10 blur-2xl" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center text-center">
          <div className="home-hero-rise flex w-full max-w-[42rem] flex-col items-center">
            <HeroAnimatedLockup />

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-primary-fg/70">
              Roomies en México
            </p>

            <h1 className="mt-3 text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              Tu roomie, <span className="text-secondary">tu bestie</span>.
            </h1>

            <p className="mt-4 max-w-xl text-balance text-base leading-7 text-primary-fg/90 sm:text-lg">
              Encuentra roomies de forma rápida y segura. Priorizamos la ubicación sin sacrificar
              los filtros que de verdad te importan.
            </p>
          </div>

          <div
            id="hero-busqueda"
            className="home-hero-rise home-hero-rise--delay mt-8 w-full max-w-[32rem] scroll-mt-24 sm:max-w-[36rem]"
          >
            <label className="sr-only" htmlFor="search-q">
              Buscar colonia
            </label>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2">
              <div
                className="relative min-w-0 flex-1"
                onFocus={openMenu}
                onBlur={scheduleMenuClose}
              >
                <div className="flex min-h-12 w-full flex-wrap items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/40">
                  <span
                    className="inline-flex shrink-0 items-center rounded-full border border-primary/35 bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-fg"
                    aria-label={`Ciudad ${DEFAULT_METRO_CITY.label}`}
                  >
                    {DEFAULT_METRO_CITY.abbr}
                  </span>
                  {selectedNeighborhoods.map((pin) => {
                    const label = neighborhoodChipLabel(pin.name, DEFAULT_METRO_CITY.abbr);
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
                        removeNeighborhood(
                          selectedNeighborhoods[selectedNeighborhoods.length - 1]!.name,
                        );
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
        </div>
      </section>

      {/* Cómo funciona — one job, light structure, no decorative cards */}
      <section className="border-b border-border bg-bg-light px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-lg font-semibold tracking-tight text-body sm:text-xl">
              Así de simple
            </h2>
            <p className="mt-2 text-balance text-sm leading-relaxed text-muted sm:text-base">
              Menos scroll infinito, más roomies reales cerca de ti.
            </p>
          </div>

          <ol className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-8 lg:gap-10">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="mx-auto flex w-full max-w-xs flex-col items-center text-center">
                  <span
                    className="inline-flex size-12 items-center justify-center rounded-full bg-secondary text-primary"
                    aria-hidden
                  >
                    <Icon className="size-6" strokeWidth={2.25} />
                  </span>
                  <h3 className="mt-4 font-semibold text-body">{step.title}</h3>
                  <p className="mt-2 text-balance text-sm leading-relaxed text-muted">{step.body}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Ciudades */}
      <section className="bg-surface px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 md:grid-cols-2 md:gap-16">
            <div className="flex flex-col items-center text-center md:items-start md:text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Disponible</p>
              <h2 className="mt-2 text-lg font-semibold text-body sm:text-xl">Ciudades activas</h2>
              <ul className="mt-5 flex flex-wrap justify-center gap-2 md:justify-start">
                <li>
                  <button
                    type="button"
                    aria-label="Abrir mapa de búsqueda en Guadalajara"
                    onClick={() => goToSearch([])}
                    className="rounded-full border border-secondary/50 bg-secondary/15 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-secondary/25 active:scale-[0.99]"
                  >
                    Guadalajara
                  </button>
                </li>
              </ul>
              <p className="mt-4 max-w-sm text-balance text-sm text-muted">
                Toca la ciudad para ir al mapa y a la lista con filtros para esa zona.
              </p>
            </div>

            <div className="flex flex-col items-center text-center md:items-start md:text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Roadmap</p>
              <h2 className="mt-2 text-lg font-semibold text-body sm:text-xl">Próximamente</h2>
              <ul
                className="mt-5 flex flex-wrap justify-center gap-2 md:justify-start"
                aria-label="Ciudades próximamente"
              >
                {PROXIMAS_CITIES.map((city) => (
                  <li key={city}>
                    <span className="inline-flex rounded-full border border-border bg-bg-light px-4 py-2 text-sm font-medium text-muted">
                      {city}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Publicar — trust + energy CTA on forest */}
      <section className="relative overflow-hidden bg-primary px-4 py-14 text-center text-primary-fg sm:px-6 sm:py-16">
        <div
          className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-secondary/20 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-lg font-bold tracking-tight sm:text-xl">¿Tienes un cuarto libre?</h2>
          <p className="mt-2 text-balance text-sm leading-relaxed text-primary-fg/90 sm:text-base">
            Publica un cuarto o varios como parte de una propiedad. Claro, rápido y en tu ciudad.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/publicar"
              onClick={() => track("home_cta_clicked", { cta: "publish" })}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-secondary px-8 text-base font-semibold text-primary shadow-md transition hover:brightness-95 active:scale-[0.99]"
            >
              Publicar anuncio
            </Link>
            <Link
              to="/faq"
              onClick={() => track("home_cta_clicked", { cta: "faq" })}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/25 bg-white/5 px-6 text-sm font-semibold text-primary-fg transition hover:bg-white/10"
            >
              Cómo funciona
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

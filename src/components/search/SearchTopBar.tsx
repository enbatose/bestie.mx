import { ChevronDown, Filter, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { DEFAULT_SEARCH_CITY } from "@/lib/searchDefaults";
import type { SearchFilters } from "@/lib/searchFilters";
import { fetchLocationSuggestions, type LocationSuggestion } from "@/lib/listingsApi";
import type { PropertyListing } from "@/types/listing";

type Props = {
  filters: SearchFilters;
  listings: PropertyListing[];
  onChange: (next: SearchFilters) => void;
  onOpenAdvanced: () => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  locationValue: string;
  locationError: string | null;
  onLocationSelect: (location: LocationSuggestion) => void;
  onLocationReset: () => void;
  onLocationInput: () => void;
  onLocationNotFound: (query: string) => void;
  onLocationErrorDismiss: () => void;
};

const DEFAULT_MOBILE_AGE = 27;
const MIN_AGE = 16;
const MAX_AGE = 99;
const RENT_STEP = 100;
const LOCATION_ERROR_TOAST_MS = 3_000;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function highestVisibleRent(listings: PropertyListing[]) {
  return listings.reduce((max, listing) => Math.max(max, listing.rentMxn), 0);
}

function formatRentCompact(value: number) {
  if (value < 1000) return String(value);
  const compact = value / 1000;
  const rounded = Number.isInteger(compact) ? String(compact) : compact.toFixed(1).replace(/\.0$/, "");
  return `${rounded}K`;
}

export function SearchTopBar({
  filters,
  listings,
  onChange,
  onOpenAdvanced,
  onClearFilters,
  hasActiveFilters,
  locationValue,
  locationError,
  onLocationSelect,
  onLocationReset,
  onLocationInput,
  onLocationNotFound,
  onLocationErrorDismiss,
}: Props) {
  const locationInputId = useId();
  const mobileLocationMenuId = useId();
  const desktopLocationMenuId = useId();
  const maxVisibleRent = useMemo(() => highestVisibleRent(listings), [listings]);
  const displayedRent = filters.budgetMax ?? (maxVisibleRent > 0 ? maxVisibleRent : null);
  const displayedAge = filters.age;
  const [locationInput, setLocationInput] = useState(locationValue);
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showLocationErrorToast, setShowLocationErrorToast] = useState(false);
  const [locationErrorCountdown, setLocationErrorCountdown] = useState(3);
  const [rentFocused, setRentFocused] = useState(false);
  const [rentInput, setRentInput] = useState(
    displayedRent == null ? "" : formatRentCompact(displayedRent),
  );
  const [ageInput, setAgeInput] = useState(displayedAge == null ? "" : String(displayedAge));
  const locationCloseTimerRef = useRef<number | null>(null);
  const mobileLocationInputRef = useRef<HTMLInputElement | null>(null);
  const desktopLocationInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setRentInput(displayedRent == null ? "" : rentFocused ? String(displayedRent) : formatRentCompact(displayedRent));
  }, [displayedRent, rentFocused]);

  useEffect(() => {
    setAgeInput(displayedAge == null ? "" : String(displayedAge));
  }, [displayedAge]);

  useEffect(() => {
    setLocationInput(locationValue);
  }, [locationValue]);

  useEffect(() => {
    if (!locationError) return;
    setLocationInput(locationValue);
    setLocationMenuOpen(false);
    setLocationSuggestions([]);
    setShowLocationErrorToast(true);
    setLocationErrorCountdown(3);

    const tickTimer = window.setInterval(() => {
      setLocationErrorCountdown((current) => (current > 1 ? current - 1 : current));
    }, 1000);
    const closeTimer = window.setTimeout(() => {
      setShowLocationErrorToast(false);
      onLocationErrorDismiss();
    }, LOCATION_ERROR_TOAST_MS);

    return () => {
      window.clearInterval(tickTimer);
      window.clearTimeout(closeTimer);
    };
  }, [locationError, locationValue, onLocationErrorDismiss]);

  useEffect(() => {
    const query = locationInput.trim();
    if (query.length < 2) {
      setLocationSuggestions([]);
      setLocationLoading(false);
      return;
    }
    if (!locationMenuOpen && query === locationValue.trim()) {
      return;
    }

    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      setLocationLoading(true);
      fetchLocationSuggestions(query, ac.signal)
        .then((rows) => {
          setLocationSuggestions(rows);
          setLocationMenuOpen(true);
        })
        .catch(() => {
          if (ac.signal.aborted) return;
          setLocationSuggestions([]);
        })
        .finally(() => {
          if (!ac.signal.aborted) setLocationLoading(false);
        });
    }, 220);

    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [locationInput]);

  useEffect(() => {
    return () => {
      if (locationCloseTimerRef.current != null) window.clearTimeout(locationCloseTimerRef.current);
    };
  }, []);

  function handleLocationInputChange(nextValue: string) {
    onLocationInput();
    setLocationInput(nextValue);
    setLocationMenuOpen(true);
  }

  function handleLocationSelect(option: LocationSuggestion) {
    if (locationCloseTimerRef.current != null) window.clearTimeout(locationCloseTimerRef.current);
    setLocationInput(option.value);
    setLocationMenuOpen(false);
    setLocationSuggestions([]);
    setShowLocationErrorToast(false);
    onLocationSelect(option);
  }

  function handleLocationClear() {
    if (locationCloseTimerRef.current != null) window.clearTimeout(locationCloseTimerRef.current);
    setLocationInput(DEFAULT_SEARCH_CITY);
    setLocationMenuOpen(false);
    setLocationSuggestions([]);
    setShowLocationErrorToast(false);
    onLocationReset();
    window.requestAnimationFrame(() => {
      const activeInput =
        typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches
          ? mobileLocationInputRef.current
          : desktopLocationInputRef.current;
      activeInput?.focus();
      activeInput?.select();
    });
  }

  function scheduleLocationMenuClose() {
    if (locationCloseTimerRef.current != null) window.clearTimeout(locationCloseTimerRef.current);
    locationCloseTimerRef.current = window.setTimeout(() => {
      setLocationMenuOpen(false);
      locationCloseTimerRef.current = null;
    }, 120);
  }

  function openLocationMenu() {
    if (locationCloseTimerRef.current != null) window.clearTimeout(locationCloseTimerRef.current);
    onLocationInput();
    setLocationMenuOpen(true);
  }

  async function resolveBestLocationMatch() {
    const query = locationInput.trim();
    if (query.length < 2) {
      onLocationNotFound(query);
      return;
    }
    try {
      const rows = await fetchLocationSuggestions(query);
      if (rows.length) {
        handleLocationSelect(rows[0]!);
        return;
      }
    } catch {
      /* handled below */
    }
    onLocationNotFound(query);
  }

  function renderLocationField(mobile: boolean) {
    const locationMenuId = mobile ? mobileLocationMenuId : desktopLocationMenuId;
    const showLocationMenu = locationMenuOpen;
    const inputRef = mobile ? mobileLocationInputRef : desktopLocationInputRef;
    const inputShellClass = mobile
      ? "h-14 rounded-[1.2rem] border border-primary/15 bg-surface pl-4 pr-24 shadow-sm ring-primary/30 focus-within:ring-2"
      : "rounded-lg border border-primary/20 bg-surface pl-3 pr-[5.5rem] shadow-sm ring-primary/30 focus-within:ring-2";
    const inputClass = mobile
      ? "h-full w-full bg-transparent text-[1.35rem] font-semibold tracking-[-0.02em] text-body outline-none placeholder:text-muted/80"
      : "h-11 w-full bg-transparent text-sm font-medium text-body outline-none placeholder:text-muted/80";
    const menuClass = mobile
      ? "absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-[1.1rem] border border-primary/15 bg-surface shadow-xl"
      : "absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-primary/20 bg-surface shadow-xl";
    const optionClass = mobile
      ? "w-full px-4 py-3 text-left text-sm font-medium text-body transition hover:bg-bg-light"
      : "w-full px-3 py-2.5 text-left text-sm font-medium text-body transition hover:bg-bg-light";

    return (
      <div className="relative" onFocus={openLocationMenu} onBlur={scheduleLocationMenuClose}>
        <div className={inputShellClass}>
          <input
            id={mobile ? "mobile-search-location" : locationInputId}
            ref={inputRef}
            type="text"
            value={locationInput}
            onChange={(e) => handleLocationInputChange(e.target.value)}
            onFocus={(e) => {
              openLocationMenu();
              if (e.currentTarget.value.trim() && e.currentTarget.value === locationValue) {
                window.requestAnimationFrame(() => e.currentTarget.select());
              }
            }}
            placeholder="Ciudad o colonia"
            autoComplete="off"
            spellCheck={false}
            className={inputClass}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (locationSuggestions.length) {
                  handleLocationSelect(locationSuggestions[0]!);
                  return;
                }
                void resolveBestLocationMatch();
              }
              if (e.key === "Escape") {
                setLocationMenuOpen(false);
              }
            }}
            aria-autocomplete="list"
            aria-controls={locationMenuId}
            aria-expanded={showLocationMenu}
          />
          <div className="absolute inset-y-0 right-3 flex items-center gap-1.5">
            {locationInput.length ? (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleLocationClear}
                className="inline-flex size-7 items-center justify-center rounded-full text-body transition hover:bg-bg-light"
                aria-label="Borrar ubicación"
              >
                <X className="size-4" aria-hidden="true" strokeWidth={2.5} />
              </button>
            ) : null}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setLocationMenuOpen((current) => !current)}
              className="inline-flex size-7 items-center justify-center rounded-full text-body transition hover:bg-bg-light"
              aria-label={showLocationMenu ? "Ocultar sugerencias" : "Mostrar sugerencias"}
            >
              <ChevronDown
                className={`size-4 transition-transform duration-200 ${showLocationMenu ? "rotate-180" : ""}`}
                aria-hidden="true"
                strokeWidth={2.5}
              />
            </button>
            <span className="pointer-events-none inline-flex size-7 items-center justify-center text-primary/65" aria-hidden>
              <Search className={mobile ? "size-6" : "size-5"} strokeWidth={2.2} />
            </span>
          </div>
        </div>

        {showLocationMenu ? (
          <div id={locationMenuId} className={menuClass} role="listbox" aria-label="Opciones de ubicación">
            <div className="max-h-56 overflow-y-auto overscroll-contain py-1">
              {locationLoading ? (
                <div className={mobile ? "px-4 py-3 text-sm text-muted" : "px-3 py-2.5 text-sm text-muted"}>
                  Buscando colonias...
                </div>
              ) : locationSuggestions.length ? (
                locationSuggestions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    role="option"
                    aria-selected={locationInput === option.value}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleLocationSelect(option)}
                    className={optionClass}
                  >
                    {option.label}
                  </button>
                ))
              ) : (
                <div className={mobile ? "px-4 py-3 text-sm text-muted" : "px-3 py-2.5 text-sm text-muted"}>
                  Sin coincidencias. Sigue escribiendo o ajusta el mapa.
                </div>
              )}
            </div>
          </div>
        ) : null}
        {locationError && showLocationErrorToast ? (
          <div className="pointer-events-auto absolute left-0 right-0 top-full z-40 mt-2">
            <div className="rounded-[1rem] border border-red-200 bg-white/98 px-3 py-2 shadow-xl backdrop-blur">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug text-red-700">{locationError}</p>
                  <p className="mt-1 text-xs font-semibold text-red-500">
                    Cerrando en {locationErrorCountdown}s
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowLocationErrorToast(false);
                    onLocationErrorDismiss();
                  }}
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-red-700 transition hover:bg-red-50"
                  aria-label="Cerrar mensaje"
                >
                  <X className="size-4" aria-hidden="true" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function setBudgetMax(nextBudgetMax: number | null) {
    onChange({
      ...filters,
      budgetMin: null,
      budgetMax: nextBudgetMax,
    });
  }

  function stepBudget(delta: number) {
    const base = displayedRent ?? 0;
    const next = Math.max(0, base + delta);
    setBudgetMax(next);
    setRentInput(rentFocused ? String(next) : formatRentCompact(next));
  }

  function commitBudget() {
    const trimmed = rentInput.trim();
    if (trimmed === "") {
      setBudgetMax(null);
      setRentInput(displayedRent == null ? "" : String(displayedRent));
      return;
    }

    const next = Number(trimmed.replace(/\D/g, ""));
    if (!Number.isFinite(next)) {
      setRentInput(displayedRent == null ? "" : String(displayedRent));
      return;
    }

    const normalized = Math.max(0, Math.trunc(next));
    setBudgetMax(normalized);
    setRentInput(String(normalized));
  }

  function setAge(nextAge: number | null) {
    onChange({
      ...filters,
      age: nextAge,
      ageMin: null,
      ageMax: null,
    });
  }

  function stepAge(delta: number) {
    const next = displayedAge == null ? DEFAULT_MOBILE_AGE : clamp(displayedAge + delta, MIN_AGE, MAX_AGE);
    setAge(next);
    setAgeInput(String(next));
  }

  function commitAge() {
    const trimmed = ageInput.trim();
    if (trimmed === "") {
      setAge(null);
      setAgeInput("");
      return;
    }

    const next = Number(trimmed.replace(/\D/g, ""));
    if (!Number.isFinite(next)) {
      setAgeInput(String(displayedAge));
      return;
    }

    const normalized = clamp(Math.trunc(next), MIN_AGE, MAX_AGE);
    setAge(normalized);
    setAgeInput(String(normalized));
  }

  return (
    <div className="border-b border-primary/15 bg-secondary px-3 py-3 text-primary shadow-sm sm:px-4">
      <div className="mx-auto max-w-[1920px] sm:hidden">
        <div className="rounded-[1.75rem] bg-secondary/55 p-2.5 shadow-lg ring-1 ring-white/25 backdrop-blur-sm">
          <div className="grid gap-2.5">
            <label className="sr-only" htmlFor="mobile-search-location">
              Ciudad o colonia
            </label>
            {renderLocationField(true)}

            <div className="grid grid-cols-2 gap-2.5">
              <div className="grid rounded-[1.2rem] bg-surface p-2.5 shadow-sm ring-1 ring-primary/10">
                <div className="flex min-h-[1rem] items-center gap-2">
                  <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.12em] text-primary/75">
                    PRECIO RENTA MÁX.
                  </span>
                </div>
                <div className="mt-1.5 flex h-12 items-center overflow-hidden rounded-[1rem] border border-primary/15 bg-bg-light/55">
                  <button
                    type="button"
                    aria-label="Disminuir renta"
                    onClick={() => stepBudget(-RENT_STEP)}
                    className="flex h-full w-10 items-center justify-center text-[1.65rem] font-semibold text-primary transition active:bg-surface-elevated"
                  >
                    −
                  </button>
                  <input
                    inputMode="numeric"
                    type="text"
                    value={rentInput}
                    onFocus={() => {
                      setRentFocused(true);
                      setRentInput(displayedRent == null ? "" : String(displayedRent));
                    }}
                    onChange={(e) => setRentInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    onBlur={() => {
                      commitBudget();
                      setRentFocused(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="min-w-0 flex-1 bg-transparent px-1 text-center text-[1.2rem] font-semibold tabular-nums text-body outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Aumentar renta"
                    onClick={() => stepBudget(RENT_STEP)}
                    className="flex h-full w-10 items-center justify-center text-[1.65rem] font-semibold text-primary transition active:bg-surface-elevated"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="grid rounded-[1.2rem] bg-surface p-2.5 shadow-sm ring-1 ring-primary/10">
                <div className="flex min-h-[1rem] items-center gap-2">
                  <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.12em] text-primary/75">
                    Edad
                  </span>
                </div>
                <div className="mt-1.5 flex h-12 items-center overflow-hidden rounded-[1rem] border border-primary/15 bg-bg-light/55">
                  <button
                    type="button"
                    aria-label="Disminuir edad"
                    onClick={() => stepAge(-1)}
                    className="flex h-full w-10 items-center justify-center text-[1.65rem] font-semibold text-primary transition active:bg-surface-elevated"
                  >
                    −
                  </button>
                  <input
                    inputMode="numeric"
                    type="number"
                    min={MIN_AGE}
                    max={MAX_AGE}
                    value={ageInput}
                    onChange={(e) => setAgeInput(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    onBlur={commitAge}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className={`min-w-0 flex-1 bg-transparent px-1 text-center text-[1.2rem] font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                      filters.age == null ? "text-muted opacity-40" : "text-body"
                    }`}
                  />
                  <button
                    type="button"
                    aria-label="Aumentar edad"
                    onClick={() => stepAge(1)}
                    className="flex h-full w-10 items-center justify-center text-[1.65rem] font-semibold text-primary transition active:bg-surface-elevated"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onOpenAdvanced}
                className="inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-[1.1rem] border border-primary/20 bg-surface px-3 text-[0.92rem] font-semibold text-primary shadow-sm transition hover:border-primary/35"
              >
                <Filter className="size-4 shrink-0" aria-hidden="true" strokeWidth={2.2} />
                Más filtros
              </button>

              <button
                type="button"
                onClick={onClearFilters}
                disabled={!hasActiveFilters}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[1.1rem] border border-primary/20 bg-surface px-3.5 text-[0.95rem] font-semibold text-primary shadow-sm transition hover:border-primary/35 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                  <path strokeWidth="2" strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
                </svg>
                Borrar filtros
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto hidden max-w-[1920px] grid-cols-1 gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] lg:items-end lg:gap-4">
        <div className="min-w-0 sm:col-span-2 lg:col-span-1">
          <label className="block text-xs font-semibold uppercase tracking-wide text-primary/80">
            Ubicación
          </label>
          <div className="mt-1">{renderLocationField(false)}</div>
        </div>

        <label className="block min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary/80">
            Presupuesto máx (MXN / mes)
          </span>
          <input
            inputMode="numeric"
            type="number"
            min={0}
            step={100}
            value={filters.budgetMax ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                budgetMin: null,
                budgetMax: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            placeholder="Ej. 8000"
            className="mt-1 w-full rounded-lg border border-primary/20 bg-surface px-3 py-2.5 text-sm font-medium text-body shadow-sm outline-none ring-primary/30 focus:ring-2"
          />
        </label>

        <fieldset className="min-w-0">
          <legend className="text-xs font-semibold uppercase tracking-wide text-primary/80">
            Tipo de hospedaje
          </legend>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(
              [
                { key: "loft" as const, label: "Loft" },
                { key: "recamara" as const, label: "Recámara" },
              ] as const
            ).map(({ key, label }) => {
              const active = key === "loft" ? filters.wantLoft : filters.wantRecamara;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onChange(
                      key === "loft"
                        ? { ...filters, wantLoft: !filters.wantLoft, lodgingType: null }
                        : { ...filters, wantRecamara: !filters.wantRecamara, lodgingType: null },
                    )
                  }
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition sm:text-sm ${
                    active
                      ? "border-secondary bg-surface ring-2 ring-secondary/40"
                      : "border-primary/20 bg-surface/90 hover:border-secondary/50"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex min-w-0 items-end gap-2 sm:col-span-2 lg:col-span-1">
          <label className="block w-[5.25rem] shrink-0 sm:w-24">
            <span className="text-xs font-semibold uppercase tracking-wide text-primary/80">Edad</span>
            <input
              inputMode="numeric"
              type="number"
              min={16}
              max={99}
              value={filters.age ?? ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  age: e.target.value === "" ? null : Number(e.target.value),
                  ageMin: null,
                  ageMax: null,
                })
              }
              placeholder="Tu edad"
              className="mt-1 w-full rounded-lg border border-primary/20 bg-surface px-2.5 py-2.5 text-sm font-medium text-body shadow-sm outline-none ring-primary/30 focus:ring-2"
            />
          </label>
          <button
            type="button"
            onClick={onClearFilters}
            disabled={!hasActiveFilters}
            className="inline-flex h-[42px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-primary/25 bg-surface px-3 py-2 text-xs font-semibold text-primary shadow-sm transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:text-sm"
          >
            <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path strokeWidth="2" strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
            Borrar filtros
          </button>
        </div>
      </div>
    </div>
  );
}

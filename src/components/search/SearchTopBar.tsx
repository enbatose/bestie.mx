import { Check, ChevronDown, Filter, Pencil, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { SearchFilters } from "@/lib/searchFilters";
import { fetchLocationSuggestions, type LocationSuggestion } from "@/lib/listingsApi";
import { neighborhoodChipLabel, type SearchLocationState } from "@/lib/searchLocation";
import type { PropertyListing } from "@/types/listing";

type Props = {
  filters: SearchFilters;
  listings: PropertyListing[];
  onChange: (next: SearchFilters) => void;
  onOpenAdvanced: () => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  searchLocation: SearchLocationState;
  locationError: string | null;
  onCitySelect: (location: LocationSuggestion) => void;
  onNeighborhoodSelect: (location: LocationSuggestion) => void;
  onCityClear: () => void;
  onNeighborhoodClear: () => void;
  onCityRestore: () => void;
  onLocationInput: () => void;
  onLocationNotFound: (query: string) => void;
  onLocationErrorDismiss: () => void;
};

const DEFAULT_MOBILE_AGE = 27;
const MIN_AGE = 16;
const MAX_AGE = 99;
const RENT_STEP = 100;
const LOCATION_ERROR_TOAST_MS = 3_000;
const MOBILE_FILTER_HEIGHT = "h-14";
const MOBILE_FILTER_CONTROL_HEIGHT = "h-10";
const MOBILE_FILTER_LABEL_CLASS =
  "flex w-[2.65rem] shrink-0 items-center text-[8px] font-semibold uppercase leading-[1.15] tracking-[0.06em] text-primary";
const MOBILE_FILTER_SHELL_CLASS =
  "flex min-w-0 items-center gap-2 rounded-[1.2rem] bg-surface px-2 shadow-sm ring-1 ring-primary/10";
const MOBILE_FILTER_FIELD_WRAPPER_CLASS = "flex min-w-0 flex-1 items-center";
const MOBILE_FILTER_CONTROL_EXPANDED_CLASS = `grid ${MOBILE_FILTER_CONTROL_HEIGHT} w-full min-w-0 grid-cols-[2rem_minmax(3rem,1fr)_2rem_2rem] items-center overflow-hidden rounded-[1rem] border border-primary/15 bg-bg-light/55`;
const MOBILE_FILTER_CONTROL_COLLAPSED_CLASS = `flex ${MOBILE_FILTER_CONTROL_HEIGHT} w-full min-w-0 items-center justify-between gap-1 rounded-[1rem] border border-primary/15 bg-bg-light/55 px-2`;
const MOBILE_FILTER_VALUE_CLASS =
  "min-w-[2.75rem] flex-1 whitespace-nowrap text-center text-[0.95rem] font-semibold leading-none tabular-nums text-body";
const MOBILE_STEPPER_BTN_CLASS =
  "inline-flex h-full w-full items-center justify-center text-[1.2rem] font-semibold leading-none text-primary transition active:bg-surface-elevated";

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

function suggestionMenuLabel(option: LocationSuggestion, includeMetroPrefix: boolean) {
  if (!includeMetroPrefix && option.kind === "neighborhood" && option.neighborhood) {
    return option.neighborhood;
  }
  return option.label;
}

function LocationChip({
  label,
  onRemove,
  removeLabel,
  mobile,
}: {
  label: string;
  onRemove: () => void;
  removeLabel: string;
  mobile: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border border-primary/20 bg-bg-light font-semibold text-body ${
        mobile ? "max-w-[6.75rem] px-2 py-0.5 text-[0.7rem] leading-tight" : "max-w-[9rem] px-2 py-0.5 text-xs"
      }`}
    >
      <span className="truncate">{label}</span>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onRemove}
        className={`inline-flex shrink-0 items-center justify-center rounded-full text-body transition hover:bg-surface ${
          mobile ? "size-4" : "size-5"
        }`}
        aria-label={removeLabel}
      >
        <X className={mobile ? "size-3" : "size-3.5"} aria-hidden="true" strokeWidth={2.5} />
      </button>
    </span>
  );
}

export function SearchTopBar({
  filters,
  listings,
  onChange,
  onOpenAdvanced,
  onClearFilters,
  hasActiveFilters,
  searchLocation,
  locationError,
  onCitySelect,
  onNeighborhoodSelect,
  onCityClear,
  onNeighborhoodClear,
  onCityRestore,
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
  const [locationInput, setLocationInput] = useState("");
  const [cityChipVisible, setCityChipVisible] = useState(true);
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showLocationErrorToast, setShowLocationErrorToast] = useState(false);
  const [locationErrorCountdown, setLocationErrorCountdown] = useState(3);
  const [rentFocused, setRentFocused] = useState(false);
  const [mobileEditingField, setMobileEditingField] = useState<"rent" | "age" | null>(null);
  const [rentInput, setRentInput] = useState(
    displayedRent == null ? "" : formatRentCompact(displayedRent),
  );
  const [ageInput, setAgeInput] = useState(displayedAge == null ? "" : String(displayedAge));
  const locationCloseTimerRef = useRef<number | null>(null);
  const mobileFilterRowRef = useRef<HTMLDivElement | null>(null);
  const mobileLocationInputRef = useRef<HTMLInputElement | null>(null);
  const desktopLocationInputRef = useRef<HTMLInputElement | null>(null);
  const searchNeighborhoods = cityChipVisible;

  useEffect(() => {
    setLocationInput("");
    setLocationMenuOpen(false);
    setLocationSuggestions([]);
  }, [searchLocation.cityCode, searchLocation.neighborhood]);

  useEffect(() => {
    if (rentFocused) return;
    setRentInput(displayedRent == null ? "" : formatRentCompact(displayedRent));
  }, [displayedRent, rentFocused]);

  useEffect(() => {
    setAgeInput(displayedAge == null ? "" : String(displayedAge));
  }, [displayedAge]);

  useEffect(() => {
    if (!hasActiveFilters) {
      setMobileEditingField(null);
      setRentFocused(false);
    }
  }, [hasActiveFilters]);

  useEffect(() => {
    if (!locationError) return;
    setLocationInput("");
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
  }, [locationError, onLocationErrorDismiss]);

  useEffect(() => {
    const query = locationInput.trim();
    if (query.length < 2) {
      setLocationSuggestions([]);
      setLocationLoading(false);
      return;
    }

    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      setLocationLoading(true);
      fetchLocationSuggestions(query, {
        cityCode: searchNeighborhoods ? searchLocation.cityCode : null,
        scope: searchNeighborhoods ? "neighborhood" : "city",
        signal: ac.signal,
      })
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
  }, [locationInput, searchLocation.cityCode, searchNeighborhoods]);

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

  function handleSuggestionSelect(option: LocationSuggestion) {
    if (locationCloseTimerRef.current != null) window.clearTimeout(locationCloseTimerRef.current);
    setLocationInput("");
    setLocationMenuOpen(false);
    setLocationSuggestions([]);
    setShowLocationErrorToast(false);
    if (option.kind === "city") {
      setCityChipVisible(true);
      onCitySelect(option);
      return;
    }
    setCityChipVisible(true);
    onNeighborhoodSelect(option);
  }

  function handleCityChipRemove() {
    if (locationCloseTimerRef.current != null) window.clearTimeout(locationCloseTimerRef.current);
    onCityClear();
    setCityChipVisible(false);
    setLocationInput("");
    setLocationMenuOpen(true);
    setLocationSuggestions([]);
    setShowLocationErrorToast(false);
    window.requestAnimationFrame(() => {
      const activeInput =
        typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches
          ? mobileLocationInputRef.current
          : desktopLocationInputRef.current;
      activeInput?.focus();
    });
  }

  function handleNeighborhoodChipRemove() {
    if (locationCloseTimerRef.current != null) window.clearTimeout(locationCloseTimerRef.current);
    onNeighborhoodClear();
    setLocationInput("");
    setLocationMenuOpen(false);
    setLocationSuggestions([]);
    setShowLocationErrorToast(false);
    window.requestAnimationFrame(() => {
      const activeInput =
        typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches
          ? mobileLocationInputRef.current
          : desktopLocationInputRef.current;
      activeInput?.focus();
    });
  }

  function scheduleLocationMenuClose() {
    if (locationCloseTimerRef.current != null) window.clearTimeout(locationCloseTimerRef.current);
    locationCloseTimerRef.current = window.setTimeout(() => {
      setLocationMenuOpen(false);
      if (!cityChipVisible) {
        setCityChipVisible(true);
        onCityRestore();
      }
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
      const rows = await fetchLocationSuggestions(query, {
        cityCode: searchNeighborhoods ? searchLocation.cityCode : null,
        scope: searchNeighborhoods ? "neighborhood" : "city",
      });
      if (rows.length) {
        handleSuggestionSelect(rows[0]!);
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
      ? "relative h-14 w-full min-w-0 rounded-[1.2rem] border border-primary/15 bg-surface pl-3 pr-[4.75rem] shadow-sm ring-primary/30 focus-within:ring-2"
      : "relative w-full min-w-0 rounded-lg border border-primary/20 bg-surface pl-3 pr-[5.5rem] shadow-sm ring-primary/30 focus-within:ring-2";
    const inputRowClass = mobile
      ? "flex h-full min-w-0 items-center gap-1.5 overflow-hidden"
      : "flex h-11 min-w-0 items-center gap-1.5 overflow-hidden";
    const inputClass = mobile
      ? "h-full min-w-[4.5rem] flex-1 bg-transparent text-[1.35rem] font-semibold tracking-[-0.02em] text-body outline-none placeholder:text-muted/80"
      : "h-11 min-w-[4.5rem] flex-1 bg-transparent text-sm font-medium text-body outline-none placeholder:text-muted/80";
    const menuClass = mobile
      ? "absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-[1.1rem] border border-primary/15 bg-surface shadow-xl"
      : "absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-primary/20 bg-surface shadow-xl";
    const optionClass = mobile
      ? "w-full px-4 py-3 text-left text-sm font-medium text-body transition hover:bg-bg-light"
      : "w-full px-3 py-2.5 text-left text-sm font-medium text-body transition hover:bg-bg-light";
    const placeholder = searchNeighborhoods ? "Buscar colonia…" : "Buscar ciudad…";

    return (
      <div className="relative w-full min-w-0" onFocus={openLocationMenu} onBlur={scheduleLocationMenuClose}>
        <div className={inputShellClass}>
          <div className={inputRowClass}>
            {cityChipVisible ? (
              <LocationChip
                label={searchLocation.cityAbbr}
                onRemove={handleCityChipRemove}
                removeLabel={`Quitar ciudad ${searchLocation.cityLabel}`}
                mobile={mobile}
              />
            ) : null}
            {cityChipVisible && searchLocation.neighborhood ? (
              <LocationChip
                label={neighborhoodChipLabel(searchLocation)}
                onRemove={handleNeighborhoodChipRemove}
                removeLabel={`Quitar colonia ${neighborhoodChipLabel(searchLocation)}`}
                mobile={mobile}
              />
            ) : null}
            <input
              id={mobile ? "mobile-search-location" : locationInputId}
              ref={inputRef}
              type="text"
              value={locationInput}
              onChange={(e) => handleLocationInputChange(e.target.value)}
              onFocus={openLocationMenu}
              placeholder={placeholder}
              autoComplete="off"
              spellCheck={false}
              className={inputClass}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (locationSuggestions.length) {
                    handleSuggestionSelect(locationSuggestions[0]!);
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
          </div>
          <div className="absolute inset-y-0 right-3 flex items-center gap-1.5">
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
                  {searchNeighborhoods ? "Buscando colonias..." : "Buscando ciudades..."}
                </div>
              ) : locationSuggestions.length ? (
                locationSuggestions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSuggestionSelect(option)}
                    className={optionClass}
                  >
                    {suggestionMenuLabel(option, !searchNeighborhoods)}
                  </button>
                ))
              ) : locationInput.trim().length >= 2 ? (
                <div className={mobile ? "px-4 py-3 text-sm text-muted" : "px-3 py-2.5 text-sm text-muted"}>
                  Sin coincidencias. Sigue escribiendo o ajusta el mapa.
                </div>
              ) : (
                <div className={mobile ? "px-4 py-3 text-sm text-muted" : "px-3 py-2.5 text-sm text-muted"}>
                  {searchNeighborhoods
                    ? "Escribe al menos 2 letras para buscar colonias."
                    : "Escribe al menos 2 letras para buscar ciudades."}
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
      return;
    }

    const next = Number(trimmed.replace(/\D/g, ""));
    if (!Number.isFinite(next)) {
      return;
    }

    const normalized = Math.max(0, Math.trunc(next));
    setBudgetMax(normalized);
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

  function finishMobileEdit(field: "rent" | "age") {
    if (field === "rent") {
      commitBudget();
      setRentFocused(false);
    } else {
      commitAge();
    }
    setMobileEditingField(null);
  }

  function startMobileEdit(field: "rent" | "age") {
    if (mobileEditingField && mobileEditingField !== field) {
      finishMobileEdit(mobileEditingField);
    }
    if (field === "rent") {
      setRentFocused(false);
      setRentInput(displayedRent == null ? "" : formatRentCompact(displayedRent));
    }
    setMobileEditingField(field);
  }

  const rentCollapsedDisplay =
    displayedRent == null ? "" : formatRentCompact(displayedRent);
  const ageCollapsedDisplay = displayedAge == null ? "" : String(displayedAge);
  const rentStepperDisplay =
    rentInput || rentCollapsedDisplay;

  return (
    <div className="w-full min-w-0 overflow-x-hidden border-b border-primary/15 bg-secondary px-2 py-3 text-primary shadow-sm sm:px-4">
      <div className="mx-auto w-full min-w-0 max-w-[1920px] sm:hidden">
        <div className="w-full min-w-0 rounded-[1.75rem] bg-secondary/55 p-2 shadow-lg ring-1 ring-white/25 backdrop-blur-sm">
          <div className="grid w-full min-w-0 gap-2">
            <label className="sr-only" htmlFor="mobile-search-location">
              Ciudad o colonia
            </label>
            {renderLocationField(true)}

            <div ref={mobileFilterRowRef} className={`grid min-w-0 grid-cols-2 gap-2 ${MOBILE_FILTER_HEIGHT}`}>
              <div
                className={`${MOBILE_FILTER_SHELL_CLASS} ${MOBILE_FILTER_HEIGHT} min-w-0 ${
                  mobileEditingField === "rent" ? "relative z-[1] gap-0" : ""
                }`}
              >
                {mobileEditingField === "rent" ? null : (
                  <span className={MOBILE_FILTER_LABEL_CLASS}>Renta máx.</span>
                )}
                <div
                  className={
                    mobileEditingField === "rent"
                      ? "flex min-w-0 flex-1 items-center"
                      : MOBILE_FILTER_FIELD_WRAPPER_CLASS
                  }
                >
                  {mobileEditingField === "rent" ? (
                    <div className={MOBILE_FILTER_CONTROL_EXPANDED_CLASS}>
                      <button
                        type="button"
                        aria-label="Disminuir renta"
                        onClick={() => stepBudget(-RENT_STEP)}
                        className={MOBILE_STEPPER_BTN_CLASS}
                      >
                        −
                      </button>
                      {rentFocused ? (
                        <input
                          inputMode="numeric"
                          type="text"
                          autoFocus
                          value={rentInput}
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
                          className="w-full min-w-0 bg-transparent px-0.5 text-center text-[0.92rem] font-semibold tabular-nums text-body outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setRentFocused(true);
                            setRentInput(displayedRent == null ? "" : String(displayedRent));
                          }}
                          className={`${MOBILE_FILTER_VALUE_CLASS} h-full w-full px-0.5`}
                        >
                          {rentStepperDisplay}
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label="Aumentar renta"
                        onClick={() => stepBudget(RENT_STEP)}
                        className={MOBILE_STEPPER_BTN_CLASS}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        aria-label="Aplicar renta máxima"
                        onClick={() => finishMobileEdit("rent")}
                        className={`${MOBILE_STEPPER_BTN_CLASS} border-l border-primary/15`}
                      >
                        <Check className="size-4" aria-hidden="true" strokeWidth={2.5} />
                      </button>
                    </div>
                  ) : (
                    <div className={MOBILE_FILTER_CONTROL_COLLAPSED_CLASS}>
                      <span className={MOBILE_FILTER_VALUE_CLASS}>{rentCollapsedDisplay}</span>
                      <button
                        type="button"
                        aria-label="Editar renta máxima"
                        onClick={() => startMobileEdit("rent")}
                        className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-primary transition active:bg-surface-elevated"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" strokeWidth={2.2} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div
                className={`${MOBILE_FILTER_SHELL_CLASS} ${MOBILE_FILTER_HEIGHT} min-w-0 ${
                  mobileEditingField === "age" ? "relative z-[1] gap-0" : ""
                }`}
              >
                {mobileEditingField === "age" ? null : (
                  <span className={MOBILE_FILTER_LABEL_CLASS}>Edad</span>
                )}
                <div
                  className={
                    mobileEditingField === "age"
                      ? "flex min-w-0 flex-1 items-center"
                      : MOBILE_FILTER_FIELD_WRAPPER_CLASS
                  }
                >
                  {mobileEditingField === "age" ? (
                    <div className={MOBILE_FILTER_CONTROL_EXPANDED_CLASS}>
                      <button
                        type="button"
                        aria-label="Disminuir edad"
                        onClick={() => stepAge(-1)}
                        className={MOBILE_STEPPER_BTN_CLASS}
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
                        className={`w-full min-w-0 bg-transparent px-0.5 text-center text-[0.92rem] font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                          filters.age == null ? "text-muted opacity-40" : "text-body"
                        }`}
                      />
                      <button
                        type="button"
                        aria-label="Aumentar edad"
                        onClick={() => stepAge(1)}
                        className={MOBILE_STEPPER_BTN_CLASS}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        aria-label="Aplicar edad"
                        onClick={() => finishMobileEdit("age")}
                        className={`${MOBILE_STEPPER_BTN_CLASS} border-l border-primary/15`}
                      >
                        <Check className="size-4" aria-hidden="true" strokeWidth={2.5} />
                      </button>
                    </div>
                  ) : (
                    <div className={MOBILE_FILTER_CONTROL_COLLAPSED_CLASS}>
                      <span
                        className={`${MOBILE_FILTER_VALUE_CLASS} ${
                          filters.age == null ? "text-muted opacity-40" : ""
                        }`}
                      >
                        {ageCollapsedDisplay}
                      </span>
                      <button
                        type="button"
                        aria-label="Editar edad"
                        onClick={() => startMobileEdit("age")}
                        className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-primary transition active:bg-surface-elevated"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" strokeWidth={2.2} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={`grid min-w-0 grid-cols-2 gap-2 ${MOBILE_FILTER_HEIGHT}`}>
              <button
                type="button"
                onClick={onOpenAdvanced}
                className={`inline-flex ${MOBILE_FILTER_HEIGHT} min-w-0 items-center justify-center gap-1.5 rounded-[1.2rem] border border-primary/20 bg-surface px-2 text-[0.86rem] font-semibold text-primary shadow-sm transition hover:border-primary/35`}
              >
                <Filter className="size-4 shrink-0" aria-hidden="true" strokeWidth={2.2} />
                <span className="truncate">Más filtros</span>
              </button>

              <button
                type="button"
                onClick={onClearFilters}
                disabled={!hasActiveFilters}
                className={`inline-flex ${MOBILE_FILTER_HEIGHT} min-w-0 items-center justify-center gap-1.5 rounded-[1.2rem] border border-primary/20 bg-surface px-2 text-[0.86rem] font-semibold text-primary shadow-sm transition hover:border-primary/35 disabled:cursor-not-allowed disabled:opacity-45`}
              >
                <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                  <path strokeWidth="2" strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
                </svg>
                <span className="truncate">Borrar filtros</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto hidden w-full min-w-0 max-w-[1920px] grid-cols-1 gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] lg:items-end lg:gap-4">
        <div className="min-w-0 sm:col-span-2 lg:col-span-1">
          <label className="block text-xs font-semibold uppercase tracking-wide text-primary/80">
            Ciudad o colonia
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

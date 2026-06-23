import { Check, ChevronDown, Filter, Pencil, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { SearchFilters } from "@/lib/searchFilters";
import { fetchLocationSuggestions, type LocationSuggestion } from "@/lib/listingsApi";
import { neighborhoodChipLabel, neighborhoodNamesMatch, type SearchLocationState } from "@/lib/searchLocation";
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
  onNeighborhoodRemove: (name: string) => void;
  onCityRestore: () => void;
  onLocationInput: () => void;
  onLocationNotFound: (query: string) => void;
  onLocationErrorDismiss: () => void;
};

const RENT_STEP = 100;
const LOCATION_ERROR_TOAST_MS = 3_000;
const MOBILE_FILTER_HEIGHT = "h-14";
const MOBILE_FILTER_CONTROL_HEIGHT = "h-10";
const MOBILE_FILTER_LABEL_CLASS =
  "flex shrink-0 items-center text-[0.86rem] font-semibold leading-none text-primary";
const MOBILE_FILTER_SHELL_CLASS =
  "flex min-w-0 items-center gap-2 rounded-[1.2rem] bg-surface px-2 shadow-sm ring-1 ring-primary/10";
const MOBILE_FILTER_FIELD_WRAPPER_CLASS = "flex min-w-0 flex-1 items-center";
const MOBILE_FILTER_CONTROL_EXPANDED_CLASS = `grid ${MOBILE_FILTER_CONTROL_HEIGHT} w-full min-w-0 grid-cols-[2rem_minmax(3rem,1fr)_2rem_2rem] items-center overflow-hidden rounded-[1rem] border border-primary/15 bg-bg-light/55`;
const MOBILE_FILTER_CONTROL_COLLAPSED_CLASS = `flex ${MOBILE_FILTER_CONTROL_HEIGHT} w-full min-w-0 items-center justify-between gap-1 rounded-[1rem] border border-primary/15 bg-bg-light/55 px-2`;
const MOBILE_FILTER_VALUE_CLASS =
  "min-w-[2.75rem] flex-1 whitespace-nowrap text-center text-[0.95rem] font-semibold leading-none tabular-nums text-body";
const MOBILE_GENDER_SEGMENT_CLASS = (active: boolean) =>
  `flex-1 rounded-[0.65rem] px-0.5 py-1.5 text-center text-[0.78rem] font-semibold leading-none transition ${
    active ? "bg-primary text-primary-fg shadow-sm" : "text-body active:bg-surface-elevated/80"
  }`;
const DESKTOP_FILTER_LABEL_CLASS =
  "block h-4 text-xs font-semibold uppercase leading-4 tracking-wide text-primary/80";
const DESKTOP_FILTER_CONTROL_CLASS = "mt-1 h-[42px]";
const DESKTOP_GENDER_SEGMENT_CLASS = (active: boolean) =>
  `flex-1 rounded-md px-1 py-1.5 text-center text-xs font-semibold leading-none transition sm:text-sm ${
    active ? "bg-primary text-primary-fg shadow-sm" : "text-body hover:bg-bg-light"
  }`;
const MOBILE_STEPPER_BTN_CLASS =
  "inline-flex h-full w-full items-center justify-center text-[1.2rem] font-semibold leading-none text-primary transition active:bg-surface-elevated";

function highestVisibleRent(listings: PropertyListing[]) {
  return listings.reduce((max, listing) => Math.max(max, listing.rentMxn), 0);
}

function formatRentCompact(value: number) {
  if (value < 1000) return String(value);
  const compact = value / 1000;
  const rounded = Number.isInteger(compact) ? String(compact) : compact.toFixed(1).replace(/\.0$/, "");
  return `${rounded}K`;
}

function parseRentMxnInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const compactMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*k$/i);
  if (compactMatch) {
    const amount = Number(compactMatch[1]!.replace(",", "."));
    if (!Number.isFinite(amount)) return null;
    return Math.max(0, Math.round(amount * 1000));
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits === "") return null;
  const next = Number(digits);
  if (!Number.isFinite(next)) return null;
  return Math.max(0, Math.trunc(next));
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
  onNeighborhoodRemove,
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
  const [locationInput, setLocationInput] = useState("");
  const [cityChipVisible, setCityChipVisible] = useState(true);
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showLocationErrorToast, setShowLocationErrorToast] = useState(false);
  const [locationErrorCountdown, setLocationErrorCountdown] = useState(3);
  const [rentFocused, setRentFocused] = useState(false);
  const [mobileEditingField, setMobileEditingField] = useState<"rent" | null>(null);
  const [rentInput, setRentInput] = useState(
    displayedRent == null ? "" : formatRentCompact(displayedRent),
  );
  const locationCloseTimerRef = useRef<number | null>(null);
  const mobileFilterRowRef = useRef<HTMLDivElement | null>(null);
  const mobileLocationInputRef = useRef<HTMLInputElement | null>(null);
  const desktopLocationInputRef = useRef<HTMLInputElement | null>(null);
  const searchNeighborhoods = cityChipVisible;

  const neighborhoodSelectionKey = searchLocation.neighborhoods.map((pin) => pin.name).join("|");

  useEffect(() => {
    setLocationInput("");
    setLocationMenuOpen(false);
    setLocationSuggestions([]);
  }, [searchLocation.cityCode, neighborhoodSelectionKey]);

  useEffect(() => {
    if (rentFocused) return;
    setRentInput(displayedRent == null ? "" : formatRentCompact(displayedRent));
  }, [displayedRent, rentFocused]);

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

  function handleNeighborhoodChipRemove(name: string) {
    if (locationCloseTimerRef.current != null) window.clearTimeout(locationCloseTimerRef.current);
    onNeighborhoodRemove(name);
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
      : "relative h-[42px] w-full min-w-0 rounded-lg border border-primary/20 bg-surface pl-3 pr-[5.5rem] shadow-sm ring-primary/30 focus-within:ring-2";
    const inputRowClass = mobile
      ? "flex h-full min-w-0 items-center gap-1.5 overflow-hidden"
      : "flex h-full min-w-0 items-center gap-1.5 overflow-hidden";
    const inputClass = mobile
      ? "h-full min-w-[4.5rem] flex-1 bg-transparent text-[1.35rem] font-semibold tracking-[-0.02em] text-body outline-none placeholder:text-muted/80"
      : "h-full min-w-[4.5rem] flex-1 bg-transparent text-sm font-medium text-body outline-none placeholder:text-muted/80";
    const menuClass = mobile
      ? "absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-[1.1rem] border border-primary/15 bg-surface shadow-xl"
      : "absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-primary/20 bg-surface shadow-xl";
    const optionClass = mobile
      ? "w-full px-4 py-3 text-left text-sm font-medium text-body transition hover:bg-bg-light"
      : "w-full px-3 py-2.5 text-left text-sm font-medium text-body transition hover:bg-bg-light";
    const placeholder = searchNeighborhoods ? "Buscar colonia…" : "Buscar ciudad…";
    const visibleSuggestions = locationSuggestions.filter((option) => {
      if (option.kind !== "neighborhood") return true;
      const candidate = option.neighborhood ?? option.label;
      if (!candidate) return true;
      return !searchLocation.neighborhoods.some((pin) => neighborhoodNamesMatch(pin.name, candidate));
    });

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
            {cityChipVisible
              ? searchLocation.neighborhoods.map((pin) => (
                  <LocationChip
                    key={pin.name}
                    label={neighborhoodChipLabel(pin.name, searchLocation.cityAbbr)}
                    onRemove={() => handleNeighborhoodChipRemove(pin.name)}
                    removeLabel={`Quitar colonia ${neighborhoodChipLabel(pin.name, searchLocation.cityAbbr)}`}
                    mobile={mobile}
                  />
                ))
              : null}
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
                  if (visibleSuggestions.length) {
                    handleSuggestionSelect(visibleSuggestions[0]!);
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
              ) : visibleSuggestions.length ? (
                visibleSuggestions.map((option) => (
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
    if (rentInput.trim() === "") {
      setBudgetMax(null);
      return;
    }

    const parsed = parseRentMxnInput(rentInput);
    if (parsed == null) return;

    setBudgetMax(parsed);
  }

  function setGenderPref(nextPref: "male" | "female") {
    onChange({
      ...filters,
      pref: filters.pref === nextPref ? null : nextPref,
    });
  }

  function finishMobileEdit() {
    commitBudget();
    setRentFocused(false);
    const parsed = parseRentMxnInput(rentInput);
    if (parsed != null) {
      setRentInput(formatRentCompact(parsed));
    } else if (displayedRent != null) {
      setRentInput(formatRentCompact(displayedRent));
    }
    setMobileEditingField(null);
  }

  function startMobileEdit() {
    setRentFocused(false);
    setRentInput(displayedRent == null ? "" : formatRentCompact(displayedRent));
    setMobileEditingField("rent");
  }

  const rentCollapsedDisplay =
    displayedRent == null ? "" : formatRentCompact(displayedRent);
  const rentStepperDisplay =
    rentInput || rentCollapsedDisplay;

  return (
    <div className="w-full min-w-0 overflow-x-hidden border-b border-primary/15 bg-secondary px-4 py-3 text-primary shadow-sm sm:px-6 lg:px-8">
      <div className="w-full min-w-0 sm:hidden">
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
                  <span className={MOBILE_FILTER_LABEL_CLASS}>Renta</span>
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
                        onClick={finishMobileEdit}
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
                        onClick={startMobileEdit}
                        className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-primary transition active:bg-surface-elevated"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" strokeWidth={2.2} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className={`${MOBILE_FILTER_SHELL_CLASS} ${MOBILE_FILTER_HEIGHT} min-w-0`}>
                <div
                  className={`${MOBILE_FILTER_CONTROL_COLLAPSED_CLASS} w-full justify-center gap-0.5 px-1`}
                  role="group"
                  aria-label="Filtrar por género"
                >
                  <button
                    type="button"
                    aria-pressed={filters.pref === "female"}
                    onClick={() => setGenderPref("female")}
                    className={MOBILE_GENDER_SEGMENT_CLASS(filters.pref === "female")}
                  >
                    Mujer
                  </button>
                  <span className="px-0.5 text-[0.82rem] font-semibold text-muted/70" aria-hidden>
                    |
                  </span>
                  <button
                    type="button"
                    aria-pressed={filters.pref === "male"}
                    onClick={() => setGenderPref("male")}
                    className={MOBILE_GENDER_SEGMENT_CLASS(filters.pref === "male")}
                  >
                    Hombre
                  </button>
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

      <div className="hidden w-full min-w-0 sm:flex sm:items-end sm:gap-3 lg:gap-4">
        <div className="min-w-0 flex-[2.4]">
          <label className={DESKTOP_FILTER_LABEL_CLASS} htmlFor={locationInputId}>
            Ciudad o colonia
          </label>
          <div className={DESKTOP_FILTER_CONTROL_CLASS}>{renderLocationField(false)}</div>
        </div>

        <label className="block min-w-[7.5rem] flex-[1] max-w-[11rem] shrink-0">
          <span className={DESKTOP_FILTER_LABEL_CLASS}>Renta</span>
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
            className={`${DESKTOP_FILTER_CONTROL_CLASS} w-full rounded-lg border border-primary/20 bg-surface px-2.5 text-sm font-medium text-body shadow-sm outline-none ring-primary/30 focus:ring-2`}
          />
        </label>

        <fieldset className="shrink-0">
          <legend className={DESKTOP_FILTER_LABEL_CLASS}>Género</legend>
          <div
            className={`${DESKTOP_FILTER_CONTROL_CLASS} flex w-[9.75rem] items-center gap-0.5 rounded-lg border border-primary/20 bg-surface px-1 shadow-sm`}
            role="group"
            aria-label="Filtrar por género"
          >
            <button
              type="button"
              aria-pressed={filters.pref === "female"}
              onClick={() => setGenderPref("female")}
              className={DESKTOP_GENDER_SEGMENT_CLASS(filters.pref === "female")}
            >
              Mujer
            </button>
            <span className="px-0.5 text-xs font-semibold text-muted/70" aria-hidden>
              |
            </span>
            <button
              type="button"
              aria-pressed={filters.pref === "male"}
              onClick={() => setGenderPref("male")}
              className={DESKTOP_GENDER_SEGMENT_CLASS(filters.pref === "male")}
            >
              Hombre
            </button>
          </div>
        </fieldset>

        <label className="block w-[4.75rem] shrink-0 sm:w-20">
          <span className={DESKTOP_FILTER_LABEL_CLASS}>Edad</span>
          <input
            inputMode="numeric"
            type="number"
            min={16}
            max={99}
            value={filters.age != null ? filters.age : ""}
            onChange={(e) =>
              onChange({
                ...filters,
                age: e.target.value === "" ? null : Number(e.target.value),
                ageMin: null,
                ageMax: null,
              })
            }
            placeholder="Ej. 25"
            className={`${DESKTOP_FILTER_CONTROL_CLASS} w-full rounded-lg border border-primary/20 bg-surface px-2 text-sm font-medium text-body shadow-sm outline-none ring-primary/30 focus:ring-2`}
          />
        </label>

        <div className="ml-auto flex shrink-0 items-end gap-2">
          <button
            type="button"
            onClick={onOpenAdvanced}
            className="inline-flex h-[42px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-primary/25 bg-surface px-3 text-xs font-semibold text-primary shadow-sm transition hover:border-primary/40 sm:px-4 sm:text-sm"
          >
            <Filter className="size-3.5 shrink-0" aria-hidden="true" strokeWidth={2.2} />
            Más Filtros
          </button>
          <button
            type="button"
            onClick={onClearFilters}
            disabled={!hasActiveFilters}
            className="inline-flex h-[42px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-primary/25 bg-surface px-3 text-xs font-semibold text-primary shadow-sm transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:text-sm"
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

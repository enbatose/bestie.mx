import { Check, ChevronDown, Pencil, Search, X } from "lucide-react";
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import { SaveSearchButton, MobileCombinedFilterBar, FilterActionsGroup } from "@/components/search/SaveSearchButton";
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
  onNeighborhoodSearchCommit?: () => void;
  onLocationInput: () => void;
  onLocationNotFound: (query: string) => void;
  onLocationErrorDismiss: () => void;
  onSaveClick?: () => void;
  saveSearchPulse?: boolean;
  guestSaveNudge?: {
    visible: boolean;
    onDismiss: () => void;
    onClick: () => void;
  };
};

const RENT_STEP = 100;
const RENT_DEFAULT_START = 6000;
const AGE_MIN = 16;
const AGE_MAX = 99;
const AGE_DEFAULT_START = 27;

function stepAge(current: number | null, delta: number): number {
  if (current == null) return AGE_DEFAULT_START;
  return Math.min(AGE_MAX, Math.max(AGE_MIN, current + delta));
}

function stepRent(current: number | null, delta: number): number {
  if (current == null) return RENT_DEFAULT_START;
  return Math.max(0, current + delta);
}
const LOCATION_ERROR_TOAST_MS = 3_000;
const MOBILE_FILTER_HEIGHT = "h-14";
const MOBILE_FILTER_CONTROL_HEIGHT = "h-10";
const MOBILE_FILTER_LABEL_CLASS =
  "flex shrink-0 items-center text-[0.86rem] font-semibold leading-none text-primary";
const MOBILE_FILTER_SHELL_CLASS =
  "flex min-w-0 items-center gap-2 rounded-[1.2rem] bg-surface px-2 shadow-sm ring-1 ring-primary/10";
const MOBILE_FILTER_FIELD_WRAPPER_CLASS = "flex min-w-0 flex-1 items-center";
const MOBILE_FILTER_CONTROL_EXPANDED_CLASS = `grid ${MOBILE_FILTER_CONTROL_HEIGHT} w-full min-w-0 grid-cols-[2rem_minmax(2.5rem,1fr)_2rem_1px_2rem] items-center overflow-hidden rounded-[1rem] border border-primary/15 bg-bg-light/55`;
const MOBILE_FILTER_CONTROL_COLLAPSED_CLASS = `flex ${MOBILE_FILTER_CONTROL_HEIGHT} w-full min-w-0 items-center justify-between gap-1 rounded-[1rem] border border-primary/15 bg-bg-light/55 px-2`;
const MOBILE_FILTER_VALUE_CLASS =
  "min-w-[2.75rem] flex-1 whitespace-nowrap text-center text-[0.95rem] font-semibold leading-none tabular-nums text-body";
const MOBILE_GENDER_SEGMENT_CLASS = (active: boolean) =>
  `inline-flex h-full min-w-0 flex-1 items-center justify-center rounded-[0.55rem] px-1 text-center text-[0.78rem] font-semibold leading-none transition ${
    active ? "bg-primary text-primary-fg shadow-sm" : "text-body active:bg-surface-elevated/80"
  }`;
const DESKTOP_FILTER_LABEL_CLASS =
  "block h-4 text-xs font-semibold uppercase leading-4 tracking-wide text-primary/80";
const DESKTOP_LOCATION_LABEL_CLASS =
  "block h-4 text-xs font-semibold uppercase leading-4 tracking-wide text-surface";
const DESKTOP_FILTER_CONTROL_CLASS = "mt-1 h-[42px]";
const DESKTOP_GENDER_SEGMENT_CLASS = (active: boolean) =>
  `inline-flex min-w-0 flex-1 items-center justify-center rounded-md px-1.5 py-1.5 text-center text-xs font-semibold leading-none transition sm:text-sm ${
    active ? "bg-primary text-primary-fg shadow-sm" : "text-body hover:bg-bg-light"
  }`;
const MOBILE_STEPPER_BTN_CLASS =
  "inline-flex h-full w-full items-center justify-center text-[1.2rem] font-semibold leading-none text-primary transition active:bg-surface-elevated";

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

function estimateLocationChipRows(
  mobile: boolean,
  cityVisible: boolean,
  neighborhoodCount: number,
): number {
  const totalChips = (cityVisible ? 1 : 0) + neighborhoodCount;
  if (totalChips <= 1) return 1;
  const chipsPerRow = mobile ? 3 : 5;
  return Math.min(3, Math.ceil(totalChips / chipsPerRow));
}

function locationFieldShellClass(mobile: boolean, chipRows: number) {
  if (mobile) {
    if (chipRows <= 1) {
      return "relative min-h-14 w-full min-w-0 rounded-[1.2rem] border border-primary/15 bg-surface py-2 pl-3 pr-[4.75rem] shadow-sm ring-primary/30 focus-within:ring-2";
    }
    if (chipRows === 2) {
      return "relative min-h-[4.6rem] w-full min-w-0 rounded-[1.2rem] border border-primary/15 bg-surface py-2 pl-3 pr-[4.75rem] shadow-sm ring-primary/30 focus-within:ring-2";
    }
    return "relative min-h-[5.85rem] w-full min-w-0 rounded-[1.2rem] border border-primary/15 bg-surface py-2 pl-3 pr-[4.75rem] shadow-sm ring-primary/30 focus-within:ring-2";
  }

  if (chipRows <= 1) {
    return "relative min-h-[42px] w-full min-w-0 rounded-lg border border-primary/20 bg-surface py-1.5 pl-3 pr-[5.5rem] shadow-sm ring-primary/30 focus-within:ring-2";
  }
  if (chipRows === 2) {
    return "relative min-h-[58px] w-full min-w-0 rounded-lg border border-primary/20 bg-surface py-1.5 pl-3 pr-[5.5rem] shadow-sm ring-primary/30 focus-within:ring-2";
  }
  return "relative min-h-[74px] w-full min-w-0 rounded-lg border border-primary/20 bg-surface py-1.5 pl-3 pr-[5.5rem] shadow-sm ring-primary/30 focus-within:ring-2";
}

function LocationChip({
  label,
  onRemove,
  removeLabel,
  mobile,
  variant = "neighborhood",
}: {
  label: string;
  onRemove: () => void;
  removeLabel: string;
  mobile: boolean;
  variant?: "city" | "neighborhood";
}) {
  const sizeClass = mobile
    ? "max-w-[6.75rem] px-2 py-0.5 text-[0.7rem] leading-tight"
    : "max-w-[9rem] px-2 py-0.5 text-xs";
  const toneClass =
    variant === "city"
      ? "border-primary/35 bg-primary text-primary-fg"
      : "border-primary/20 bg-bg-light text-body";
  const removeBtnClass =
    variant === "city"
      ? "text-primary-fg transition hover:bg-primary/80"
      : "text-body transition hover:bg-surface";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border font-semibold ${toneClass} ${sizeClass}`}
    >
      <span className={`truncate ${variant === "city" ? "text-primary-fg" : ""}`}>{label}</span>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onRemove}
        className={`inline-flex shrink-0 items-center justify-center rounded-full ${removeBtnClass} ${
          mobile ? "size-4" : "size-5"
        }`}
        aria-label={removeLabel}
      >
        <X className={mobile ? "size-3" : "size-3.5"} aria-hidden="true" strokeWidth={2.5} />
      </button>
    </span>
  );
}

export type SearchTopBarHandle = {
  /** Applies pending rent input from the horizontal bar before saving a search. */
  commitPendingHorizontalFilters: () => SearchFilters;
};

export const SearchTopBar = forwardRef<SearchTopBarHandle, Props>(function SearchTopBar(
  {
    filters,
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
    onNeighborhoodSearchCommit,
    onLocationInput,
    onLocationNotFound,
    onLocationErrorDismiss,
    onSaveClick,
    saveSearchPulse = false,
    guestSaveNudge,
  },
  ref,
) {
  const locationInputId = useId();
  const mobileLocationMenuId = useId();
  const desktopLocationMenuId = useId();
  const displayedRent = filters.budgetMax;
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

  const pulseActive = saveSearchPulse;

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

  function commitNeighborhoodSelection() {
    setLocationInput("");
    setLocationMenuOpen(false);
    setLocationSuggestions([]);
    setShowLocationErrorToast(false);
    onLocationInput();
    onNeighborhoodSearchCommit?.();
  }

  async function resolveBestLocationMatch() {
    const query = locationInput.trim();
    if (query.length === 0) {
      commitNeighborhoodSelection();
      return;
    }
    if (query.length < 2) {
      commitNeighborhoodSelection();
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
    const chipRows = estimateLocationChipRows(
      mobile,
      cityChipVisible,
      searchLocation.neighborhoods.length,
    );
    const inputShellClass = locationFieldShellClass(mobile, chipRows);
    const chipWrapClass = mobile
      ? "flex max-h-[3.6rem] min-w-0 flex-1 flex-row flex-wrap items-center gap-x-1.5 gap-y-1 overflow-hidden"
      : "flex max-h-[3.1rem] min-w-0 flex-1 flex-row flex-wrap items-center gap-x-1.5 gap-y-1 overflow-hidden";
    const inputRowClass = "flex min-w-0 items-start";
    const hasNeighborhoodChips = searchNeighborhoods && searchLocation.neighborhoods.length > 0;
    const locationPlaceholder = searchNeighborhoods
      ? hasNeighborhoodChips
        ? ""
        : "Buscar colonia…"
      : "Buscar ciudad…";
    const inputClass = mobile
      ? `min-h-[1.25rem] min-w-[1.5rem] flex-[1_1_1.5rem] bg-transparent text-[0.86rem] font-semibold leading-none tracking-normal text-primary caret-primary outline-none ${
          locationPlaceholder ? "placeholder:text-primary" : "placeholder:text-transparent"
        }`
      : `min-h-[1.25rem] min-w-[1.5rem] flex-[1_1_1.5rem] bg-transparent text-sm font-medium text-body caret-body outline-none ${
          locationPlaceholder ? "placeholder:text-muted/80" : "placeholder:text-transparent"
        }`;
    const menuClass = mobile
      ? "absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-[1.1rem] border border-primary/15 bg-surface shadow-xl"
      : "absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-primary/20 bg-surface shadow-xl";
    const optionClass = mobile
      ? "w-full px-4 py-3 text-left text-sm font-medium text-body transition hover:bg-bg-light"
      : "w-full px-3 py-2.5 text-left text-sm font-medium text-body transition hover:bg-bg-light";
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
            <div className={chipWrapClass}>
              {cityChipVisible ? (
                <LocationChip
                  variant="city"
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
                placeholder={locationPlaceholder}
                aria-label={
                  hasNeighborhoodChips ? "Agregar otra colonia" : locationPlaceholder || "Buscar ubicación"
                }
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
          </div>
          <div
            className={`absolute right-3 flex items-center gap-1.5 ${
              chipRows > 1 ? "top-2" : "inset-y-0"
            }`}
          >
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
            <div className="rounded-[1rem] border border-error/30 bg-surface/98 px-3 py-2 shadow-xl backdrop-blur">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug text-error">{locationError}</p>
                  <p className="mt-1 text-xs font-semibold text-error/80">
                    Cerrando en {locationErrorCountdown}s
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowLocationErrorToast(false);
                    onLocationErrorDismiss();
                  }}
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-error transition hover:bg-error/5"
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
    const next = stepRent(displayedRent, delta);
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

  useImperativeHandle(
    ref,
    () => ({
      commitPendingHorizontalFilters(): SearchFilters {
        if (mobileEditingField !== "rent" && !rentFocused) {
          return filters;
        }

        if (rentInput.trim() === "") {
          const next = { ...filters, budgetMin: null, budgetMax: null };
          onChange(next);
          setMobileEditingField(null);
          setRentFocused(false);
          return next;
        }

        const parsed = parseRentMxnInput(rentInput);
        if (parsed == null) {
          return filters;
        }

        const next = { ...filters, budgetMin: null, budgetMax: parsed };
        onChange(next);
        setMobileEditingField(null);
        setRentFocused(false);
        setRentInput(formatRentCompact(parsed));
        return next;
      },
    }),
    [filters, mobileEditingField, onChange, rentFocused, rentInput],
  );

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
    <div className="relative z-[1200] w-full min-w-0 overflow-visible border-b border-primary/15 bg-secondary px-4 py-3 text-primary shadow-sm sm:px-6 lg:px-8">
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
                      <span aria-hidden="true" className="h-5 w-px justify-self-center bg-primary/15" />
                      <button
                        type="button"
                        aria-label="Aplicar renta máxima"
                        onClick={finishMobileEdit}
                        className={MOBILE_STEPPER_BTN_CLASS}
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
                  className={`flex ${MOBILE_FILTER_CONTROL_HEIGHT} w-full min-w-0 items-center gap-0.5 overflow-hidden rounded-[1rem] border border-primary/15 bg-bg-light/55 px-1 py-1`}
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
                  <span className="shrink-0 px-0.5 text-[0.82rem] font-semibold text-muted/70" aria-hidden>
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

            <div className={`min-w-0 ${MOBILE_FILTER_HEIGHT}`}>
              {onSaveClick ? (
                <MobileCombinedFilterBar
                  onOpenAdvanced={onOpenAdvanced}
                  onClearFilters={onClearFilters}
                  clearDisabled={!hasActiveFilters}
                  onSaveClick={onSaveClick}
                  pulseActive={pulseActive}
                  guestNudge={guestSaveNudge}
                />
              ) : (
                <FilterActionsGroup
                  mobile
                  onOpenAdvanced={onOpenAdvanced}
                  onClearFilters={onClearFilters}
                  clearDisabled={!hasActiveFilters}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="hidden w-full min-w-0 sm:flex sm:flex-wrap sm:items-end sm:gap-x-3 sm:gap-y-2 lg:gap-x-4">
        <div className="relative z-50 min-w-[12rem] flex-[2] basis-[14rem]">
          <label className={DESKTOP_LOCATION_LABEL_CLASS} htmlFor={locationInputId}>
            Ciudad o colonia
          </label>
          <div className={`${DESKTOP_FILTER_CONTROL_CLASS} relative`}>{renderLocationField(false)}</div>
        </div>

        <div className="flex shrink-0 flex-wrap items-end gap-2 lg:gap-3">
          <label className="block w-[7.5rem] shrink-0 sm:w-[8rem] lg:max-w-[9.5rem] lg:flex-1">
            <span className={DESKTOP_FILTER_LABEL_CLASS}>Renta</span>
            <div
              className={`${DESKTOP_FILTER_CONTROL_CLASS} flex items-stretch overflow-hidden rounded-lg border border-primary/20 bg-surface shadow-sm ring-primary/30 focus-within:ring-2`}
            >
              <button
                type="button"
                aria-label="Disminuir renta"
                onClick={() =>
                  onChange({ ...filters, budgetMin: null, budgetMax: stepRent(filters.budgetMax, -RENT_STEP) })
                }
                className="inline-flex w-7 shrink-0 items-center justify-center text-base font-semibold text-primary transition hover:bg-bg-light active:bg-surface-elevated"
              >
                −
              </button>
              <input
                inputMode="numeric"
                type="text"
                value={filters.budgetMax != null ? filters.budgetMax.toLocaleString("es-MX") : ""}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  onChange({
                    ...filters,
                    budgetMin: null,
                    budgetMax: digits === "" ? null : Number(digits),
                  });
                }}
                placeholder="Ej. 6,000"
                className="min-w-0 flex-1 bg-transparent px-1 text-center text-sm font-medium tabular-nums text-body outline-none"
              />
              <button
                type="button"
                aria-label="Aumentar renta"
                onClick={() =>
                  onChange({ ...filters, budgetMin: null, budgetMax: stepRent(filters.budgetMax, RENT_STEP) })
                }
                className="inline-flex w-7 shrink-0 items-center justify-center text-base font-semibold text-primary transition hover:bg-bg-light active:bg-surface-elevated"
              >
                +
              </button>
            </div>
          </label>

          <fieldset className="shrink-0">
            <legend className={DESKTOP_FILTER_LABEL_CLASS}>Género</legend>
            <div
              className={`${DESKTOP_FILTER_CONTROL_CLASS} flex w-[9.5rem] items-center gap-0.5 overflow-hidden rounded-lg border border-primary/20 bg-surface px-1 shadow-sm lg:w-[10rem]`}
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

          <label className="block w-[6rem] shrink-0 sm:w-[6.5rem]">
            <span className={DESKTOP_FILTER_LABEL_CLASS}>Edad</span>
            <div
              className={`${DESKTOP_FILTER_CONTROL_CLASS} flex items-stretch overflow-hidden rounded-lg border border-primary/20 bg-surface shadow-sm ring-primary/30 focus-within:ring-2`}
            >
              <button
                type="button"
                aria-label="Disminuir edad"
                onClick={() =>
                  onChange({ ...filters, age: stepAge(filters.age, -1), ageMin: null, ageMax: null })
                }
                className="inline-flex w-7 shrink-0 items-center justify-center text-base font-semibold text-primary transition hover:bg-bg-light active:bg-surface-elevated"
              >
                −
              </button>
              <input
                inputMode="numeric"
                type="text"
                value={filters.age != null ? String(filters.age) : ""}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 2);
                  onChange({
                    ...filters,
                    age: digits === "" ? null : Number(digits),
                    ageMin: null,
                    ageMax: null,
                  });
                }}
                placeholder="Ej. 27"
                className="min-w-0 flex-1 bg-transparent px-1 text-center text-sm font-medium tabular-nums text-body outline-none"
              />
              <button
                type="button"
                aria-label="Aumentar edad"
                onClick={() =>
                  onChange({ ...filters, age: stepAge(filters.age, 1), ageMin: null, ageMax: null })
                }
                className="inline-flex w-7 shrink-0 items-center justify-center text-base font-semibold text-primary transition hover:bg-bg-light active:bg-surface-elevated"
              >
                +
              </button>
            </div>
          </label>
        </div>

        <FilterActionsGroup
          onOpenAdvanced={onOpenAdvanced}
          onClearFilters={onClearFilters}
          clearDisabled={!hasActiveFilters}
        />

        {onSaveClick ? (
          <SaveSearchButton
            onSaveClick={onSaveClick}
            pulseActive={pulseActive}
            guestNudge={guestSaveNudge}
            className="ml-auto"
          />
        ) : null}
      </div>
    </div>
  );
});

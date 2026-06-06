import { useEffect, useId, useMemo, useState } from "react";
import type { SearchFilters } from "@/lib/searchFilters";
import type { PropertyListing } from "@/types/listing";

type Props = {
  filters: SearchFilters;
  listings: PropertyListing[];
  onChange: (next: SearchFilters) => void;
  onOpenAdvanced: () => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
};

const DEFAULT_MOBILE_AGE = 27;
const MIN_AGE = 16;
const MAX_AGE = 99;
const RENT_STEP = 100;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function uniqueLocationOptions(listings: PropertyListing[]): string[] {
  const cities = new Set<string>();
  const neighborhoods = new Set<string>();

  listings.forEach((listing) => {
    const city = listing.city.trim();
    const neighborhood = listing.neighborhood.trim();
    if (city) cities.add(city);
    if (neighborhood) neighborhoods.add(neighborhood);
  });

  return [...cities, ...neighborhoods].sort((a, b) => a.localeCompare(b, "es-MX"));
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
}: Props) {
  const locationListId = useId();
  const locationOptions = useMemo(() => uniqueLocationOptions(listings), [listings]);
  const maxVisibleRent = useMemo(() => highestVisibleRent(listings), [listings]);
  const displayedRent = filters.budgetMax ?? (maxVisibleRent > 0 ? maxVisibleRent : null);
  const displayedAge = filters.age ?? DEFAULT_MOBILE_AGE;
  const [rentFocused, setRentFocused] = useState(false);
  const [rentInput, setRentInput] = useState(
    displayedRent == null ? "" : formatRentCompact(displayedRent),
  );
  const [ageInput, setAgeInput] = useState(String(displayedAge));

  useEffect(() => {
    setRentInput(displayedRent == null ? "" : rentFocused ? String(displayedRent) : formatRentCompact(displayedRent));
  }, [displayedRent, rentFocused]);

  useEffect(() => {
    setAgeInput(String(displayedAge));
  }, [displayedAge]);

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
    const next = clamp(displayedAge + delta, MIN_AGE, MAX_AGE);
    setAge(next);
    setAgeInput(String(next));
  }

  function commitAge() {
    const trimmed = ageInput.trim();
    if (trimmed === "") {
      setAge(null);
      setAgeInput(String(DEFAULT_MOBILE_AGE));
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
            <div className="relative">
              <input
                id="mobile-search-location"
                type="search"
                list={locationListId}
                value={filters.q}
                onChange={(e) => onChange({ ...filters, q: e.target.value })}
                placeholder="Ciudad o colonia"
                className="h-14 w-full rounded-[1.2rem] border border-primary/15 bg-surface px-4 pr-12 text-[1.35rem] font-semibold tracking-[-0.02em] text-body shadow-sm outline-none ring-primary/30 focus:ring-2"
              />
              <span
                className="pointer-events-none absolute inset-y-0 right-4 inline-flex items-center text-primary/65"
                aria-hidden
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                  />
                  <path strokeWidth="2" strokeLinecap="round" d="M16.2 16.2 21 21" />
                </svg>
              </span>
            </div>
            <datalist id={locationListId}>
              {locationOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-[1.2rem] bg-surface p-2.5 shadow-sm ring-1 ring-primary/10">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/75">
                    Precio renta
                  </span>
                  <span className="text-[10px] font-medium text-primary/55">MXN/mes</span>
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

              <div className="rounded-[1.2rem] bg-surface p-2.5 shadow-sm ring-1 ring-primary/10">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/75">
                    Edad
                  </span>
                  <span
                    className={`text-[10px] font-medium ${
                      filters.age == null ? "text-muted opacity-60" : "text-primary/60"
                    }`}
                  >
                    {filters.age == null ? "Default" : "Activa"}
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
                      filters.age == null ? "text-muted opacity-60" : "text-body"
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
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[1.1rem] border border-primary/20 bg-surface px-3.5 text-[0.95rem] font-semibold text-primary shadow-sm transition hover:border-primary/35"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                  <path strokeWidth="2" strokeLinecap="round" d="M4 7h16M7 12h10M10 17h4" />
                </svg>
                Filtros avanzados
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
          <div className="mt-1 flex items-stretch gap-2">
            <input
              type="search"
              value={filters.q}
              onChange={(e) => onChange({ ...filters, q: e.target.value })}
              placeholder="Ciudad, colonia…"
              className="w-full min-w-0 rounded-lg border border-primary/20 bg-surface px-3 py-2.5 text-sm font-medium text-body shadow-sm outline-none ring-primary/30 focus:ring-2"
            />
            <span
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-surface px-3 text-primary/70"
              aria-hidden
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                />
                <path strokeWidth="2" strokeLinecap="round" d="M16.2 16.2 21 21" />
              </svg>
            </span>
          </div>
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

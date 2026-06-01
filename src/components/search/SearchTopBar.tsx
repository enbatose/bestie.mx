import type { SearchFilters } from "@/lib/searchFilters";

type Props = {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
};

export function SearchTopBar({ filters, onChange, onClearFilters, hasActiveFilters }: Props) {
  return (
    <div className="border-b border-primary/15 bg-secondary px-3 py-3 text-primary shadow-sm sm:px-4">
      <div className="mx-auto max-w-[1920px] space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end lg:gap-4">
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

        <label className="block min-w-0">
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
            className="mt-1 w-full rounded-lg border border-primary/20 bg-surface px-3 py-2.5 text-sm font-medium text-body shadow-sm outline-none ring-primary/30 focus:ring-2"
          />
        </label>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClearFilters}
            disabled={!hasActiveFilters}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-primary/25 bg-surface px-4 py-2 text-xs font-semibold text-primary shadow-sm transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
          >
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path strokeWidth="2" strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
            Borrar filtros
          </button>
        </div>
      </div>
    </div>
  );
}

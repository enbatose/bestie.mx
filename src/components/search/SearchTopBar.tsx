import type { RoommateGenderPref } from "@/types/listing";
import type { SearchFilters } from "@/lib/searchFilters";

type Props = {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  /** UI-only for now (Roomix-style); map moveend search can wire later. */
  searchOnMapMove: boolean;
  onSearchOnMapMoveChange: (v: boolean) => void;
};

export function SearchTopBar({
  filters,
  onChange,
  searchOnMapMove,
  onSearchOnMapMoveChange,
}: Props) {
  return (
    <div className="border-b border-primary/15 bg-secondary px-3 py-3 text-primary shadow-sm sm:px-4">
      <div className="mx-auto flex max-w-[1920px] flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
        <div className="min-w-0 flex-1 lg:max-w-xl">
          <label className="block text-xs font-semibold uppercase tracking-wide text-primary/80">
            Ubicación
          </label>
          <div className="mt-1 flex items-stretch gap-2">
            <input
              type="search"
              value={filters.q}
              onChange={(e) => onChange({ ...filters, q: e.target.value })}
              placeholder="Ciudad, colonia…"
              className="w-full min-w-0 rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm font-medium text-body shadow-sm outline-none ring-primary/30 focus:ring-2"
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
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-medium text-primary sm:text-sm">
            <input
              type="checkbox"
              checked={searchOnMapMove}
              onChange={(e) => onSearchOnMapMoveChange(e.target.checked)}
              className="size-4 rounded border-primary/40 text-primary focus:ring-primary"
            />
            Buscar al mover el mapa
            <span className="font-normal text-primary/70">(próximamente)</span>
          </label>
        </div>

        <fieldset className="min-w-0 flex-1 lg:max-w-md">
          <legend className="text-xs font-semibold uppercase tracking-wide text-primary/80">
            Presupuesto (MXN / mes)
          </legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <input
              inputMode="numeric"
              type="number"
              min={0}
              step={100}
              value={filters.budgetMin ?? ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  budgetMin: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              placeholder="Mín"
              className="w-full rounded-lg border border-primary/20 bg-surface px-2 py-2 text-sm font-medium text-body shadow-sm outline-none ring-primary/30 focus:ring-2"
            />
            <input
              inputMode="numeric"
              type="number"
              min={0}
              step={100}
              value={filters.budgetMax ?? ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  budgetMax: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              placeholder="Máx"
              className="w-full rounded-lg border border-primary/20 bg-surface px-2 py-2 text-sm font-medium text-body shadow-sm outline-none ring-primary/30 focus:ring-2"
            />
          </div>
        </fieldset>

        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:max-w-2xl lg:flex-1">
          <label className="block text-xs font-semibold uppercase tracking-wide text-primary/80 sm:col-span-1">
            Roomies (anuncio)
            <select
              value={filters.pref ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                const pref: RoommateGenderPref | null =
                  v === "female" || v === "male" ? v : null;
                onChange({ ...filters, pref });
              }}
              className="mt-1 w-full rounded-lg border border-primary/20 bg-surface px-2 py-2 text-sm font-medium text-body shadow-sm outline-none ring-primary/30 focus:ring-2"
            >
              <option value="">Cualquiera</option>
              <option value="female">Pref. mujer</option>
              <option value="male">Pref. hombre</option>
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-primary/80">
            Edad mín.
            <input
              inputMode="numeric"
              type="number"
              min={16}
              max={99}
              value={filters.ageMin ?? ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  ageMin: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="mt-1 w-full rounded-lg border border-primary/20 bg-surface px-2 py-2 text-sm font-medium text-body shadow-sm outline-none ring-primary/30 focus:ring-2"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-primary/80">
            Edad máx.
            <input
              inputMode="numeric"
              type="number"
              min={16}
              max={99}
              value={filters.ageMax ?? ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  ageMax: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="mt-1 w-full rounded-lg border border-primary/20 bg-surface px-2 py-2 text-sm font-medium text-body shadow-sm outline-none ring-primary/30 focus:ring-2"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

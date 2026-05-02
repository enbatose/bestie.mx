import type { LodgingType } from "@/types/listing";
import type { SearchFilters } from "@/lib/searchFilters";

type Props = {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
};

const LODGING_OPTIONS: { value: LodgingType | ""; label: string }[] = [
  { value: "", label: "Cualquiera" },
  { value: "whole_home", label: "Hogar entero" },
  { value: "private_room", label: "Cuarto privado" },
  { value: "shared_room", label: "Cuarto compartido" },
];

export function SearchTopBar({ filters, onChange }: Props) {
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

        <fieldset className="min-w-0 flex-1 lg:max-w-xl">
          <legend className="text-xs font-semibold uppercase tracking-wide text-primary/80">
            Tipo de hospedaje
          </legend>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {LODGING_OPTIONS.map(({ value, label }) => {
              const selected =
                value === "" ? filters.lodgingType == null : filters.lodgingType === value;
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    onChange({
                      ...filters,
                      lodgingType: value === "" ? null : (value as LodgingType),
                    })
                  }
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold shadow-sm transition sm:text-sm ${
                    selected
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

        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:max-w-md lg:flex-none">
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

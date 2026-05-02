import type { ListingTag, RoommateGenderPref } from "@/types/listing";
import { TAG_CHIP_ORDER } from "@/lib/listingTags";
import type { SearchFilters } from "@/lib/searchFilters";
import { TAG_LABELS } from "@/lib/searchFilters";

type Props = {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
};

export function SearchFilterPanel({ filters, onChange }: Props) {
  function toggleTag(tag: ListingTag) {
    const has = filters.tags.includes(tag);
    const tags = has ? filters.tags.filter((t) => t !== tag) : [...filters.tags, tag];
    onChange({ ...filters, tags });
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-body sm:text-xl">Buscar cuarto</h1>
          <p className="mt-1 text-sm text-muted">
            Filtros v1: ubicación, presupuesto, etiquetas, preferencia y edad.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-body">
          Ubicación (texto libre)
          <input
            type="search"
            value={filters.q}
            onChange={(e) => onChange({ ...filters, q: e.target.value })}
            placeholder="Ej. Chapalita, Sayulita, García Ginerés…"
            className="mt-1 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
          />
        </label>

        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium text-body">Presupuesto (MXN / mes)</legend>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:max-w-md">
            <label className="text-xs text-muted">
              Mínimo
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
                placeholder="4000"
                className="mt-1 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
              />
            </label>
            <label className="text-xs text-muted">
              Máximo
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
                placeholder="8000"
                className="mt-1 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium text-body">Etiquetas</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {TAG_CHIP_ORDER.map((tag) => {
              const on = filters.tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                    on
                      ? "border-secondary bg-surface-elevated text-primary ring-2 ring-secondary/30"
                      : "border-border bg-bg-light text-body hover:border-secondary"
                  }`}
                >
                  {TAG_LABELS[tag]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="block text-sm font-medium text-body">
          Preferencia de roomies (anuncio)
          <select
            value={filters.pref ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              const pref: RoommateGenderPref | null =
                v === "female" || v === "male" ? v : null;
              onChange({ ...filters, pref });
            }}
            className="mt-1 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
          >
            <option value="">Cualquiera / sin filtro</option>
            <option value="female">Prefieren roomie mujer</option>
            <option value="male">Prefieren roomie hombre</option>
          </select>
          <span className="mt-1 block text-xs text-muted">
            Muestra anuncios que aceptan cualquier género o coinciden con tu selección.
          </span>
        </label>

        <fieldset>
          <legend className="text-sm font-medium text-body">Tu edad (solape con rango del anuncio)</legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <label className="text-xs text-muted">
              Mínima
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
                className="mt-1 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
              />
            </label>
            <label className="text-xs text-muted">
              Máxima
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
                className="mt-1 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
              />
            </label>
          </div>
        </fieldset>
      </div>
    </section>
  );
}

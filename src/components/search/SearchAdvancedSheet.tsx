import { useEffect, useId, useRef } from "react";
import { ADVANCED_TAG_FILTERS } from "@/components/search/searchQuickAttributes";
import { TAG_LABELS } from "@/lib/searchFilters";
import type { RoomDimension } from "@/types/listing";
import type { ListingTag } from "@/types/listing";
import type { SearchFilters } from "@/lib/searchFilters";

type Props = {
  open: boolean;
  onClose: () => void;
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
};

/** Today's date in `America/Mexico_City` as `YYYY-MM-DD` for `<input type="date">`. */
function isoDateTodayMexicoCity(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (y && m && day) return `${y}-${m}-${day}`;
  return date.toISOString().slice(0, 10);
}

function TriBool({
  value,
  onChange,
  yesLabel,
  noLabel,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  yesLabel: string;
  noLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {(
        [
          { v: true as const, label: yesLabel },
          { v: false as const, label: noLabel },
        ] as const
      ).map(({ v, label }) => {
        const active = value === v;
        return (
          <button
            key={String(v)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? null : v)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition sm:text-sm ${
              active
                ? "border-secondary bg-surface ring-2 ring-secondary/35"
                : "border-border bg-surface/90 text-body hover:border-secondary/50"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function SearchAdvancedSheet({ open, onClose, filters, onChange }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const todayIso = isoDateTodayMexicoCity();

  function toggleTag(tag: ListingTag) {
    const tags = filters.tags.includes(tag)
      ? filters.tags.filter((current) => current !== tag)
      : [...filters.tags, tag];
    onChange({ ...filters, tags });
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>("button, [href], input, select")?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (filters.availableFrom && filters.availableFrom < todayIso) {
      onChange({ ...filters, availableFrom: null });
    }
  }, [open, filters, onChange, todayIso]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-surface shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <h2 id={titleId} className="text-base font-semibold text-body sm:text-lg">
            Filtros avanzados
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-bg-light px-3 py-1.5 text-sm font-medium text-body hover:border-secondary/50"
          >
            Cerrar
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-body">
              Presupuesto máx (MXN / mes)
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
                className="mt-1 w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm text-body shadow-sm outline-none ring-primary/30 focus:ring-2"
              />
            </label>

            <label className="block text-sm font-medium text-body">
              Tu edad
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
                placeholder="Ej. 25"
                className="mt-1 w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm text-body shadow-sm outline-none ring-primary/30 focus:ring-2"
              />
            </label>
          </div>

          <div>
            <p className="text-sm font-medium text-body">Tipo de hospedaje</p>
            <div className="mt-2 flex flex-wrap gap-2">
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
                        ? "border-secondary bg-surface ring-2 ring-secondary/35"
                        : "border-border bg-surface/90 text-body hover:border-secondary/50"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-body">Tipo de propiedad</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  {
                    key: "house" as const,
                    label: "Casa",
                    active: filters.wantHouse,
                    next: { ...filters, wantHouse: !filters.wantHouse },
                  },
                  {
                    key: "apartment" as const,
                    label: "Depa",
                    active: filters.wantApartment,
                    next: { ...filters, wantApartment: !filters.wantApartment },
                  },
                  {
                    key: "loft" as const,
                    label: "Loft",
                    active: filters.wantLoft,
                    next: { ...filters, wantLoft: !filters.wantLoft },
                  },
                ] as const
              ).map(({ key, label, active, next }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange(next)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition sm:text-sm ${
                    active
                      ? "border-secondary bg-surface ring-2 ring-secondary/35"
                      : "border-border bg-surface/90 text-body hover:border-secondary/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-body">Tipo de habitación</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  { v: "private_room" as const, label: "Privada" },
                  { v: "shared_room" as const, label: "Compartida" },
                ] as const
              ).map(({ v, label }) => {
                const active = filters.lodgingType === v;
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      onChange({ ...filters, lodgingType: active ? null : v })
                    }
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition sm:text-sm ${
                      active
                        ? "border-secondary bg-surface ring-2 ring-secondary/35"
                        : "border-border bg-surface/90 text-body hover:border-secondary/50"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-body">Convivencia (anuncio)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  { v: "female" as const, label: "Sólo chicas" },
                  { v: "male" as const, label: "Sólo chicos" },
                ] as const
              ).map(({ v, label }) => {
                const active = filters.pref === v;
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChange({ ...filters, pref: active ? null : v })}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition sm:text-sm ${
                      active
                        ? "border-secondary bg-surface ring-2 ring-secondary/35"
                        : "border-border bg-surface/90 text-body hover:border-secondary/50"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-body">Detalles del anuncio</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ADVANCED_TAG_FILTERS.map((tag) => {
                const active = filters.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleTag(tag)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition sm:text-sm ${
                      active
                        ? "border-secondary bg-surface ring-2 ring-secondary/35"
                        : "border-border bg-surface/90 text-body hover:border-secondary/50"
                    }`}
                  >
                    {TAG_LABELS[tag]}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block text-sm font-medium text-body">
            Disponible desde
            <input
              type="date"
              min={todayIso}
              value={
                filters.availableFrom && filters.availableFrom >= todayIso
                  ? filters.availableFrom
                  : ""
              }
              onChange={(e) => {
                const next = e.target.value;
                if (next === "") {
                  onChange({ ...filters, availableFrom: null });
                  return;
                }
                if (next < todayIso) return;
                onChange({ ...filters, availableFrom: next });
              }}
              className="mt-1 w-full max-w-xs rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm text-body shadow-sm outline-none ring-primary/30 focus:ring-2"
            />
          </label>

          <label className="block text-sm font-medium text-body">
            Mi estancia mínima (meses)
            <input
              inputMode="numeric"
              type="number"
              min={0}
              step={1}
              value={filters.minimalStayMonths ?? ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  minimalStayMonths: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              placeholder="Ej. 3"
              className="mt-1 w-full max-w-xs rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm text-body shadow-sm outline-none ring-primary/30 focus:ring-2"
            />
          </label>

          <label className="block text-sm font-medium text-body">
            Tamaño del cuarto
            <select
              value={filters.roomDimension ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                const roomDimension: RoomDimension | null =
                  v === "small" || v === "medium" || v === "large" ? v : null;
                onChange({ ...filters, roomDimension });
              }}
              className="mt-1 w-full max-w-xs rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm text-body shadow-sm outline-none ring-primary/30 focus:ring-2"
            >
              <option value="">Sin filtro</option>
              <option value="small">Pequeño</option>
              <option value="medium">Mediano</option>
              <option value="large">Grande</option>
            </select>
          </label>

          <div>
            <p className="text-sm font-medium text-body">Se requiere aval</p>
            <div className="mt-2">
              <TriBool
                value={filters.avalRequired}
                onChange={(avalRequired) => onChange({ ...filters, avalRequired })}
                yesLabel="Sí"
                noLabel="No"
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-body">Se permite subarrendar</p>
            <div className="mt-2">
              <TriBool
                value={filters.subletAllowed}
                onChange={(subletAllowed) => onChange({ ...filters, subletAllowed })}
                yesLabel="Sí"
                noLabel="No"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-border px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-secondary py-2.5 text-sm font-semibold text-primary shadow-sm hover:opacity-95"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

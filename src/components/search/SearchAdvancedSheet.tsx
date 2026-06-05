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
          { v: null as const, label: "Cualquiera" },
          { v: true as const, label: yesLabel },
          { v: false as const, label: noLabel },
        ] as const
      ).map(({ v, label }) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition sm:text-sm ${
            value === v
              ? "border-secondary bg-surface ring-2 ring-secondary/35"
              : "border-border bg-surface/90 text-body hover:border-secondary/50"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function SearchAdvancedSheet({ open, onClose, filters, onChange }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

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
          <div>
            <p className="text-sm font-medium text-body">Tipo de propiedad</p>
            <p className="mt-0.5 text-xs text-muted">
              Mueve aquí los filtros rápidos adicionales de casa, depa o loft.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  {
                    key: "clear" as const,
                    label: "Cualquiera",
                    active: !filters.wantHouse && !filters.wantApartment && !filters.wantLoft,
                    next: { ...filters, wantHouse: false, wantApartment: false, wantLoft: false },
                  },
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
            <p className="mt-0.5 text-xs text-muted">
              El acceso rápido del mapa deja fija la opción privada; aquí puedes elegir compartida.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  { v: null as const, label: "Cualquiera" },
                  { v: "private_room" as const, label: "Privada" },
                  { v: "shared_room" as const, label: "Compartida" },
                ] as const
              ).map(({ v, label }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onChange({ ...filters, lodgingType: v })}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition sm:text-sm ${
                    filters.lodgingType === v
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
            <p className="text-sm font-medium text-body">Convivencia (anuncio)</p>
            <p className="mt-0.5 text-xs text-muted">
              Filtra por la preferencia de convivencia del anuncio (por ejemplo sólo chicas o sólo chicos).
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  { v: null as const, label: "Cualquiera" },
                  { v: "female" as const, label: "Sólo chicas" },
                  { v: "male" as const, label: "Sólo chicos" },
                ] as const
              ).map(({ v, label }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onChange({ ...filters, pref: v })}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition sm:text-sm ${
                    filters.pref === v
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
            <p className="text-sm font-medium text-body">Detalles del anuncio</p>
            <p className="mt-0.5 text-xs text-muted">
              Los demás quick filters del mapa viven aquí para no saturar la interfaz principal.
            </p>
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
              value={filters.availableFrom ?? ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  availableFrom: e.target.value === "" ? null : e.target.value,
                })
              }
              className="mt-1 w-full max-w-xs rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm text-body shadow-sm outline-none ring-primary/30 focus:ring-2"
            />
            <span className="mt-1 block text-xs text-muted">
              Muestra anuncios disponibles en o antes de esta fecha (si el anuncio lo indica).
            </span>
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
            <span className="mt-1 block text-xs text-muted">
              Solo anuncios cuyo requisito de estancia mínima no supere lo que puedes comprometer.
            </span>
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
              <option value="">Cualquiera</option>
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

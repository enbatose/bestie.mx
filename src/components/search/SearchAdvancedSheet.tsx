import { useEffect, useId, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import { Banknote, Building2, CalendarClock, DoorClosed, Home, House, Users, Warehouse } from "lucide-react";
import {
  ADVANCED_TAG_FILTERS,
  ADVANCED_TAG_META,
  RECAMARA_META,
} from "@/components/search/searchQuickAttributes";
import { PlusOneIcon } from "@/components/icons/PlusOneIcon";
import { HighHeelIcon, MustacheIcon } from "@/components/icons/GenderFilterIcons";
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

type TabId = "presupuesto" | "propiedad" | "convivencia" | "condiciones";

const BUDGET_STEP = 100;
const BUDGET_DEFAULT_START = 6000;
const AGE_MIN = 16;
const AGE_MAX = 99;
const AGE_DEFAULT_START = 27;

function stepAge(current: number | null, delta: number): number {
  if (current == null) return AGE_DEFAULT_START;
  return Math.min(AGE_MAX, Math.max(AGE_MIN, current + delta));
}

function stepBudget(current: number | null, delta: number): number {
  if (current == null) return BUDGET_DEFAULT_START;
  return Math.max(0, current + delta);
}

/** Accepts both lucide's forwardRef icons and the app's plain-function tinted-PNG icon components. */
type FilterIcon = ComponentType<LucideProps>;

const TABS: readonly { id: TabId; label: string; icon: FilterIcon }[] = [
  { id: "presupuesto", label: "Presupuesto", icon: Banknote },
  { id: "propiedad", label: "Propiedad", icon: Home },
  { id: "convivencia", label: "Convivencia", icon: Users },
  { id: "condiciones", label: "Condiciones", icon: CalendarClock },
];

function tabHasActiveFilters(tabId: TabId, f: SearchFilters): boolean {
  switch (tabId) {
    case "presupuesto":
      return f.budgetMax != null || f.age != null;
    case "propiedad":
      return f.wantHouse || f.wantApartment || f.wantLoft || f.wantRecamara || f.lodgingType != null;
    case "convivencia":
      return f.pref != null || f.tags.length > 0;
    case "condiciones":
      return (
        f.availableFrom != null ||
        f.minimalStayMonths != null ||
        f.roomDimension != null ||
        f.avalRequired != null ||
        f.subletAllowed != null
      );
    default:
      return false;
  }
}

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

/** Toggle chip with an icon so the option is self-explanatory without extra helper copy. */
function IconOption({
  icon: Icon,
  label,
  active,
  onClick,
  tooltip,
}: {
  icon?: FilterIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  tooltip?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={tooltip}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition sm:text-sm ${
        active
          ? "border-secondary bg-surface text-primary ring-2 ring-secondary/35"
          : "border-border bg-surface/90 text-body hover:border-secondary/50"
      }`}
    >
      {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
      {label}
    </button>
  );
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
    <>
      {(
        [
          { v: true as const, label: yesLabel },
          { v: false as const, label: noLabel },
        ] as const
      ).map(({ v, label }) => {
        const active = value === v;
        return (
          <IconOption
            key={String(v)}
            label={label}
            active={active}
            onClick={() => onChange(active ? null : v)}
          />
        );
      })}
    </>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium text-body">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function SearchAdvancedSheet({ open, onClose, filters, onChange }: Props) {
  const titleId = useId();
  const budgetMaxInputId = useId();
  const ageInputId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const todayIso = isoDateTodayMexicoCity();
  const [activeTab, setActiveTab] = useState<TabId>("presupuesto");

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

  useEffect(() => {
    if (open) setActiveTab("presupuesto");
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
        className="flex max-h-[min(88dvh,640px)] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-surface shadow-2xl sm:rounded-2xl"
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

        <div className="flex gap-1 border-b border-border bg-bg-light px-2 py-2 sm:px-4" role="tablist">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            const hasFilters = tabHasActiveFilters(tab.id, filters);
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={tab.label}
                title={tab.label}
                onClick={() => setActiveTab(tab.id)}
                className={`relative inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-1.5 py-2 text-xs font-semibold transition sm:text-sm ${
                  active ? "bg-primary text-primary-fg shadow-sm" : "text-body hover:bg-surface-elevated"
                }`}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="hidden truncate sm:inline">{tab.label}</span>
                {hasFilters ? (
                  <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-secondary" />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {activeTab === "presupuesto" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={budgetMaxInputId} className="block text-sm font-medium text-body">
                  Presupuesto máx (MXN / mes)
                </label>
                <div className="mt-1 flex items-stretch overflow-hidden rounded-lg border border-primary/20 bg-surface shadow-sm ring-primary/30 focus-within:ring-2">
                  <button
                    type="button"
                    aria-label="Disminuir presupuesto máximo"
                    onClick={() =>
                      onChange({
                        ...filters,
                        budgetMin: null,
                        budgetMax: stepBudget(filters.budgetMax, -BUDGET_STEP),
                      })
                    }
                    className="inline-flex w-10 shrink-0 items-center justify-center text-lg font-semibold text-primary transition hover:bg-bg-light active:bg-surface-elevated"
                  >
                    −
                  </button>
                  <input
                    id={budgetMaxInputId}
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
                    className="min-w-0 flex-1 bg-transparent px-2 py-2 text-center text-sm tabular-nums text-body outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Aumentar presupuesto máximo"
                    onClick={() =>
                      onChange({
                        ...filters,
                        budgetMin: null,
                        budgetMax: stepBudget(filters.budgetMax, BUDGET_STEP),
                      })
                    }
                    className="inline-flex w-10 shrink-0 items-center justify-center text-lg font-semibold text-primary transition hover:bg-bg-light active:bg-surface-elevated"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor={ageInputId} className="block text-sm font-medium text-body">
                  Tu edad
                </label>
                <div className="mt-1 flex items-stretch overflow-hidden rounded-lg border border-primary/20 bg-surface shadow-sm ring-primary/30 focus-within:ring-2">
                  <button
                    type="button"
                    aria-label="Disminuir edad"
                    onClick={() =>
                      onChange({ ...filters, age: stepAge(filters.age, -1), ageMin: null, ageMax: null })
                    }
                    className="inline-flex w-10 shrink-0 items-center justify-center text-lg font-semibold text-primary transition hover:bg-bg-light active:bg-surface-elevated"
                  >
                    −
                  </button>
                  <input
                    id={ageInputId}
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
                    className="min-w-0 flex-1 bg-transparent px-2 py-2 text-center text-sm tabular-nums text-body outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Aumentar edad"
                    onClick={() =>
                      onChange({ ...filters, age: stepAge(filters.age, 1), ageMin: null, ageMax: null })
                    }
                    className="inline-flex w-10 shrink-0 items-center justify-center text-lg font-semibold text-primary transition hover:bg-bg-light active:bg-surface-elevated"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "propiedad" ? (
            <>
              <FilterGroup title="Tipo de propiedad">
                <IconOption
                  icon={House}
                  label="Casa"
                  active={filters.wantHouse}
                  onClick={() => onChange({ ...filters, wantHouse: !filters.wantHouse })}
                />
                <IconOption
                  icon={Building2}
                  label="Depa"
                  tooltip="Departamento"
                  active={filters.wantApartment}
                  onClick={() => onChange({ ...filters, wantApartment: !filters.wantApartment })}
                />
                <IconOption
                  icon={Warehouse}
                  label="Loft"
                  active={filters.wantLoft}
                  onClick={() => onChange({ ...filters, wantLoft: !filters.wantLoft })}
                />
                <IconOption
                  icon={RECAMARA_META.icon}
                  label={RECAMARA_META.label}
                  tooltip={RECAMARA_META.tooltip}
                  active={filters.wantRecamara}
                  onClick={() => onChange({ ...filters, wantRecamara: !filters.wantRecamara })}
                />
              </FilterGroup>

              <FilterGroup title="Tipo de habitación">
                <IconOption
                  icon={DoorClosed}
                  label="Privada"
                  active={filters.lodgingType === "private_room"}
                  onClick={() =>
                    onChange({
                      ...filters,
                      lodgingType: filters.lodgingType === "private_room" ? null : "private_room",
                    })
                  }
                />
                <IconOption
                  icon={PlusOneIcon}
                  label="Compartida"
                  active={filters.lodgingType === "shared_room"}
                  onClick={() =>
                    onChange({
                      ...filters,
                      lodgingType: filters.lodgingType === "shared_room" ? null : "shared_room",
                    })
                  }
                />
              </FilterGroup>
            </>
          ) : null}

          {activeTab === "convivencia" ? (
            <>
              <FilterGroup title="Convivencia (anuncio)">
                <IconOption
                  icon={HighHeelIcon}
                  label="Sólo chicas"
                  active={filters.pref === "female"}
                  onClick={() => onChange({ ...filters, pref: filters.pref === "female" ? null : "female" })}
                />
                <IconOption
                  icon={MustacheIcon}
                  label="Sólo chicos"
                  active={filters.pref === "male"}
                  onClick={() => onChange({ ...filters, pref: filters.pref === "male" ? null : "male" })}
                />
              </FilterGroup>

              <FilterGroup title="Detalles del anuncio">
                {ADVANCED_TAG_FILTERS.map((tag) => {
                  const active = filters.tags.includes(tag);
                  const meta = ADVANCED_TAG_META[tag];
                  return (
                    <IconOption
                      key={tag}
                      icon={tag === "lgbt-friendly" ? undefined : meta?.icon}
                      label={TAG_LABELS[tag]}
                      tooltip={meta?.tooltip}
                      active={active}
                      onClick={() => toggleTag(tag)}
                    />
                  );
                })}
              </FilterGroup>
            </>
          ) : null}

          {activeTab === "condiciones" ? (
            <>
              <label className="block text-sm font-medium text-body">
                Disponible desde
                <input
                  type="date"
                  min={todayIso}
                  value={filters.availableFrom && filters.availableFrom >= todayIso ? filters.availableFrom : ""}
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

              <FilterGroup title="Se requiere aval">
                <TriBool
                  value={filters.avalRequired}
                  onChange={(avalRequired) => onChange({ ...filters, avalRequired })}
                  yesLabel="Sí"
                  noLabel="No"
                />
              </FilterGroup>

              <FilterGroup title="Se permite subarrendar">
                <TriBool
                  value={filters.subletAllowed}
                  onChange={(subletAllowed) => onChange({ ...filters, subletAllowed })}
                  yesLabel="Sí"
                  noLabel="No"
                />
              </FilterGroup>
            </>
          ) : null}
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

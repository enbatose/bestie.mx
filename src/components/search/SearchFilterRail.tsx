import type { ListingTag, RoommateGenderPref } from "@/types/listing";
import type { SearchFilters } from "@/lib/searchFilters";
import { TAG_LABELS } from "@/lib/searchFilters";

/** Roomix-style order: amueblado, mascotas, fumar, estacionamiento, fiestas, baño, Wi‑Fi. */
const RAIL_TAG_ORDER: ListingTag[] = [
  "muebles",
  "mascotas",
  "fumar",
  "estacionamiento",
  "fiestas",
  "baño-privado",
  "wifi",
];

type Props = {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  onOpenAdvanced: () => void;
};

function TagIcon({ tag, className }: { tag: ListingTag; className?: string }) {
  const cn = className ?? "size-[1.15rem]";
  switch (tag) {
    case "wifi":
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <path
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 9.5a10 10 0 0 1 14 0M8.5 12.5a5.5 5.5 0 0 1 7 0M12 18a1 1 0 1 1 0-0.01"
          />
        </svg>
      );
    case "muebles":
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <path
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 11V9a2 2 0 0 1 2-2h2M4 11v8h16v-8M4 11h16m0 0V9a2 2 0 0 0-2-2h-2m-4 0V5M10 7h4"
          />
        </svg>
      );
    case "mascotas":
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <ellipse cx="8.5" cy="16" rx="2.5" ry="3.5" strokeWidth="2" />
          <ellipse cx="15.5" cy="16" rx="2.5" ry="3.5" strokeWidth="2" />
          <path
            strokeWidth="2"
            strokeLinecap="round"
            d="M6.5 12c-1-3 1.5-5.5 5.5-5.5S18.5 9 17.5 12"
          />
          <path strokeWidth="2" strokeLinecap="round" d="M9 7.5 7 4M15 7.5 17 4" />
        </svg>
      );
    case "fumar":
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <path strokeWidth="2" strokeLinecap="round" d="M18 8c-2 2-1 4 0 6s1 4-1 6" />
          <path strokeWidth="2" strokeLinecap="round" d="M14 6c-1.5 2-.5 3.5 0 5s1.5 3.5 0 5" />
          <rect x="4" y="14" width="8" height="3" rx="1" strokeWidth="2" />
        </svg>
      );
    case "estacionamiento":
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="2" />
          <path strokeWidth="2" strokeLinecap="round" d="M10 8v8M10 8h2.5a2.5 2.5 0 0 1 0 5H10" />
        </svg>
      );
    case "fiestas":
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <path strokeWidth="2" strokeLinecap="round" d="M8 10V8l4-3 2 3 4-2v12H8V10Z" />
          <path strokeWidth="2" strokeLinecap="round" d="M6 20h12" />
        </svg>
      );
    case "baño-privado":
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <path
            strokeWidth="2"
            strokeLinecap="round"
            d="M8 21V5a2 2 0 0 1 2-2h1M8 21H6M8 21h2m6 0V10m0 11h2m-2 0h-2m2 0H6"
          />
          <path strokeWidth="2" strokeLinecap="round" d="M14 10V8l2-2 2 2v2" />
        </svg>
      );
    default:
      return null;
  }
}

function HouseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 10 12 3l8 7v10a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1V10Z"
      />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth="2" d="M4 21h16M6 21V8l6-4 6 4v13M9 21v-4h2v4m4 0v-3h2v3" />
      <path strokeWidth="2" strokeLinecap="round" d="M10 12h1M13 12h1M10 15h1M13 15h1" />
    </svg>
  );
}

function SlidersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeWidth="2"
        strokeLinecap="round"
        d="M4 6h16M8 12h8M10 18h4M6 4v4m4 4v4m4 4v2"
      />
    </svg>
  );
}

/**
 * Mobile: horizontal chip strip above the map.
 * Desktop: floating column on the **left margin of the map** (Roomix-style).
 */
export function SearchFilterRail({ filters, onChange, onOpenAdvanced }: Props) {
  function toggleTag(tag: ListingTag) {
    const has = filters.tags.includes(tag);
    const tags = has ? filters.tags.filter((t) => t !== tag) : [...filters.tags, tag];
    onChange({ ...filters, tags });
  }

  function cyclePref(target: RoommateGenderPref) {
    onChange({ ...filters, pref: filters.pref === target ? null : target });
  }

  return (
    <aside
      className="flex w-full shrink-0 gap-2 overflow-x-auto border-b border-border bg-surface/95 px-2 py-2 backdrop-blur sm:px-3 lg:pointer-events-none lg:absolute lg:inset-y-8 lg:left-3 lg:z-[1100] lg:w-[3.25rem] lg:flex-col lg:items-center lg:gap-1.5 lg:overflow-y-auto lg:overflow-x-visible lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-0"
      aria-label="Filtros rápidos"
    >
      <p className="hidden w-full select-none text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-primary/80 lg:block">
        Tipo
      </p>
      <button
        type="button"
        title="Casa"
        aria-pressed={filters.wantHouse}
        aria-label="Casa"
        onClick={() => onChange({ ...filters, wantHouse: !filters.wantHouse })}
        className={`pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-lg border text-primary shadow-md transition sm:size-12 lg:size-11 ${
          filters.wantHouse
            ? "border-secondary bg-surface ring-2 ring-secondary/40"
            : "border-border bg-surface/95 hover:border-secondary/60"
        }`}
      >
        <HouseIcon className="size-[1.25rem]" />
      </button>
      <button
        type="button"
        title="Departamento"
        aria-pressed={filters.wantApartment}
        aria-label="Departamento"
        onClick={() => onChange({ ...filters, wantApartment: !filters.wantApartment })}
        className={`pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-lg border text-primary shadow-md transition sm:size-12 lg:size-11 ${
          filters.wantApartment
            ? "border-secondary bg-surface ring-2 ring-secondary/40"
            : "border-border bg-surface/95 hover:border-secondary/60"
        }`}
      >
        <BuildingIcon className="size-[1.25rem]" />
      </button>

      <p className="mt-1 hidden w-full select-none text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-primary/80 lg:block">
        Roomie
      </p>
      <button
        type="button"
        title="Sólo chicas (prefieren roomie mujer)"
        aria-pressed={filters.pref === "female"}
        aria-label="Sólo chicas"
        onClick={() => cyclePref("female")}
        className={`pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-lg border text-primary shadow-md transition sm:size-12 lg:size-11 ${
          filters.pref === "female"
            ? "border-secondary bg-surface ring-2 ring-secondary/40"
            : "border-border bg-surface/95 hover:border-secondary/60"
        }`}
      >
        <svg className="size-[1.1rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <circle cx="12" cy="8" r="4" strokeWidth="2" />
          <path strokeWidth="2" strokeLinecap="round" d="M12 12v6m-3-3h6" />
        </svg>
      </button>
      <button
        type="button"
        title="Sólo chicos (prefieren roomie hombre)"
        aria-pressed={filters.pref === "male"}
        aria-label="Sólo chicos"
        onClick={() => cyclePref("male")}
        className={`pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-lg border text-primary shadow-md transition sm:size-12 lg:size-11 ${
          filters.pref === "male"
            ? "border-secondary bg-surface ring-2 ring-secondary/40"
            : "border-border bg-surface/95 hover:border-secondary/60"
        }`}
      >
        <svg className="size-[1.1rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <circle cx="10" cy="14" r="4" strokeWidth="2" />
          <path strokeWidth="2" strokeLinecap="round" d="m14 10 6-6m-4 0h4v4" />
        </svg>
      </button>

      <p className="mt-1 hidden w-full select-none text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-primary/80 lg:block">
        Detalle
      </p>
      {RAIL_TAG_ORDER.map((tag) => {
        const on = filters.tags.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            title={TAG_LABELS[tag]}
            aria-label={TAG_LABELS[tag]}
            aria-pressed={on}
            onClick={() => toggleTag(tag)}
            className={`pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-lg border text-primary shadow-md transition sm:size-12 lg:size-11 ${
              on
                ? "border-secondary bg-surface ring-2 ring-secondary/40"
                : "border-border bg-surface/95 hover:border-secondary/60"
            }`}
          >
            <TagIcon tag={tag} />
          </button>
        );
      })}

      <button
        type="button"
        title="Filtros avanzados"
        aria-label="Filtros avanzados"
        onClick={onOpenAdvanced}
        className="pointer-events-auto mt-1 flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface/95 text-primary shadow-md transition hover:border-secondary/60 sm:size-12 lg:size-11"
      >
        <SlidersIcon className="size-[1.15rem]" />
      </button>
    </aside>
  );
}

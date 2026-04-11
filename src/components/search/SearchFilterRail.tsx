import type { ListingTag } from "@/types/listing";
import type { SearchFilters } from "@/lib/searchFilters";
import { TAG_LABELS } from "@/lib/searchFilters";

const ALL_TAGS = Object.keys(TAG_LABELS) as ListingTag[];

const TAG_ICONS: Record<ListingTag, string> = {
  wifi: "📶",
  mascotas: "🐾",
  estacionamiento: "🅿️",
  muebles: "🛋️",
  "baño-privado": "🚿",
};

type Props = {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
};

/**
 * Mobile: horizontal chip strip above the map.
 * Desktop: floating column on the **left margin of the map** (Roomix-style).
 */
export function SearchFilterRail({ filters, onChange }: Props) {
  function toggleTag(tag: ListingTag) {
    const has = filters.tags.includes(tag);
    const tags = has ? filters.tags.filter((t) => t !== tag) : [...filters.tags, tag];
    onChange({ ...filters, tags });
  }

  return (
    <aside
      className="flex w-full shrink-0 gap-2 overflow-x-auto border-b border-border bg-surface/95 px-2 py-2 backdrop-blur sm:px-3 lg:pointer-events-none lg:absolute lg:inset-y-8 lg:left-3 lg:z-[1100] lg:w-14 lg:flex-col lg:items-center lg:gap-2 lg:overflow-y-auto lg:overflow-x-visible lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-0"
      aria-label="Filtros rápidos"
    >
      <p className="hidden w-full select-none text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-primary/80 lg:block">
        Filtros
      </p>
      {ALL_TAGS.map((tag) => {
        const on = filters.tags.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            title={TAG_LABELS[tag]}
            aria-label={TAG_LABELS[tag]}
            aria-pressed={on}
            onClick={() => toggleTag(tag)}
            className={`pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-lg border text-lg shadow-md transition sm:size-12 lg:size-11 ${
              on
                ? "border-secondary bg-surface ring-2 ring-secondary/40"
                : "border-border bg-surface/95 hover:border-secondary/60"
            }`}
          >
            <span aria-hidden>{TAG_ICONS[tag]}</span>
          </button>
        );
      })}
      <p className="hidden w-full select-none px-0.5 pb-1 text-center text-[9px] font-medium leading-tight text-primary/70 lg:block">
        Avanzados
      </p>
    </aside>
  );
}

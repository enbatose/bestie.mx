import { useEffect, useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import {
  editableActiveFilterChips,
  removeActiveFilterChip,
  searchAddableFilters,
} from "@/lib/savedSearchFilterEditor";
import type { SearchFilters } from "@/lib/searchFilters";
import type { SearchLocationState } from "@/lib/searchLocation";

type Props = {
  open: boolean;
  onClose: () => void;
  filters: SearchFilters;
  onFiltersChange: (next: SearchFilters) => void;
  searchLocation: Pick<SearchLocationState, "cityLabel" | "neighborhoods">;
};

export function SavedSearchFiltersPicker({
  open,
  onClose,
  filters,
  onFiltersChange,
  searchLocation,
}: Props) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const activeChips = useMemo(
    () => editableActiveFilterChips(filters, searchLocation),
    [filters, searchLocation],
  );
  const results = useMemo(() => searchAddableFilters(filters, query), [filters, query]);
  const groupedResults = useMemo(() => {
    const groups = new Map<string, typeof results>();
    for (const entry of results) {
      const list = groups.get(entry.group) ?? [];
      list.push(entry);
      groups.set(entry.group, list);
    }
    return Array.from(groups.entries());
  }, [results]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2200] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-search-filters-picker-title"
        className="flex max-h-[min(88dvh,640px)] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-surface shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <h2 id="saved-search-filters-picker-title" className="text-base font-semibold text-body sm:text-lg">
            Filtros de la búsqueda
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-elevated hover:text-body"
            aria-label="Cerrar"
          >
            <X className="size-4" aria-hidden strokeWidth={2.5} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <div>
            <p className="text-sm font-medium text-body">
              Filtros activos
              <span className="ml-1.5 text-xs font-normal text-muted">({activeChips.length})</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {activeChips.length === 0 ? (
                <p className="text-xs text-muted">Sin filtros adicionales.</p>
              ) : (
                activeChips.map((chip) => {
                  const Icon = chip.icon;
                  return (
                    <span
                      key={chip.id}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/20 bg-surface px-2.5 py-1.5 text-xs font-medium text-body shadow-sm"
                    >
                      {Icon ? <Icon className="size-3.5 shrink-0 text-primary" aria-hidden strokeWidth={2.1} /> : null}
                      <span className="truncate">{chip.label}</span>
                      {chip.removable ? (
                        <button
                          type="button"
                          aria-label={`Quitar ${chip.label}`}
                          onClick={() => onFiltersChange(removeActiveFilterChip(chip.id, filters))}
                          className="-mr-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-bg-light hover:text-error"
                        >
                          <X className="size-3" aria-hidden strokeWidth={2.5} />
                        </button>
                      ) : null}
                    </span>
                  );
                })
              )}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <label className="block text-sm font-medium text-body" htmlFor="saved-search-filter-query">
              Encuentra tu Filtro
            </label>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 shadow-sm ring-accent focus-within:ring-2">
              <Search className="size-4 shrink-0 text-muted" aria-hidden />
              <input
                id="saved-search-filter-query"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ej. renta, mascotas, aval…"
                className="min-w-0 flex-1 bg-transparent text-sm text-body outline-none placeholder:text-muted"
              />
            </div>

            <div className="mt-3 space-y-3">
              {groupedResults.length === 0 ? (
                <p className="text-xs text-muted">
                  {query
                    ? "No encontramos filtros que coincidan con tu búsqueda."
                    : "Ya agregaste todos los filtros disponibles."}
                </p>
              ) : (
                groupedResults.map(([group, entries]) => (
                  <div key={group}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">{group}</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {entries.map((entry) => {
                        const Icon = entry.icon;
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => onFiltersChange(entry.activate(filters))}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-body shadow-sm transition hover:border-secondary/50 hover:bg-bg-light"
                          >
                            {Icon ? <Icon className="size-3.5 shrink-0 text-primary" aria-hidden strokeWidth={2.1} /> : null}
                            <span className="truncate">{entry.label}</span>
                            <Plus className="size-3.5 shrink-0 text-primary" aria-hidden strokeWidth={2.5} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-border px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-fg shadow-sm hover:brightness-110"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import type { AuthMe } from "@/lib/authApi";
import {
  describeActiveSearchFilters,
  formatSavedSearchTimestamp,
} from "@/lib/savedSearchDraftLabel";
import {
  fetchSearchDraft,
  promoteSearchDraft,
  type SaveSavedSearchPayload,
  type SavedSearchDto,
} from "@/lib/savedSearchesApi";
import type { SearchFilters } from "@/lib/searchFilters";
import type { SearchLocationState } from "@/lib/searchLocation";

type Props = {
  open: boolean;
  onClose: () => void;
  me: AuthMe;
  payload: Omit<SaveSavedSearchPayload, "label" | "enableEmailNotify">;
  filters: SearchFilters;
  searchLocation: SearchLocationState;
  draft: SavedSearchDto | null;
  onDraftChange?: (draft: SavedSearchDto | null) => void;
  onSaved?: () => void;
};

export function SaveSearchModal({
  open,
  onClose,
  me,
  payload: _payload,
  filters,
  searchLocation,
  draft: draftProp,
  onDraftChange,
  onSaved,
}: Props) {
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<SavedSearchDto | null>(draftProp);

  useEffect(() => {
    setDraft(draftProp);
  }, [draftProp]);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    if (draftProp) {
      setLabel(draftProp.label);
      return;
    }
    void fetchSearchDraft()
      .then((row) => {
        setDraft(row);
        onDraftChange?.(row);
        setLabel(row?.label ?? "");
      })
      .catch(() => {
        setDraft(null);
        setLabel("");
      });
  }, [open, draftProp, onDraftChange]);

  if (!open) return null;

  const summary = describeActiveSearchFilters(filters, searchLocation);
  const lastSaved = draft?.updatedAt
    ? formatSavedSearchTimestamp(draft.updatedAt, searchLocation.cityCode)
    : null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (!draft?.id) {
        setErr("Aún no hay una búsqueda auto-guardada. Ajusta los filtros y espera unos segundos.");
        return;
      }
      await promoteSearchDraft(label.trim() || draft.label);
      onSaved?.();
      onClose();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "No se pudo guardar la búsqueda.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-search-title"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2 id="save-search-title" className="text-lg font-bold text-primary">
          Guardar búsqueda
        </h2>
        <p className="mt-1 text-sm text-muted">
          Confirma el nombre de tu búsqueda auto-guardada. Puedes editarlo antes de guardarla en Mis
          Búsquedas.
        </p>

        {lastSaved ? (
          <p className="mt-3 text-xs text-muted">
            Última auto-guardada: <span className="font-medium text-body">{lastSaved}</span>
          </p>
        ) : null}

        {summary.length ? (
          <div className="mt-3 rounded-xl border border-border bg-bg-light/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">Filtros activos</p>
            <ul className="mt-2 space-y-1 text-xs text-body">
              {summary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {err ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>
        ) : null}

        <form className="mt-5 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <label className="block text-sm font-medium text-body">
            Nombre
            <input
              type="text"
              value={label}
              onChange={(ev) => setLabel(ev.target.value)}
              maxLength={200}
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
            />
          </label>

          {!me.email?.trim() ? (
            <p className="text-xs text-muted">
              Para alertas por correo usa el botón <span className="font-semibold text-body">Seguir</span> en la
              barra de filtros.
            </p>
          ) : null}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-border py-2.5 text-sm font-semibold text-body hover:bg-surface-elevated"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy || !draft}
              className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

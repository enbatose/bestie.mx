import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import type { AuthMe } from "@/lib/authApi";
import {
  autoLabelFromFilters,
  createSavedSearch,
  fetchSavedSearches,
  type SaveSavedSearchPayload,
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
  onSaved?: () => void;
};

export function SaveSearchModal({
  open,
  onClose,
  me,
  payload,
  filters,
  searchLocation,
  onSaved,
}: Props) {
  const [label, setLabel] = useState("");
  const [enableEmail, setEnableEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [activeNotifyLabel, setActiveNotifyLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLabel(autoLabelFromFilters(searchLocation, filters));
    setEnableEmail(false);
    setErr(null);
    void fetchSavedSearches()
      .then((rows) => {
        const active = rows.find((r) => r.emailNotifyEnabled);
        setActiveNotifyLabel(active?.label ?? null);
      })
      .catch(() => setActiveNotifyLabel(null));
  }, [open, filters, searchLocation]);

  if (!open) return null;

  const hasEmail = Boolean(me.email?.trim());
  const emailDisabled = !hasEmail;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (enableEmail && activeNotifyLabel && activeNotifyLabel !== label.trim()) {
      const ok = window.confirm(
        `Ya tienes alertas activas para «${activeNotifyLabel}». ¿Quieres recibir alertas de esta búsqueda en su lugar?`,
      );
      if (!ok) return;
    }

    setBusy(true);
    try {
      await createSavedSearch({
        ...payload,
        label: label.trim() || autoLabelFromFilters(searchLocation, filters),
        enableEmailNotify: enableEmail && hasEmail,
      });
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
          Guarda tus filtros actuales para volver a esta búsqueda cuando quieras.
        </p>

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

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={enableEmail}
              disabled={emailDisabled}
              onChange={(ev) => setEnableEmail(ev.target.checked)}
            />
            <span className="text-sm">
              <span className="font-medium text-body">Recibir alertas por correo electrónico</span>
              {emailDisabled ? (
                <span className="mt-1 block text-xs text-muted">
                  Agrega un correo en{" "}
                  <Link to="/perfil/editar" className="font-semibold text-primary underline" onClick={onClose}>
                    tu perfil
                  </Link>{" "}
                  para activar alertas.
                </span>
              ) : (
                <span className="mt-1 block text-xs text-muted">
                  Te enviaremos un correo con los anuncios que coincidan. Solo una búsqueda puede tener alertas
                  activas a la vez.
                </span>
              )}
            </span>
          </label>

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
              disabled={busy}
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

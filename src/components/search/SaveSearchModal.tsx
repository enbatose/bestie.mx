import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { AppConfirmDialog, replaceActiveSavedSearchNotifyMessage } from "@/components/AppConfirmDialog";
import { ActiveSearchFilterChips } from "@/components/search/ActiveSearchFilterChips";
import { HorizontalBarFilterSummary } from "@/components/search/HorizontalBarFilterSummary";
import { authUpdateMe, type AuthMe } from "@/lib/authApi";
import { formatSavedSearchTimestamp } from "@/lib/savedSearchDraftLabel";
import {
  enableSavedSearchNotify,
  fetchSavedSearches,
  fetchSearchDraft,
  promoteSearchDraft,
  updateSavedSearch,
  upsertSearchDraft,
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
  onMeUpdated?: (me: AuthMe) => void;
  onSaved?: () => void;
};

export function SaveSearchModal({
  open,
  onClose,
  me,
  payload,
  filters,
  searchLocation,
  draft: draftProp,
  onDraftChange,
  onMeUpdated,
  onSaved,
}: Props) {
  const [label, setLabel] = useState("");
  const [emailNotifyOn, setEmailNotifyOn] = useState(false);
  const [email, setEmail] = useState(me.email ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<SavedSearchDto | null>(draftProp);
  const [replaceNotifyLabel, setReplaceNotifyLabel] = useState<string | null>(null);

  useEffect(() => {
    setDraft(draftProp);
  }, [draftProp]);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setEmailNotifyOn(false);
    setEmail(me.email ?? "");
    setReplaceNotifyLabel(null);

    const loadDraft = async () => {
      if (draftProp) {
        setLabel(draftProp.label);
        return;
      }
      try {
        const row = await fetchSearchDraft();
        setDraft(row);
        onDraftChange?.(row);
        setLabel(row?.label ?? "");
      } catch {
        setDraft(null);
        setLabel("");
      }
    };

    void loadDraft();
  }, [open, draftProp, me.email, onDraftChange]);

  if (!open) return null;

  const lastSaved = draft?.updatedAt
    ? formatSavedSearchTimestamp(draft.updatedAt, searchLocation.cityCode)
    : null;
  const needsEmail = emailNotifyOn && !me.email?.trim();

  const finishSave = async () => {
    await upsertSearchDraft({ ...payload, filters });
    const promoted = await promoteSearchDraft(label.trim() || draft?.label);

    if (emailNotifyOn) {
      await enableSavedSearchNotify(promoted.id);
    } else {
      await updateSavedSearch(promoted.id, { emailNotifyEnabled: false });
    }

    onDraftChange?.(null);
    onSaved?.();
    onClose();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (emailNotifyOn) {
        const trimmedEmail = email.trim().toLowerCase();
        if (!me.email?.trim() && !trimmedEmail) {
          setErr("Ingresa un correo para activar las alertas.");
          return;
        }
        if (!me.email?.trim()) {
          await authUpdateMe({ email: trimmedEmail });
          onMeUpdated?.({ ...me, email: trimmedEmail });
        }

        const rows = await fetchSavedSearches();
        const other = rows.find((r) => r.emailNotifyEnabled);
        if (other) {
          setReplaceNotifyLabel(other.label);
          return;
        }
      }

      await finishSave();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "No se pudo guardar la búsqueda.");
    } finally {
      setBusy(false);
    }
  };

  const onConfirmReplaceNotify = () => {
    const prevLabel = replaceNotifyLabel;
    setReplaceNotifyLabel(null);
    setBusy(true);
    void (async () => {
      try {
        await finishSave();
      } catch (x) {
        setErr(x instanceof Error ? x.message : "No se pudo guardar la búsqueda.");
        if (prevLabel) setReplaceNotifyLabel(prevLabel);
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <>
      <AppConfirmDialog
        open={replaceNotifyLabel != null}
        title="Cambiar alertas activas"
        message={replaceActiveSavedSearchNotifyMessage(replaceNotifyLabel ?? "")}
        confirmLabel="Sí, cambiar"
        busy={busy}
        onConfirm={onConfirmReplaceNotify}
        onCancel={() => setReplaceNotifyLabel(null)}
      />
      <div
      className="fixed inset-0 z-[2100] flex items-end justify-center bg-black/45 p-4 sm:items-center"
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
        <div className="flex items-start justify-between gap-3">
          <h2 id="save-search-title" className="text-lg font-bold text-primary">
            Guardar búsqueda
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-elevated hover:text-body disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="size-4" aria-hidden strokeWidth={2.5} />
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">
          Confirma el nombre de tu búsqueda auto-guardada. Puedes editarlo antes de guardarla en Mis
          Búsquedas.
        </p>

        {lastSaved ? (
          <p className="mt-3 text-xs text-muted">
            Última auto-guardada: <span className="font-medium text-body">{lastSaved}</span>
          </p>
        ) : null}

        <div className="mt-3 rounded-xl border border-border bg-bg-light/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">Barra de filtros</p>
          <HorizontalBarFilterSummary filters={filters} />
        </div>

        <div className="mt-3 rounded-xl border border-border bg-bg-light/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">Más filtros</p>
          <div className="mt-2">
            <ActiveSearchFilterChips filters={filters} searchLocation={searchLocation} />
          </div>
        </div>

        {err ? (
          <p className="mt-4 rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error">{err}</p>
        ) : null}

        <form className="mt-5 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <label className="block text-sm font-medium text-body">
            Nombre de la Búsqueda Guardada
            <input
              type="text"
              value={label}
              onChange={(ev) => setLabel(ev.target.value)}
              maxLength={200}
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
            />
          </label>

          <div className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-body">Alertas por correo</p>
                <p className="mt-0.5 text-xs text-muted">
                  {emailNotifyOn
                    ? "Te avisaremos cuando haya nuevos anuncios (máx. un correo cada 3 h)."
                    : "Desactivadas para esta búsqueda."}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={emailNotifyOn}
                aria-label="Alertas por correo"
                onClick={() => setEmailNotifyOn((on) => !on)}
                className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border transition ${
                  emailNotifyOn
                    ? "border-primary bg-primary"
                    : "border-border bg-bg-light"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${
                    emailNotifyOn ? "left-[1.35rem]" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {needsEmail ? (
              <label className="mt-3 block text-sm font-medium text-body">
                Correo electrónico
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
                />
                <span className="mt-1 block text-xs font-normal text-muted">
                  Lo guardaremos en tu perfil para enviarte las alertas.
                </span>
              </label>
            ) : null}
          </div>

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
    </>
  );
}

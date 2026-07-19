import { Check, Pencil, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { AppConfirmDialog, replaceActiveSavedSearchNotifyMessage } from "@/components/AppConfirmDialog";
import { SavedSearchFiltersPicker } from "@/components/search/SavedSearchFiltersPicker";
import { authUpdateMe, type AuthMe } from "@/lib/authApi";
import { formatSavedSearchTimestamp } from "@/lib/savedSearchDraftLabel";
import { editableActiveFilterChips } from "@/lib/savedSearchFilterEditor";
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
  onFiltersChange: (next: SearchFilters) => void;
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
  onFiltersChange,
  searchLocation,
  draft: draftProp,
  onDraftChange,
  onMeUpdated,
  onSaved,
}: Props) {
  const nameInputId = useId();
  const [label, setLabel] = useState("");
  const [labelTouched, setLabelTouched] = useState(false);
  const [nameEditing, setNameEditing] = useState(false);
  const [filtersPickerOpen, setFiltersPickerOpen] = useState(false);
  const [emailNotifyOn, setEmailNotifyOn] = useState(false);
  const [email, setEmail] = useState(me.email ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<SavedSearchDto | null>(draftProp);
  const [replaceNotifyLabel, setReplaceNotifyLabel] = useState<string | null>(null);

  // Keep the "Última auto-guardada" timestamp and the default name fresh as auto-save ticks come
  // in, but never once the user has started customizing the name themselves.
  useEffect(() => {
    setDraft(draftProp);
    if (draftProp && !labelTouched) setLabel(draftProp.label);
  }, [draftProp, labelTouched]);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setEmailNotifyOn(false);
    setEmail(me.email ?? "");
    setReplaceNotifyLabel(null);
    setNameEditing(false);
    setFiltersPickerOpen(false);
    setLabelTouched(false);

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
    // Intentionally only re-run when the modal opens: an auto-save tick while it's open updates
    // `draft`/`draftProp` on every filter change and must not reset in-progress edits (custom
    // name, alerts toggle, open filters picker) or close anything.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const activeFilterChips = useMemo(
    () => editableActiveFilterChips(filters, searchLocation),
    [filters, searchLocation],
  );

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
      <SavedSearchFiltersPicker
        open={filtersPickerOpen}
        onClose={() => setFiltersPickerOpen(false)}
        filters={filters}
        onFiltersChange={onFiltersChange}
        searchLocation={searchLocation}
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

        <label htmlFor={nameInputId} className="mt-3 block text-sm font-medium text-body">
          Nombre de la Búsqueda Guardada
        </label>
        <div
          className={`mt-1 flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm transition ${
            nameEditing
              ? "border-primary/30 bg-surface ring-2 ring-accent"
              : "border-border bg-bg-light/60"
          }`}
        >
          <input
            id={nameInputId}
            type="text"
            value={label}
            onChange={(ev) => {
              setLabel(ev.target.value);
              setLabelTouched(true);
            }}
            readOnly={!nameEditing}
            maxLength={200}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" && nameEditing) {
                ev.preventDefault();
                setNameEditing(false);
              }
            }}
            className={`min-w-0 flex-1 bg-transparent text-sm text-body outline-none ${
              nameEditing ? "" : "cursor-default"
            }`}
          />
          <button
            type="button"
            aria-label={nameEditing ? "Confirmar nombre" : "Editar nombre"}
            onClick={() =>
              setNameEditing((editing) => {
                const next = !editing;
                if (next) setLabelTouched(true);
                return next;
              })
            }
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-elevated hover:text-primary"
          >
            {nameEditing ? (
              <Check className="size-4" aria-hidden strokeWidth={2.5} />
            ) : (
              <Pencil className="size-4" aria-hidden strokeWidth={2.2} />
            )}
          </button>
        </div>

        {lastSaved ? (
          <p className="mt-2 text-xs text-muted">
            Última auto-guardada: <span className="font-medium text-body">{lastSaved}</span>
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setFiltersPickerOpen(true)}
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-bg-light/60 px-3 py-2.5 text-sm font-semibold text-primary shadow-sm transition hover:border-secondary/50 hover:bg-bg-light"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Mostrar filtros
          {activeFilterChips.length > 0 ? (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-fg">
              {activeFilterChips.length}
            </span>
          ) : null}
        </button>

        {err ? (
          <p className="mt-4 rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error">{err}</p>
        ) : null}

        <form className="mt-5 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div className="rounded-xl bg-primary p-3 text-primary-fg shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-primary-fg">Alertas por correo</p>
                <p className="mt-0.5 text-xs text-primary-fg/75">
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
                    ? "border-secondary bg-secondary"
                    : "border-white/30 bg-white/15"
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
              <label className="mt-3 block text-sm font-medium text-primary-fg">
                Correo electrónico
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
                />
                <span className="mt-1 block text-xs font-normal text-primary-fg/75">
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

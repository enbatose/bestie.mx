import { useState } from "react";
import { AppConfirmDialog, replaceActiveSavedSearchNotifyMessage } from "@/components/AppConfirmDialog";
import { authUpdateMe } from "@/lib/authApi";
import type { AuthMe } from "@/lib/authApi";
import {
  enableSavedSearchNotify,
  fetchSavedSearches,
  promoteSearchDraft,
  upsertSearchDraft,
  type SaveSavedSearchPayload,
} from "@/lib/savedSearchesApi";

type Props = {
  open: boolean;
  onClose: () => void;
  me: AuthMe;
  payload: Omit<SaveSavedSearchPayload, "label" | "enableEmailNotify">;
  onMeUpdated: (me: AuthMe) => void;
  onEnabled: (emailSent: boolean) => void;
};

export function FollowSearchNotifyModal({
  open,
  onClose,
  me,
  payload,
  onMeUpdated,
  onEnabled,
}: Props) {
  const [email, setEmail] = useState(me.email ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [replaceNotifyLabel, setReplaceNotifyLabel] = useState<string | null>(null);

  if (!open) return null;

  const finishEnable = async () => {
    await upsertSearchDraft(payload);
    const promoted = await promoteSearchDraft();
    const result = await enableSavedSearchNotify(promoted.id);
    onEnabled(result.emailSent ?? true);
  };

  const runEnable = async () => {
    setErr(null);
    setBusy(true);
    try {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed) {
        setErr("Ingresa un correo electrónico.");
        return;
      }
      if (!me.email?.trim()) {
        await authUpdateMe({ email: trimmed });
        onMeUpdated({ ...me, email: trimmed });
      }

      const rows = await fetchSavedSearches();
      const other = rows.find((r) => r.emailNotifyEnabled);
      if (other) {
        setReplaceNotifyLabel(other.label);
        return;
      }

      await finishEnable();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "No se pudieron activar las alertas.");
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
        await finishEnable();
      } catch (x) {
        setErr(x instanceof Error ? x.message : "No se pudieron activar las alertas.");
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
        aria-labelledby="follow-search-title"
        onClick={(ev) => {
          if (ev.target === ev.currentTarget) onClose();
        }}
      >
        <div
          className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl"
          onClick={(ev) => ev.stopPropagation()}
        >
          <h2 id="follow-search-title" className="text-lg font-bold text-primary">
            Seguir esta búsqueda
          </h2>
          <p className="mt-1 text-sm text-muted">
            Para activar alertas por correo necesitamos tu email. Lo guardaremos en tu perfil y te
            avisaremos cuando haya nuevos anuncios (como máximo un correo cada 3 horas).
          </p>

          {err ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>
          ) : null}

          <div className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-body">
              Correo electrónico
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
              />
            </label>
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-border py-2.5 text-sm font-semibold text-body hover:bg-surface-elevated"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runEnable()}
              className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Activando…" : "Activar alertas"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

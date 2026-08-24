import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { PhoneNumberField } from "@/components/phone/PhoneNumberField";
import { authUpdateMe, type AuthMe } from "@/lib/authApi";
import { normalizeMxNationalDigits, phoneDigitsForStorage } from "@/lib/mxPhone";

type Props = {
  open: boolean;
  me: AuthMe;
  onSaved: () => void | Promise<void>;
  onDismissed: () => void | Promise<void>;
};

export function CompletaTuPerfilModal({ open, me, onSaved, onDismissed }: Props) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhone(normalizeMxNationalDigits(me.phoneE164 ?? "") ?? "");
    setErr(null);
  }, [me.phoneE164, open]);

  const isPublisher = me.linkedPublisherIds.length > 0;
  const phoneDigits = useMemo(() => (phone.trim() ? phoneDigitsForStorage(phone) : null), [phone]);

  if (!open) return null;

  const dismiss = async () => {
    setBusy(true);
    setErr(null);
    try {
      await authUpdateMe({ dismissPhonePrompt: true });
      window.dispatchEvent(new Event("bestie:me-changed"));
      await onDismissed();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "No se pudo cerrar este recordatorio.");
    } finally {
      setBusy(false);
    }
  };

  const savePhone = async () => {
    if (!phoneDigits) {
      setErr("Completa un número válido de 10 dígitos.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await authUpdateMe({ phone: phone.trim() });
      window.dispatchEvent(new Event("bestie:me-changed"));
      await onSaved();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "No se pudo guardar tu teléfono.");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[2100] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-profile-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          void dismiss();
        }
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Completa tu perfil</p>
        <h2 id="complete-profile-title" className="mt-1 text-lg font-bold text-primary">
          Agrega tu teléfono
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Te sirve para notificaciones y comunicaciones de Bestie por SMS o WhatsApp.
        </p>

        <PhoneNumberField
          id="complete-profile-phone"
          value={phone}
          onChange={setPhone}
          className="mt-4"
        />

        <div className="mt-4 rounded-xl border border-border bg-bg-light px-3 py-3 text-xs leading-relaxed text-muted">
          <p>
            {isPublisher
              ? "Tu número no se muestra automáticamente. En un anuncio solo aparece si eliges mostrarlo en esa publicación."
              : "Tu número no se muestra a otras personas. Queda en tu perfil para comunicaciones de Bestie."}
          </p>
          <p className="mt-2">
            Al guardarlo, aceptas por defecto avisos de Bestie y contenido promocional por SMS o WhatsApp.
            Puedes desactivarlos en cualquier momento en tu perfil. Bestie no vende tu número a terceros.
          </p>
        </div>

        {err ? (
          <p role="alert" className="mt-4 rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
            {err}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void dismiss()}
            disabled={busy}
            className="min-h-11 flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-body hover:bg-surface-elevated disabled:opacity-60"
          >
            Ahora no
          </button>
          <button
            type="button"
            onClick={() => void savePhone()}
            disabled={busy || !phoneDigits}
            className="min-h-11 flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "Guardando…" : "Guardar teléfono"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

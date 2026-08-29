import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { PhoneNumberField } from "@/components/phone/PhoneNumberField";
import { authPhoneOtpRequest, authPhoneVerify } from "@/lib/authApi";
import { phoneDigitsForStorage } from "@/lib/mxPhone";

type Props = {
  open: boolean;
  /** National MX digits currently on the form or profile. */
  initialPhone: string;
  onClose: () => void;
  onVerified: () => void | Promise<void>;
};

export function VerifyPhoneOtpModal({ open, initialPhone, onClose, onVerified }: Props) {
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhone(initialPhone);
    setCode("");
    setOtpSent(false);
    setDevCode(null);
    setErr(null);
  }, [initialPhone, open]);

  const phoneDigits = useMemo(() => (phone.trim() ? phoneDigitsForStorage(phone) : null), [phone]);

  if (!open) return null;

  const sendOtp = async () => {
    if (!phoneDigits) {
      setErr("Completa un celular mexicano de 10 dígitos.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await authPhoneOtpRequest(phone.trim());
      setOtpSent(true);
      setDevCode(r.devCode ?? null);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "No se pudo enviar el código.");
    } finally {
      setBusy(false);
    }
  };

  const confirmPhone = async () => {
    if (!phoneDigits || !/^\d{6}$/.test(code.trim())) {
      setErr("Ingresa el código de 6 dígitos.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await authPhoneVerify({ phone: phone.trim(), code: code.trim() });
      window.dispatchEvent(new Event("bestie:me-changed"));
      await onVerified();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "No se pudo verificar el teléfono.");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[2100] flex items-end justify-center bg-black/45 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="verify-phone-otp-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[min(92dvh,720px)] w-full min-w-0 max-w-md overflow-x-clip overflow-y-auto rounded-2xl border border-border bg-surface p-4 shadow-xl sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Teléfono de perfil</p>
        <h2 id="verify-phone-otp-title" className="mt-1 break-words text-lg font-bold text-primary">
          Verifica tu teléfono
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Te enviamos un código por SMS. Solo celulares de México (+52).
        </p>

        <div className="mt-4 space-y-3">
          <PhoneNumberField
            id="verify-phone-otp-phone"
            value={phone}
            onChange={(next) => {
              setPhone(next);
              setOtpSent(false);
              setCode("");
              setDevCode(null);
            }}
            optional={false}
          />
          {otpSent ? (
            <label className="block text-sm font-medium text-body">
              Código SMS
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                size={6}
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-1 w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-base text-body outline-none ring-accent focus:ring-2 sm:text-sm"
              />
            </label>
          ) : null}
          {devCode ? <p className="text-xs text-muted">Código de prueba (dev): {devCode}</p> : null}
        </div>

        {err ? (
          <p role="alert" className="mt-4 rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
            {err}
          </p>
        ) : null}

        <div className="mt-5 flex min-w-0 flex-col-reverse gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-11 min-w-0 flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-body hover:bg-surface-elevated disabled:opacity-60"
          >
            Cancelar
          </button>
          {!otpSent ? (
            <button
              type="button"
              onClick={() => void sendOtp()}
              disabled={busy || !phoneDigits}
              className="min-h-11 min-w-0 flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Enviando…" : "Enviar código"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void confirmPhone()}
              disabled={busy || code.length !== 6}
              className="min-h-11 min-w-0 flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Verificando…" : "Verificar"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { PhoneNumberField } from "@/components/phone/PhoneNumberField";
import { PasswordField } from "@/components/PasswordField";
import {
  authLinkExistingEmail,
  authPhoneOtpRequest,
  authPhoneVerify,
  authUpdateMe,
  isEmailLinkRequiredError,
  shouldAskProfilePhone,
  type AuthMe,
} from "@/lib/authApi";
import { normalizeMxNationalDigits, phoneDigitsForStorage } from "@/lib/mxPhone";

type Props = {
  open: boolean;
  me: AuthMe;
  missingEmailAtOpen?: boolean;
  onSaved: () => void | Promise<void>;
  onDismissed: () => void | Promise<void>;
};

export function profileNagStorageKey(userId: string): string {
  return `bestie_profile_nag_skip_${userId}`;
}

export function CompletaTuPerfilModal({
  open,
  me,
  missingEmailAtOpen = false,
  onSaved,
  onDismissed,
}: Props) {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [linkPending, setLinkPending] = useState(false);
  const [linkCode, setLinkCode] = useState("");
  const [preferPhone, setPreferPhone] = useState(false);

  const needsEmail = !me.email?.trim();
  const askPhone = shouldAskProfilePhone(me, { missingEmailAtOpen });
  const step: "email" | "phone" = needsEmail && !preferPhone ? "email" : "phone";

  useEffect(() => {
    if (!open) return;
    setPhone(normalizeMxNationalDigits(me.phoneE164 ?? "") ?? "");
    setCode("");
    setOtpSent(false);
    setDevCode(null);
    setEmail(me.email ?? "");
    setCurrentPassword("");
    setErr(null);
    setLinkPending(false);
    setLinkCode("");
    setPreferPhone(false);
  }, [me.email, me.id, me.phoneE164, open]);

  const phoneDigits = useMemo(() => (phone.trim() ? phoneDigitsForStorage(phone) : null), [phone]);

  if (!open) return null;

  const oauthAccount =
    me.signInMethod === "google" || me.signInMethod === "facebook" || me.signInMethod === "phone";

  const dismiss = async () => {
    try {
      sessionStorage.setItem(profileNagStorageKey(me.id), "1");
    } catch {
      /* ignore */
    }
    await onDismissed();
  };

  const finishAfterContact = async () => {
    await onSaved();
    const emailNow = (me.email ?? email).trim();
    if (emailNow && (missingEmailAtOpen || me.emailVerified === false)) {
      navigate("/verificar-correo", { replace: true });
    }
  };

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
      const verified = await authPhoneVerify({ phone: phone.trim(), code: code.trim() });
      window.dispatchEvent(new Event("bestie:me-changed"));
      if (verified.linked) {
        await onSaved();
        return;
      }
      await finishAfterContact();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "No se pudo verificar el teléfono.");
    } finally {
      setBusy(false);
    }
  };

  const saveEmail = async () => {
    if (!email.includes("@")) {
      setErr("Escribe un correo válido.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await authUpdateMe({
        email: email.trim(),
        ...(oauthAccount ? {} : { currentPassword }),
      });
      window.dispatchEvent(new Event("bestie:me-changed"));
      await onSaved();
      const nextMe = { ...me, email: email.trim(), emailVerified: false };
      if (!shouldAskProfilePhone(nextMe, { missingEmailAtOpen: true })) {
        navigate("/verificar-correo", { replace: true });
      }
    } catch (error) {
      if (isEmailLinkRequiredError(error)) {
        setLinkPending(true);
        setLinkCode("");
        setDevCode(error.devCode ?? null);
        setErr(null);
        return;
      }
      setErr(error instanceof Error ? error.message : "No se pudo guardar el correo.");
    } finally {
      setBusy(false);
    }
  };

  const confirmLink = async () => {
    if (!/^\d{6}$/.test(linkCode.trim())) {
      setErr("Ingresa el código de 6 dígitos del correo.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await authLinkExistingEmail({ email: email.trim(), code: linkCode.trim() });
      window.dispatchEvent(new Event("bestie:me-changed"));
      await onSaved();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "No se pudo ligar la cuenta.");
    } finally {
      setBusy(false);
    }
  };

  const title = linkPending
    ? "Liga tu cuenta"
    : step === "email"
      ? "Agrega tu correo"
      : "Confirma tu celular";
  const blurb = linkPending
    ? `Ese correo ya es una cuenta Bestie (Google o correo y contraseña). Te enviamos un código a ${email.trim()} para ligar Facebook a esa misma cuenta. Revisa también spam.`
    : step === "email"
      ? askPhone
        ? "Facebook no siempre comparte un correo, y nunca comparte tu celular. Empieza por el correo, o confirma el celular si tu cuenta Bestie es de teléfono."
        : "Agrega un correo para avisarte de mensajes y códigos. Facebook y Google no siempre lo comparten."
      : me.signInMethod === "facebook" || missingEmailAtOpen || preferPhone
        ? "Facebook Login no incluye tu número. Confirmamos el celular con un código por SMS. Si ese número ya es tu cuenta Bestie, al verificarlo ligamos Facebook a esa cuenta. Solo México (+52)."
        : "Confirmamos el número con un código por SMS. Solo celulares de México (+52).";

  return createPortal(
    <div
      className="fixed inset-0 z-[2100] flex items-end justify-center bg-black/45 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-profile-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          void dismiss();
        }
      }}
    >
      <div className="max-h-[min(92dvh,720px)] w-full min-w-0 max-w-md overflow-x-clip overflow-y-auto rounded-2xl border border-border bg-surface p-4 shadow-xl sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Completa tu perfil</p>
        <h2 id="complete-profile-title" className="mt-1 break-words text-lg font-bold text-primary">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{blurb}</p>

        {step === "email" ? (
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-body">
              Correo
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (linkPending) {
                    setLinkPending(false);
                    setLinkCode("");
                  }
                }}
                className="mt-1 w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-base text-body outline-none ring-accent focus:ring-2 sm:text-sm"
              />
            </label>
            {!oauthAccount && !linkPending ? (
              <label className="block text-sm font-medium text-body">
                Contraseña actual
                <PasswordField
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1 w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-base text-body outline-none ring-accent focus:ring-2 sm:text-sm"
                />
              </label>
            ) : null}
            {linkPending ? (
              <label className="block text-sm font-medium text-body">
                Código del correo
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  size={6}
                  maxLength={6}
                  value={linkCode}
                  onChange={(e) => setLinkCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="mt-1 w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-base text-body outline-none ring-accent focus:ring-2 sm:text-sm"
                />
              </label>
            ) : null}
            {linkPending && devCode ? (
              <p className="text-xs text-muted">Código de prueba (dev): {devCode}</p>
            ) : null}
            {needsEmail && !linkPending ? (
              <button
                type="button"
                onClick={() => {
                  setPreferPhone(true);
                  setErr(null);
                }}
                disabled={busy}
                className="min-h-11 w-full min-w-0 text-left text-sm font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-60"
              >
                Prefiero confirmar con mi celular
              </button>
            ) : null}
          </div>
        ) : null}

        {step === "phone" && askPhone ? (
          <div className="mt-4 space-y-3">
            <PhoneNumberField
              id="complete-profile-phone"
              value={phone}
              onChange={setPhone}
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
            {devCode ? (
              <p className="text-xs text-muted">Código de prueba (dev): {devCode}</p>
            ) : null}
            {preferPhone && needsEmail ? (
              <button
                type="button"
                onClick={() => {
                  setPreferPhone(false);
                  setOtpSent(false);
                  setCode("");
                  setDevCode(null);
                  setErr(null);
                }}
                disabled={busy}
                className="min-h-11 w-full min-w-0 text-left text-sm font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-60"
              >
                Prefiero usar un correo
              </button>
            ) : null}
          </div>
        ) : null}

        {err ? (
          <p role="alert" className="mt-4 rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
            {err}
          </p>
        ) : null}

        <div className="mt-5 flex min-w-0 flex-col-reverse gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void dismiss()}
            disabled={busy}
            className="min-h-11 min-w-0 flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-body hover:bg-surface-elevated disabled:opacity-60"
          >
            Ahora no
          </button>
          {step === "email" && !linkPending ? (
            <button
              type="button"
              onClick={() => void saveEmail()}
              disabled={busy}
              className="min-h-11 min-w-0 flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Guardando…" : askPhone ? "Continuar" : "Guardar correo"}
            </button>
          ) : null}
          {step === "email" && linkPending ? (
            <button
              type="button"
              onClick={() => void confirmLink()}
              disabled={busy || linkCode.length !== 6}
              className="min-h-11 min-w-0 flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Ligando…" : "Ligar cuenta"}
            </button>
          ) : null}
          {step === "phone" && !otpSent ? (
            <button
              type="button"
              onClick={() => void sendOtp()}
              disabled={busy || !phoneDigits}
              className="min-h-11 min-w-0 flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Enviando…" : "Enviar código"}
            </button>
          ) : null}
          {step === "phone" && otpSent ? (
            <button
              type="button"
              onClick={() => void confirmPhone()}
              disabled={busy || code.length !== 6}
              className="min-h-11 min-w-0 flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Verificando…" : "Verificar"}
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

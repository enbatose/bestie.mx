import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PasswordField } from "@/components/PasswordField";
import { AuthIdentifierField } from "@/components/auth/AuthIdentifierField";
import {
  authForgotPassword,
  authMe,
  authPhonePasswordResetComplete,
  authPhonePasswordResetRequest,
  needsEmailVerification,
} from "@/lib/authApi";
import { AUTH_IDENTIFIER_INVALID_MESSAGE, classifyAuthIdentifier } from "@/lib/authIdentifier";
import { destinationAfterAuth } from "@/lib/postLoginRedirect";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpForPhone, setOtpForPhone] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const classified = classifyAuthIdentifier(identifier);
  const isPhone = classified.kind === "phone";

  const onIdentifierChange = (next: string) => {
    setIdentifier(next);
    const nextClass = classifyAuthIdentifier(next);
    if (otpSent && (nextClass.kind !== "phone" || nextClass.phone !== otpForPhone)) {
      setOtpSent(false);
      setOtpCode("");
      setDevCode(null);
      setOtpForPhone(null);
    }
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-md px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold tracking-tight text-primary">Recuperar contraseña</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Escribe el correo o el celular mexicano verificado de tu cuenta. Con correo te enviamos un
        enlace; con celular, un código SMS.
      </p>

      {sentEmail ? (
        <div className="mt-6 rounded-xl border border-secondary/40 bg-secondary/10 p-4 text-sm text-body">
          <p className="font-medium">Revisa tu correo</p>
          <p className="mt-2">
            Si hay una cuenta con <span className="font-medium">{sentEmail}</span>, enviamos un
            enlace para restablecer la contraseña. Revisa también spam o promociones.
          </p>
          {devResetUrl ? (
            <p className="mt-3 break-all text-xs text-muted">
              Enlace de desarrollo:{" "}
              <a href={devResetUrl} className="font-semibold text-primary underline">
                {devResetUrl}
              </a>
            </p>
          ) : null}
        </div>
      ) : (
        <>
          {err ? (
            <p className="mt-4 rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error">{err}</p>
          ) : null}
          <form
            className="mt-8 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setErr(null);
              const id = classifyAuthIdentifier(identifier);
              if (id.kind === "undetermined") {
                setErr(AUTH_IDENTIFIER_INVALID_MESSAGE);
                return;
              }
              setBusy(true);
              try {
                if (id.kind === "phone") {
                  if (!otpSent) {
                    const r = await authPhonePasswordResetRequest(id.phone);
                    setOtpSent(true);
                    setOtpForPhone(id.phone);
                    setDevCode(r.devCode ?? null);
                    return;
                  }
                  if (newPassword !== passwordConfirm) {
                    setErr("Las contraseñas no coinciden.");
                    return;
                  }
                  await authPhonePasswordResetComplete({
                    phone: id.phone,
                    code: otpCode.trim(),
                    newPassword,
                  });
                  const me = await authMe().catch(() => null);
                  window.dispatchEvent(new Event("bestie:me-changed"));
                  navigate(
                    await destinationAfterAuth(undefined, Boolean(me && needsEmailVerification(me))),
                    { replace: true },
                  );
                  return;
                }
                const r = await authForgotPassword(id.email);
                setSentEmail(id.email);
                if (r.devResetUrl) setDevResetUrl(r.devResetUrl);
              } catch (x) {
                setErr(x instanceof Error ? x.message : "No se pudo completar la acción.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <AuthIdentifierField id="reset-identifier" value={identifier} onChange={onIdentifierChange} />
            {isPhone && otpSent ? (
              <>
                <label className="block min-w-0 text-sm font-medium text-body">
                  Código SMS
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    size={6}
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="mt-1 w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-base text-body outline-none ring-accent focus:ring-2 sm:text-sm"
                  />
                </label>
                {devCode ? <p className="text-xs text-muted">Código de prueba (dev): {devCode}</p> : null}
                <label className="block min-w-0 text-sm font-medium text-body">
                  Nueva contraseña
                  <PasswordField
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setPasswordConfirm("");
                    }}
                    className="mt-1 w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-base text-body outline-none ring-accent focus:ring-2 sm:text-sm"
                  />
                </label>
                <label className="block min-w-0 text-sm font-medium text-body">
                  Confirmar contraseña
                  <PasswordField
                    required
                    minLength={8}
                    autoComplete="off"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className="mt-1 w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-base text-body outline-none ring-accent focus:ring-2 sm:text-sm"
                  />
                </label>
              </>
            ) : isPhone ? (
              <p className="text-xs text-muted">
                Si el número está verificado en una cuenta con contraseña, te enviamos un código SMS.
              </p>
            ) : (
              <p className="text-xs text-muted">
                Si el valor es un correo, te enviamos un enlace. Si es un celular de 10 dígitos, un código SMS.
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
            >
              {busy
                ? "Enviando…"
                : isPhone
                  ? otpSent
                    ? "Cambiar contraseña"
                    : "Enviar código"
                  : classified.kind === "email"
                    ? "Enviar enlace"
                    : "Continuar"}
            </button>
          </form>
        </>
      )}

      <p className="mt-8 text-center text-sm text-muted">
        <Link to="/entrar" className="font-semibold text-primary underline-offset-2 hover:underline">
          Volver a entrar
        </Link>
      </p>
    </div>
  );
}

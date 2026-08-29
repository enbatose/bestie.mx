import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PasswordField } from "@/components/PasswordField";
import { PhoneNumberField } from "@/components/phone/PhoneNumberField";
import {
  authForgotPassword,
  authMe,
  authPhonePasswordResetComplete,
  authPhonePasswordResetRequest,
  needsEmailVerification,
} from "@/lib/authApi";
import { destinationAfterAuth } from "@/lib/postLoginRedirect";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  return (
    <div className="mx-auto w-full min-w-0 max-w-md px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold tracking-tight text-primary">Recuperar contraseña</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Usa el correo o el celular mexicano verificado de tu cuenta. Con correo te enviamos un enlace;
        con celular, un código SMS.
      </p>

      <div className="mt-6 flex rounded-full border border-border bg-bg-light p-0.5 text-xs font-semibold">
        <button
          type="button"
          className={`flex-1 rounded-full py-1.5 ${method === "email" ? "bg-surface text-primary shadow-sm" : "text-muted"}`}
          onClick={() => {
            setMethod("email");
            setErr(null);
            setOtpSent(false);
          }}
        >
          Correo
        </button>
        <button
          type="button"
          className={`flex-1 rounded-full py-1.5 ${method === "phone" ? "bg-surface text-primary shadow-sm" : "text-muted"}`}
          onClick={() => {
            setMethod("phone");
            setErr(null);
            setSent(false);
          }}
        >
          Celular
        </button>
      </div>

      {method === "email" && sent ? (
        <div className="mt-6 rounded-xl border border-secondary/40 bg-secondary/10 p-4 text-sm text-body">
          <p className="font-medium">Revisa tu correo</p>
          <p className="mt-2">
            Si hay una cuenta con <span className="font-medium">{email.trim().toLowerCase()}</span>, enviamos un
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
              setBusy(true);
              try {
                if (method === "phone") {
                  if (!otpSent) {
                    const r = await authPhonePasswordResetRequest(phone);
                    setOtpSent(true);
                    setDevCode(r.devCode ?? null);
                    return;
                  }
                  if (newPassword !== passwordConfirm) {
                    setErr("Las contraseñas no coinciden.");
                    return;
                  }
                  await authPhonePasswordResetComplete({
                    phone,
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
                const r = await authForgotPassword(email.trim().toLowerCase());
                setSent(true);
                if (r.devResetUrl) setDevResetUrl(r.devResetUrl);
              } catch (x) {
                setErr(x instanceof Error ? x.message : "No se pudo completar la acción.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {method === "phone" ? (
              <>
                <PhoneNumberField
                  id="reset-phone"
                  value={phone}
                  onChange={setPhone}
                  optional={false}
                  showWhatsAppHint={false}
                />
                {otpSent ? (
                  <>
                    <label className="block text-sm font-medium text-body">
                      Código SMS
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        size={6}
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="mt-1 w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
                      />
                    </label>
                    {devCode ? <p className="text-xs text-muted">Código de prueba (dev): {devCode}</p> : null}
                    <label className="block text-sm font-medium text-body">
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
                        className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
                      />
                    </label>
                    <label className="block text-sm font-medium text-body">
                      Confirmar contraseña
                      <PasswordField
                        required
                        minLength={8}
                        autoComplete="off"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
                      />
                    </label>
                  </>
                ) : (
                  <p className="text-xs text-muted">
                    Si el número está verificado en una cuenta con contraseña, te enviamos un código SMS.
                  </p>
                )}
              </>
            ) : (
              <label className="block text-sm font-medium text-body">
                Correo de la cuenta
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
                />
              </label>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
            >
              {busy
                ? "Enviando…"
                : method === "phone"
                  ? otpSent
                    ? "Cambiar contraseña"
                    : "Enviar código"
                  : "Enviar enlace"}
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

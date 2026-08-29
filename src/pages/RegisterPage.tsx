import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PasswordField } from "@/components/PasswordField";
import { AuthLegalConsent, AuthMethodDivider, SocialSignInButtons } from "@/components/GoogleSignInButton";
import { authRegister, authPhoneOtpRequest, authPhoneRegister, needsEmailVerification } from "@/lib/authApi";
import { PhoneNumberField } from "@/components/phone/PhoneNumberField";
import { identifyUser, track } from "@/lib/analytics";
import { POST_LOGIN_RESOLVE_PATH, resolvePostLoginPath } from "@/lib/postLoginRedirect";

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-md px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold tracking-tight text-primary">Crear cuenta</h1>
      <p className="mt-2 text-sm text-muted">
        Regístrate con Google, correo o un celular mexicano (+52). Con celular te enviamos un código SMS.
      </p>

      <div className="mt-6">
        <SocialSignInButtons returnTo={POST_LOGIN_RESOLVE_PATH} />
      </div>
      <AuthLegalConsent action="registrarte" />
      <AuthMethodDivider />

        {err ? (
        <p className="mt-4 rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error">{err}</p>
      ) : null}
      <div className="mt-8 flex rounded-full border border-border bg-bg-light p-0.5 text-xs font-semibold">
        <button
          type="button"
          className={`flex-1 rounded-full py-1.5 ${method === "email" ? "bg-surface text-primary shadow-sm" : "text-muted"}`}
          onClick={() => {
            setMethod("email");
            setOtpSent(false);
            setErr(null);
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
          }}
        >
          Celular
        </button>
      </div>
      <form
        className="mt-8 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          if (password !== passwordConfirm) {
            setErr("Las contraseñas no coinciden.");
            return;
          }
          if (method === "phone") {
            if (!displayName.trim()) {
              setErr("Escribe un nombre para mostrar.");
              return;
            }
            if (!otpSent) {
              setBusy(true);
              try {
                const r = await authPhoneOtpRequest(phone);
                setOtpSent(true);
                setDevCode(r.devCode ?? null);
              } catch (x) {
                setErr(x instanceof Error ? x.message : "No se pudo enviar el código.");
              } finally {
                setBusy(false);
              }
              return;
            }
            setBusy(true);
            try {
              const { me } = await authPhoneRegister({
                phone,
                code: otpCode.trim(),
                password,
                displayName: displayName.trim(),
              });
              if (me?.id) {
                identifyUser(me.id, {
                  email: me.email,
                  name: me.displayName,
                  is_admin: me.isAdmin,
                });
                track("user_signed_up", { method: "phone" });
              }
              navigate(await resolvePostLoginPath(), { replace: true });
            } catch (x) {
              setErr(x instanceof Error ? x.message : "No se pudo completar la acción.");
            } finally {
              setBusy(false);
            }
            return;
          }
          setBusy(true);
          try {
            const { me } = await authRegister({
              email: email.trim().toLowerCase(),
              password,
              displayName: displayName.trim() || undefined,
            });
            if (me?.id) {
              identifyUser(me.id, {
                email: me.email,
                name: me.displayName,
                is_admin: me.isAdmin,
              });
              track("user_signed_up", { method: "email" });
            }
            navigate(
              needsEmailVerification(me) ? "/verificar-correo" : await resolvePostLoginPath(),
              { replace: true },
            );
          } catch (x) {
            setErr(x instanceof Error ? x.message : "No se pudo completar la acción.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block text-sm font-medium text-body">
          Nombre para mostrar
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
          />
        </label>
        {method === "phone" ? (
          <PhoneNumberField
            id="register-phone"
            value={phone}
            onChange={setPhone}
            optional={false}
            showWhatsAppHint={false}
          />
        ) : (
          <label className="block text-sm font-medium text-body">
            Correo
            <input
              type="email"
              required={method === "email"}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
            />
          </label>
        )}
        {method === "phone" && otpSent ? (
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
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
            />
          </label>
        ) : null}
        {devCode ? <p className="text-xs text-muted">Código de prueba (dev): {devCode}</p> : null}
        <label className="block text-sm font-medium text-body">
          Contraseña
          <PasswordField
            required
            minLength={8}
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordConfirm("");
            }}
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
          />
        </label>
        <label className="block text-sm font-medium text-body">
          Confirmar contraseña
          <PasswordField
            required
            minLength={8}
            name="password_confirm"
            autoComplete="off"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            onPaste={(e) => e.preventDefault()}
            onDrop={(e) => e.preventDefault()}
            className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Creando…" : method === "phone" && !otpSent ? "Enviar código" : "Registrarme"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link to="/entrar" className="font-semibold text-primary underline-offset-2 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}

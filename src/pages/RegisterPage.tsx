import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PasswordField } from "@/components/PasswordField";
import { AuthIdentifierField } from "@/components/auth/AuthIdentifierField";
import { AuthLegalConsent, AuthMethodDivider, SocialSignInButtons } from "@/components/GoogleSignInButton";
import { authRegister, authPhoneOtpRequest, authPhoneRegister, needsEmailVerification } from "@/lib/authApi";
import { ProfilePictureUpload } from "@/components/ProfilePictureUpload";
import { identifyUser, track } from "@/lib/analytics";
import { AUTH_IDENTIFIER_INVALID_MESSAGE, classifyAuthIdentifier } from "@/lib/authIdentifier";
import { POST_LOGIN_RESOLVE_PATH, resolvePostLoginPath } from "@/lib/postLoginRedirect";

export function RegisterPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpForPhone, setOtpForPhone] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
      <form
        className="mt-8 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          if (password !== passwordConfirm) {
            setErr("Las contraseñas no coinciden.");
            return;
          }
          const id = classifyAuthIdentifier(identifier);
          if (id.kind === "undetermined") {
            setErr(AUTH_IDENTIFIER_INVALID_MESSAGE);
            return;
          }
          if (id.kind === "phone") {
            if (!displayName.trim()) {
              setErr("Escribe un nombre para mostrar.");
              return;
            }
            if (!otpSent) {
              setBusy(true);
              try {
                const r = await authPhoneOtpRequest(id.phone);
                setOtpSent(true);
                setOtpForPhone(id.phone);
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
                phone: id.phone,
                code: otpCode.trim(),
                password,
                displayName: displayName.trim(),
                profilePictureUrl: profilePictureUrl || undefined,
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
              email: id.email,
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
        <label className="block min-w-0 text-sm font-medium text-body">
          Nombre para mostrar
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-base text-body outline-none ring-accent focus:ring-2 sm:text-sm"
          />
        </label>
        <AuthIdentifierField id="register-identifier" value={identifier} onChange={onIdentifierChange} />
        {isPhone ? (
          <ProfilePictureUpload
            displayName={displayName.trim() || "Bestie"}
            profilePictureUrl={profilePictureUrl}
            onUpdated={setProfilePictureUrl}
            saveToAccount={false}
            compact
          />
        ) : null}
        {isPhone && otpSent ? (
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
        ) : null}
        {devCode ? <p className="text-xs text-muted">Código de prueba (dev): {devCode}</p> : null}
        <label className="block min-w-0 text-sm font-medium text-body">
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
            className="mt-1 w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-base text-body outline-none ring-accent focus:ring-2 sm:text-sm"
          />
        </label>
        <label className="block min-w-0 text-sm font-medium text-body">
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
            className="mt-1 w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-base text-body outline-none ring-accent focus:ring-2 sm:text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Creando…" : isPhone && !otpSent ? "Enviar código" : "Registrarme"}
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

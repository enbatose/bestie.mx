import { useState } from "react";
import { Link } from "react-router-dom";
import { PasswordField } from "@/components/PasswordField";
import { AuthIdentifierField } from "@/components/auth/AuthIdentifierField";
import { authLogin, authRegister, authPhoneOtpRequest, authPhoneRegister, needsEmailVerification, authMe } from "@/lib/authApi";
import { ProfilePictureUpload } from "@/components/ProfilePictureUpload";
import { AuthLegalConsent, AuthMethodDivider, SocialSignInButtons } from "@/components/GoogleSignInButton";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { identifyUser, track } from "@/lib/analytics";
import {
  AUTH_IDENTIFIER_INVALID_MESSAGE,
  classifyAuthIdentifier,
} from "@/lib/authIdentifier";
import {
  destinationAfterAuth,
  oauthReturnToFor,
} from "@/lib/postLoginRedirect";

export function AuthModal() {
  const { open, tab, redirectTo, close, openLogin, openRegister } = useAuthModal();
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

  if (!open) return null;

  const socialReturnTo = oauthReturnToFor(redirectTo);
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

  const submitLogin = async (e: React.FormEvent) => {
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
        await authLogin({ phone: id.phone, password });
        track("user_logged_in", { method: "phone" });
      } else {
        await authLogin({ email: id.email, password });
        track("user_logged_in", { method: "email" });
      }
      close();
      const me = await authMe().catch(() => null);
      if (me?.id) {
        identifyUser(me.id, { email: me.email, name: me.displayName, is_admin: me.isAdmin });
      }
      window.dispatchEvent(new Event("bestie:me-changed"));
      window.location.assign(
        await destinationAfterAuth(redirectTo, Boolean(me && needsEmailVerification(me))),
      );
    } catch (x) {
      setErr(x instanceof Error ? x.message : "No se pudo completar la acción.");
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async (e: React.FormEvent) => {
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
          identifyUser(me.id, { email: me.email, name: me.displayName, is_admin: me.isAdmin });
          track("user_signed_up", { method: "phone" });
        }
        close();
        window.dispatchEvent(new Event("bestie:me-changed"));
        window.location.assign(await destinationAfterAuth(redirectTo, false));
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
        identifyUser(me.id, { email: me.email, name: me.displayName, is_admin: me.isAdmin });
        track("user_signed_up", { method: "email" });
      }
      close();
      window.dispatchEvent(new Event("bestie:me-changed"));
      window.location.assign(await destinationAfterAuth(redirectTo, needsEmailVerification(me)));
    } catch (x) {
      setErr(x instanceof Error ? x.message : "No se pudo completar la acción.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2100] overflow-y-auto overscroll-y-contain bg-black/50 px-3 py-2 sm:px-4 sm:py-8"
      style={{
        paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center">
        <div
          className="mx-auto w-full min-w-0 max-w-md rounded-2xl border border-border bg-surface p-4 shadow-xl dark:border-slate-600 dark:bg-slate-900 sm:p-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id="auth-modal-title" className="min-w-0 break-words text-lg font-bold leading-tight text-primary">
              {tab === "login" ? "Iniciar sesión" : "Regístrate"}
            </h2>
            <button
              type="button"
              onClick={close}
              className="rounded-full px-2 py-1 text-sm text-muted hover:bg-surface-elevated"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 flex min-w-0 rounded-full border border-border bg-bg-light p-0.5 text-sm font-semibold">
            <button
              type="button"
              className={`min-w-0 flex-1 rounded-full py-1.5 ${tab === "login" ? "bg-surface text-primary shadow-sm" : "text-muted"}`}
              onClick={() => {
                openLogin();
                setErr(null);
                setPasswordConfirm("");
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              className={`min-w-0 flex-1 rounded-full py-1.5 ${tab === "register" ? "bg-surface text-primary shadow-sm" : "text-muted"}`}
              onClick={() => {
                openRegister();
                setErr(null);
                setPasswordConfirm("");
              }}
            >
              Registro
            </button>
          </div>

          {err ? <p className="mt-2 text-sm text-error">{err}</p> : null}

          <div className="mt-3">
            <SocialSignInButtons returnTo={socialReturnTo} onClick={close} />
          </div>
          <AuthLegalConsent action={tab === "register" ? "registrarte" : "continuar"} />
          <AuthMethodDivider />

          {tab === "login" ? (
            <form className="mt-3 space-y-2.5" onSubmit={submitLogin}>
              <AuthIdentifierField id="auth-modal-identifier" value={identifier} onChange={onIdentifierChange} />
              <label className="block min-w-0 text-sm font-medium text-body">
                Contraseña
                <PasswordField
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full min-w-0 rounded-xl border border-border bg-bg-light px-3 py-2 text-base text-body outline-none ring-accent focus:ring-2 sm:text-sm"
                />
              </label>
              <p className="text-right text-xs">
                <Link
                  to="/recuperar-contrasena"
                  onClick={close}
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </p>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg disabled:opacity-50"
              >
                {busy ? "Entrando…" : "Entrar"}
              </button>
            </form>
          ) : (
            <form className="mt-3 space-y-2" onSubmit={submitRegister}>
              <label className="block min-w-0 text-sm font-medium leading-snug text-body">
                Nombre
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-0.5 w-full min-w-0 rounded-xl border border-border bg-bg-light px-3 py-1.5 text-base text-body outline-none ring-accent focus:ring-2 sm:text-sm"
                />
              </label>
              <AuthIdentifierField id="auth-modal-reg-identifier" value={identifier} onChange={onIdentifierChange} />
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
                <label className="block min-w-0 text-sm font-medium leading-snug text-body">
                  Código SMS
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    size={6}
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="mt-0.5 w-full min-w-0 rounded-xl border border-border bg-bg-light px-3 py-1.5 text-base text-body outline-none ring-accent focus:ring-2 sm:text-sm"
                  />
                </label>
              ) : null}
              {devCode ? <p className="text-xs text-muted">Código de prueba (dev): {devCode}</p> : null}
              <label className="block min-w-0 text-sm font-medium leading-snug text-body">
                Contraseña (mín. 8)
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
                  className="mt-0.5 w-full min-w-0 rounded-xl border border-border bg-bg-light px-3 py-1.5 text-base text-body outline-none ring-accent focus:ring-2 sm:text-sm"
                />
              </label>
              <label className="block min-w-0 text-sm font-medium leading-snug text-body">
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
                  className="mt-0.5 w-full min-w-0 rounded-xl border border-border bg-bg-light px-3 py-1.5 text-base text-body outline-none ring-accent focus:ring-2 sm:text-sm"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-full bg-primary py-2 text-sm font-semibold text-primary-fg disabled:opacity-50"
              >
                {busy ? "Creando…" : isPhone && !otpSent ? "Enviar código" : "Crear cuenta"}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

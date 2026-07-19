import { useState } from "react";
import { Link } from "react-router-dom";
import { PasswordField } from "@/components/PasswordField";
import { AuthMethodDivider, SocialSignInButtons } from "@/components/GoogleSignInButton";
import { authLogin, authRegister, authMe, type AuthMe } from "@/lib/authApi";
import { setContactPendingDraft, type ContactPendingDraft } from "@/lib/contactSupportSession";
import { identifyUser, track } from "@/lib/analytics";

type AuthTab = "login" | "register";

const CONTACT_OAUTH_RETURN_TO = "/contacto?resume=1";

/**
 * Inline (non-reloading) sign-in/sign-up used only on Contacto, so the drafted subject/message and
 * any selected attachments survive authentication in memory. Google/Facebook still leave the page
 * (real OAuth redirect) — for that path we persist the text draft and ask the user to re-attach files.
 */
export function ContactInlineAuth({
  pendingDraft,
  onAuthenticated,
}: {
  pendingDraft: ContactPendingDraft;
  onAuthenticated: (me: AuthMe) => void;
}) {
  const [tab, setTab] = useState<AuthTab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const finishAuth = async (method: "email_login" | "email_register") => {
    const me = await authMe().catch(() => null);
    if (!me) throw new Error("No pudimos confirmar tu sesión. Intenta de nuevo.");
    identifyUser(me.id, { email: me.email, name: me.displayName, is_admin: me.isAdmin });
    track(method === "email_login" ? "user_logged_in" : "user_signed_up", { method: "email" });
    window.dispatchEvent(new Event("bestie:me-changed"));
    onAuthenticated(me);
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await authLogin({ email: email.trim().toLowerCase(), password });
      await finishAuth("email_login");
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
    setBusy(true);
    try {
      await authRegister({
        email: email.trim().toLowerCase(),
        password,
        displayName: displayName.trim() || undefined,
      });
      await finishAuth("email_register");
    } catch (x) {
      setErr(x instanceof Error ? x.message : "No se pudo completar la acción.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="mt-4 rounded-2xl border border-secondary/40 bg-secondary/10 p-4 sm:p-5"
      role="region"
      aria-label="Inicia sesión para enviar tu mensaje"
    >
      <p className="text-sm font-semibold text-primary">Inicia sesión para enviar tu mensaje</p>
      <p className="mt-1 text-xs text-muted">
        Así podemos responderte de forma personalizada dentro de tu chat con Bestie. Tu asunto y mensaje se
        conservan.
      </p>

      <div className="mt-3 flex rounded-full border border-border bg-bg-light p-0.5 text-sm font-semibold">
        <button
          type="button"
          className={`flex-1 rounded-full py-1.5 ${tab === "login" ? "bg-surface text-primary shadow-sm" : "text-muted"}`}
          onClick={() => {
            setTab("login");
            setErr(null);
            setPasswordConfirm("");
          }}
        >
          Entrar
        </button>
        <button
          type="button"
          className={`flex-1 rounded-full py-1.5 ${tab === "register" ? "bg-surface text-primary shadow-sm" : "text-muted"}`}
          onClick={() => {
            setTab("register");
            setErr(null);
            setPasswordConfirm("");
          }}
        >
          Registro
        </button>
      </div>

      {err ? (
        <p className="mt-2 text-sm text-error" role="alert">
          {err}
        </p>
      ) : null}

      <div className="mt-3">
        <SocialSignInButtons
          returnTo={CONTACT_OAUTH_RETURN_TO}
          onClick={() => setContactPendingDraft(pendingDraft)}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-muted">
        Con Google saldrás de esta página; al volver conservamos tu asunto y mensaje, pero deberás
        adjuntar tus imágenes de nuevo.
      </p>
      <AuthMethodDivider />

      {tab === "login" ? (
        <form className="space-y-2.5" onSubmit={submitLogin}>
          <label className="block text-sm font-medium text-body">
            Correo
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
            />
          </label>
          <label className="block text-sm font-medium text-body">
            Contraseña
            <PasswordField
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
            />
          </label>
          <p className="text-right text-xs">
            <Link
              to="/recuperar-contrasena"
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
            {busy ? "Entrando…" : "Entrar y enviar"}
          </button>
        </form>
      ) : (
        <form className="space-y-2" onSubmit={submitRegister}>
          <label className="block text-sm font-medium leading-snug text-body">
            Nombre
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-0.5 w-full rounded-xl border border-border bg-bg-light px-3 py-1.5 text-sm text-body outline-none ring-accent focus:ring-2"
            />
          </label>
          <label className="block text-sm font-medium leading-snug text-body">
            Correo
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-0.5 w-full rounded-xl border border-border bg-bg-light px-3 py-1.5 text-sm text-body outline-none ring-accent focus:ring-2"
            />
          </label>
          <label className="block text-sm font-medium leading-snug text-body">
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
              className="mt-0.5 w-full rounded-xl border border-border bg-bg-light px-3 py-1.5 text-sm text-body outline-none ring-accent focus:ring-2"
            />
          </label>
          <label className="block text-sm font-medium leading-snug text-body">
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
              className="mt-0.5 w-full rounded-xl border border-border bg-bg-light px-3 py-1.5 text-sm text-body outline-none ring-accent focus:ring-2"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-primary py-2 text-sm font-semibold text-primary-fg disabled:opacity-50"
          >
            {busy ? "Creando…" : "Crear cuenta y enviar"}
          </button>
        </form>
      )}
    </div>
  );
}

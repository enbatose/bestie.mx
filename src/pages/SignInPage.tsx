import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { PasswordField } from "@/components/PasswordField";
import { AuthLegalConsent, AuthMethodDivider, SocialSignInButtons } from "@/components/GoogleSignInButton";
import {
  authLinkPublisher,
  authLogin,
  authLogout,
  authMe,
  googleOAuthErrorMessage,
  needsEmailVerification,
  type AuthMe,
} from "@/lib/authApi";
import { identifyUser, resetAnalyticsUser, track } from "@/lib/analytics";
import {
  destinationAfterAuth,
  oauthReturnToFor,
  safeClientReturnTo,
} from "@/lib/postLoginRedirect";

export function SignInPage() {
  const location = useLocation();
  const registrationNotice = (location.state as { registrationNotice?: string } | null)?.registrationNotice;
  const navigate = useNavigate();
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    const fromQuery = safeClientReturnTo(new URLSearchParams(location.search).get("returnTo"));
    const fromState = safeClientReturnTo(
      (location.state as { returnTo?: string } | null)?.returnTo ?? null,
    );
    return oauthReturnToFor(fromQuery ?? fromState);
  }, [location.search, location.state]);

  const refreshMe = useCallback(async () => {
    try {
      setMe(await authMe());
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    const oauthErr = googleOAuthErrorMessage(new URLSearchParams(location.search).get("error"));
    if (oauthErr) setErr(oauthErr);
  }, [location.search]);

  const onEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setEmailBusy(true);
    try {
      await authLogin({ email: email.trim().toLowerCase(), password });
      await authLinkPublisher();
      setMsg("Sesión iniciada.");
      const session = await authMe().catch(() => null);
      if (session?.id) {
        identifyUser(session.id, {
          email: session.email,
          name: session.displayName,
          is_admin: session.isAdmin,
        });
        track("user_logged_in", { method: "email" });
      }
      await refreshMe();
      navigate(
        await destinationAfterAuth(redirectTo, Boolean(session && needsEmailVerification(session))),
        { replace: true },
      );
    } catch (x) {
      setErr(x instanceof Error ? x.message : "No se pudo completar la acción.");
    } finally {
      setEmailBusy(false);
    }
  };

  const onLogout = async () => {
    setErr(null);
    setMsg(null);
    await authLogout();
    track("user_logged_out", {});
    resetAnalyticsUser();
    await refreshMe();
  };

  if (me === undefined) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-14">
        <p className="text-sm text-muted">Cargando…</p>
      </div>
    );
  }

  if (me) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-14">
        <h1 className="text-2xl font-bold tracking-tight text-primary">Tu cuenta</h1>
        <p className="mt-2 text-sm text-muted">
          <span className="font-medium text-body">{me.displayName}</span>
          {me.email ? (
            <>
              {" "}
              · <span className="text-body">{me.email}</span>
            </>
          ) : null}
        </p>
        <p className="mt-4 text-sm text-muted">
          Publicadores vinculados: {me.linkedPublisherIds.length ? me.linkedPublisherIds.length : "ninguno aún"}{" "}
          (se agrega al publicar o al abrir un enlace desde Messenger).
        </p>
        <button
          type="button"
          onClick={() => void onLogout()}
          className="mt-8 w-full rounded-full border border-border py-2.5 text-sm font-semibold text-body transition hover:bg-surface-elevated"
        >
          Cerrar sesión
        </button>
        <p className="mt-8 text-sm text-muted">
          <Link to="/publicar" className="font-semibold text-primary underline-offset-2 hover:underline">
            Publicar
          </Link>
          {me.isAdmin ? (
            <>
              {" · "}
              <Link to="/admin" className="font-semibold text-primary underline-offset-2 hover:underline">
                Admin
              </Link>
            </>
          ) : null}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold tracking-tight text-primary">Entrar</h1>
      {registrationNotice ? (
        <p className="mt-3 rounded-xl border border-secondary/40 bg-secondary/10 p-3 text-xs text-body">
          {registrationNotice}
        </p>
      ) : null}
      <p className="mt-2 text-sm text-muted">
        Entra con Google o con correo y contraseña. La sesión usa cookies seguras con la API.
      </p>

      <div className="mt-6">
        <SocialSignInButtons returnTo={redirectTo} />
      </div>
      <AuthLegalConsent action="continuar" />
      <AuthMethodDivider />

      {msg ? (
        <p className="mt-4 rounded-xl border border-border bg-bg-light p-3 text-sm text-body">{msg}</p>
      ) : null}
      {err ? (
        <p className="mt-4 rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error">{err}</p>
      ) : null}

      <form className="mt-8 space-y-4" onSubmit={onEmailLogin}>
        <label className="block text-sm font-medium text-body">
          Correo
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
          />
        </label>
        <label className="block text-sm font-medium text-body">
          Contraseña
          <PasswordField
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
          />
        </label>
        <p className="text-right text-sm">
          <Link to="/recuperar-contrasena" className="font-semibold text-primary underline-offset-2 hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
        <button
          type="submit"
          disabled={emailBusy}
          className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
        >
          {emailBusy ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        ¿Sin cuenta?{" "}
        <Link to="/registro" className="font-semibold text-primary underline-offset-2 hover:underline">
          Crear cuenta
        </Link>
      </p>
      <p className="mt-4 text-sm text-muted">
        <Link to="/buscar" className="font-semibold text-primary underline-offset-2 hover:underline">
          Ir a buscar
        </Link>
      </p>
    </div>
  );
}

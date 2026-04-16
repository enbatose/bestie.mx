import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  authLinkPublisher,
  authLogin,
  authLogout,
  authMe,
  authResendVerification,
  authWhatsAppRequest,
  authWhatsAppVerify,
  AuthApiError,
  type AuthMe,
} from "@/lib/authApi";

export function SignInPage() {
  const location = useLocation() as { state?: { registrationNotice?: string } };
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);
  const [tab, setTab] = useState<"wa" | "email">("wa");

  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [waDevHint, setWaDevHint] = useState<string | null>(null);
  const [waBusy, setWaBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);
  const [loginUnverifiedEmail, setLoginUnverifiedEmail] = useState<string | null>(null);

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
    if (searchParams.get("verified") === "1") {
      setMsg("Correo verificado. Ahora inicia sesión con tu correo y contraseña.");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const onWaRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setWaDevHint(null);
    setWaBusy(true);
    try {
      const r = await authWhatsAppRequest(phone);
      if (!r.ok) {
        setErr(r.error + (r.retryAfterMs ? ` (reintento ~${Math.ceil(r.retryAfterMs / 1000)}s)` : ""));
        return;
      }
      if (r.devCode) {
        setWaDevHint(`Código de desarrollo: ${r.devCode}${r.message ? ` — ${r.message}` : ""}`);
      } else {
        setMsg("Si Meta está configurado en el servidor, recibirás el código por WhatsApp.");
      }
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Error");
    } finally {
      setWaBusy(false);
    }
  };

  const onWaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setWaBusy(true);
    try {
      await authWhatsAppVerify({ phone, code: otpCode });
      await authLinkPublisher();
      setMsg("Listo. Tu cuenta de WhatsApp quedó vinculada a esta sesión.");
      await refreshMe();
      navigate("/mis-anuncios", { replace: true });
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Error");
    } finally {
      setWaBusy(false);
    }
  };

  const onEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoginUnverifiedEmail(null);
    setEmailBusy(true);
    try {
      await authLogin({ email: email.trim().toLowerCase(), password });
      await authLinkPublisher();
      setMsg("Sesión iniciada.");
      await refreshMe();
      navigate("/mis-anuncios", { replace: true });
    } catch (x) {
      if (x instanceof AuthApiError && x.code === "email_not_verified") {
        setLoginUnverifiedEmail(email.trim().toLowerCase());
      }
      setErr(x instanceof Error ? x.message : "Error");
    } finally {
      setEmailBusy(false);
    }
  };

  const onLogout = async () => {
    setErr(null);
    setMsg(null);
    await authLogout();
    await refreshMe();
  };

  if (me === undefined) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-sm text-muted">Cargando…</p>
      </div>
    );
  }

  if (me) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-2xl font-bold tracking-tight text-primary">Tu cuenta</h1>
        {me.email && me.emailVerified !== true ? (
          <div className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
            <p>
              Tu correo aún no está verificado. Revisa tu bandeja (y spam). Si no recibiste el enlace, puedes
              reenviarlo.
            </p>
            <button
              type="button"
              disabled={resendBusy}
              className="rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-950 disabled:opacity-50"
              onClick={async () => {
                if (!me.email) return;
                setErr(null);
                setMsg(null);
                setResendBusy(true);
                try {
                  await authResendVerification(me.email);
                  setMsg("Listo. Si el correo está configurado en el servidor, te reenviamos el enlace.");
                } catch (x) {
                  setErr(x instanceof Error ? x.message : "Error");
                } finally {
                  setResendBusy(false);
                }
              }}
            >
              {resendBusy ? "Reenviando…" : "Reenviar correo de verificación"}
            </button>
          </div>
        ) : null}
        <p className="mt-2 text-sm text-muted">
          <span className="font-medium text-body">{me.displayName}</span>
          {me.email ? (
            <>
              {" "}
              · <span className="text-body">{me.email}</span>
            </>
          ) : null}
          {me.phoneE164 ? (
            <>
              {" "}
              · <span className="text-body">{me.phoneE164}</span>
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
          {" · "}
          <Link to="/grupos" className="font-semibold text-primary underline-offset-2 hover:underline">
            Grupos
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
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold tracking-tight text-primary">Entrar</h1>
      {location.state?.registrationNotice ? (
        <p className="mt-3 rounded-xl border border-secondary/40 bg-secondary/10 p-3 text-xs text-body">
          {location.state.registrationNotice}
        </p>
      ) : null}
      <p className="mt-2 text-sm text-muted">
        WhatsApp: código de 6 dígitos en el chat. Correo: enlace de verificación al registrarte; luego inicia sesión aquí.
        La sesión usa cookies seguras con la API.
      </p>

      <div className="mt-6 flex rounded-full border border-border bg-bg-light p-1 text-sm font-medium">
        <button
          type="button"
          className={`flex-1 rounded-full py-2 transition ${tab === "wa" ? "bg-surface text-primary shadow-sm" : "text-muted"}`}
          onClick={() => {
            setTab("wa");
            setLoginUnverifiedEmail(null);
          }}
        >
          WhatsApp
        </button>
        <button
          type="button"
          className={`flex-1 rounded-full py-2 transition ${tab === "email" ? "bg-surface text-primary shadow-sm" : "text-muted"}`}
          onClick={() => setTab("email")}
        >
          Correo
        </button>
      </div>

      {msg ? (
        <p className="mt-4 rounded-xl border border-border bg-bg-light p-3 text-sm text-body">{msg}</p>
      ) : null}
      {err ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>
      ) : null}

      {tab === "wa" ? (
        <div className="mt-6 space-y-6">
          <form className="space-y-4" onSubmit={onWaRequest}>
            <label className="block text-sm font-medium text-body">
              Celular (México)
              <input
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+52 33 … o 10 dígitos"
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
              />
            </label>
            <button
              type="submit"
              disabled={waBusy}
              className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
            >
              {waBusy ? "Enviando…" : "Enviar código por WhatsApp"}
            </button>
          </form>
          {waDevHint ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{waDevHint}</p>
          ) : null}
          <form className="space-y-4 border-t border-border pt-6" onSubmit={onWaVerify}>
            <label className="block text-sm font-medium text-body">
              Código de 6 dígitos
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
              />
            </label>
            <button
              type="submit"
              disabled={waBusy || otpCode.length !== 6}
              className="w-full rounded-full border border-border py-2.5 text-sm font-semibold text-body transition hover:bg-surface-elevated disabled:opacity-50"
            >
              Verificar y entrar
            </button>
          </form>
        </div>
      ) : (
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
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
            />
          </label>
          <button
            type="submit"
            disabled={emailBusy}
            className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
          >
            {emailBusy ? "Entrando…" : "Entrar"}
          </button>
          {loginUnverifiedEmail ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <p className="font-medium">¿No llegó el correo?</p>
              <button
                type="button"
                disabled={resendBusy}
                className="mt-2 w-full rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-950 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-50"
                onClick={async () => {
                  setErr(null);
                  setMsg(null);
                  setResendBusy(true);
                  try {
                    await authResendVerification(loginUnverifiedEmail);
                    setMsg("Listo. Si SMTP está configurado en el servidor, te reenviamos el enlace (revisa spam).");
                  } catch (x) {
                    setErr(x instanceof Error ? x.message : "Error");
                  } finally {
                    setResendBusy(false);
                  }
                }}
              >
                {resendBusy ? "Reenviando…" : "Reenviar enlace de verificación"}
              </button>
            </div>
          ) : null}
        </form>
      )}

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

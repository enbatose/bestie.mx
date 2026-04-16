import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authLogin, authRegister, authResendVerification, AuthApiError } from "@/lib/authApi";
import { useAuthModal } from "@/contexts/AuthModalContext";

export function AuthModal() {
  const navigate = useNavigate();
  const { open, tab, close, openLogin, openRegister } = useAuthModal();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loginNeedsVerify, setLoginNeedsVerify] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendOk, setResendOk] = useState<string | null>(null);

  if (!open) return null;

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setResendOk(null);
    setLoginNeedsVerify(false);
    setBusy(true);
    try {
      await authLogin({ email: email.trim().toLowerCase(), password });
      close();
      window.location.assign("/mis-anuncios");
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Error");
      setLoginNeedsVerify(x instanceof AuthApiError && x.code === "email_not_verified");
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await authRegister({
        email: email.trim().toLowerCase(),
        password,
        displayName: displayName.trim() || undefined,
      });
      if (r.verificationPending) {
        const registrationNotice = r.devVerificationUrl
          ? `Cuenta creada. Verifica tu correo (dev): ${r.devVerificationUrl}`
          : "Cuenta creada. Te enviamos un enlace de verificación. Ábrelo y luego entra con tu correo y contraseña.";
        close();
        navigate("/entrar", { replace: true, state: { registrationNotice } });
        return;
      }
      if (!r.me) throw new Error("register_session_missing");
      close();
      window.location.assign("/mis-anuncios");
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-xl dark:border-slate-600 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <h2 id="auth-modal-title" className="text-lg font-bold text-primary">
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

        <div className="mt-4 flex rounded-full border border-border bg-bg-light p-1 text-sm font-semibold">
          <button
            type="button"
            className={`flex-1 rounded-full py-2 ${tab === "login" ? "bg-surface text-primary shadow-sm" : "text-muted"}`}
            onClick={() => {
              openLogin();
              setErr(null);
              setLoginNeedsVerify(false);
              setResendOk(null);
            }}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`flex-1 rounded-full py-2 ${tab === "register" ? "bg-surface text-primary shadow-sm" : "text-muted"}`}
            onClick={() => {
              openRegister();
              setErr(null);
              setLoginNeedsVerify(false);
              setResendOk(null);
            }}
          >
            Registro
          </button>
        </div>

        {err ? <p className="mt-3 text-sm text-error">{err}</p> : null}
        {resendOk ? <p className="mt-2 text-xs text-muted">{resendOk}</p> : null}

        {tab === "login" ? (
          <form className="mt-4 space-y-3" onSubmit={submitLogin}>
            <label className="block text-sm font-medium text-body">
              Correo
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
              />
            </label>
            <label className="block text-sm font-medium text-body">
              Contraseña
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg disabled:opacity-50"
            >
              {busy ? "Entrando…" : "Entrar"}
            </button>
            {loginNeedsVerify ? (
              <button
                type="button"
                disabled={resendBusy || !email.trim()}
                className="w-full rounded-full border border-border py-2 text-xs font-semibold text-body disabled:opacity-50"
                onClick={async () => {
                  setResendOk(null);
                  setResendBusy(true);
                  try {
                    await authResendVerification(email.trim().toLowerCase());
                    setResendOk("Si el servidor tiene SMTP configurado, revisa tu correo (y spam).");
                  } catch (x) {
                    setErr(x instanceof Error ? x.message : "Error");
                  } finally {
                    setResendBusy(false);
                  }
                }}
              >
                {resendBusy ? "Enviando…" : "Reenviar enlace de verificación"}
              </button>
            ) : null}
          </form>
        ) : (
          <form className="mt-4 space-y-3" onSubmit={submitRegister}>
            <label className="block text-sm font-medium text-body">
              Nombre
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
              />
            </label>
            <label className="block text-sm font-medium text-body">
              Correo
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
              />
            </label>
            <label className="block text-sm font-medium text-body">
              Contraseña (mín. 8)
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg disabled:opacity-50"
            >
              {busy ? "Creando…" : "Crear cuenta"}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-muted">
          WhatsApp OTP y más opciones en{" "}
          <Link to="/entrar" className="font-semibold text-primary underline" onClick={close}>
            la página completa
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { authLogin, authRegister, isAuthApiConfigured } from "@/lib/authApi";
import { useAuthModal } from "@/contexts/AuthModalContext";

export function AuthModal() {
  const { open, tab, close, openLogin, openRegister } = useAuthModal();
  const apiOn = isAuthApiConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!apiOn) {
      setErr("Configura VITE_API_URL.");
      return;
    }
    setBusy(true);
    try {
      await authLogin({ email: email.trim().toLowerCase(), password });
      close();
      window.location.assign("/mis-anuncios");
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!apiOn) {
      setErr("Configura VITE_API_URL.");
      return;
    }
    setBusy(true);
    try {
      await authRegister({
        email: email.trim().toLowerCase(),
        password,
        displayName: displayName.trim() || undefined,
      });
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
            }}
          >
            Registro
          </button>
        </div>

        {err ? <p className="mt-3 text-sm text-error">{err}</p> : null}

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

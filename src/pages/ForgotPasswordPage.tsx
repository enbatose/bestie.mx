import { useState } from "react";
import { Link } from "react-router-dom";
import { authForgotPassword } from "@/lib/authApi";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-md px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold tracking-tight text-primary">Recuperar contraseña</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Escribe el correo de tu cuenta. Si existe, te enviaremos un enlace para restablecer la contraseña en tu perfil.
        Revisa también la carpeta de <span className="font-medium text-body">spam</span> o{" "}
        <span className="font-medium text-body">promociones</span>.
      </p>

      {sent ? (
        <div className="mt-6 rounded-xl border border-secondary/40 bg-secondary/10 p-4 text-sm text-body">
          <p className="font-medium">Revisa tu correo</p>
          <p className="mt-2">
            Si hay una cuenta con <span className="font-medium">{email.trim().toLowerCase()}</span>, enviamos un enlace
            para restablecer la contraseña.
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
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Enviando…" : "Enviar enlace"}
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

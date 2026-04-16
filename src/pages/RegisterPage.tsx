import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authRegister } from "@/lib/authApi";

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-md px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold tracking-tight text-primary">Crear cuenta</h1>
      <p className="mt-2 text-sm text-muted">
        Correo y contraseña (mínimo 8 caracteres). Recibirás un enlace para validar el correo; después podrás entrar.
      </p>

      {err ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>
      ) : null}
      <form
        className="mt-8 space-y-4"
        onSubmit={async (e) => {
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
              let registrationNotice = r.devVerificationUrl
                ? `Cuenta creada. Verifica tu correo con este enlace (solo desarrollo): ${r.devVerificationUrl}`
                : "Cuenta creada. Te enviamos un enlace de verificación al correo (revisa spam). Ábrelo y luego vuelve aquí para iniciar sesión.";
              if (r.emailDispatch === "failed") {
                registrationNotice = `Cuenta creada, pero el correo no se pudo enviar: ${r.emailError ?? "error SMTP"}. Revisa en el servidor SMTP_SERVICE=gmail, SMTP_USER y contraseña de aplicación; consulta GET /api/health (campo smtp).`;
              } else if (r.emailDispatch === "skipped_no_smtp") {
                registrationNotice = r.smtpSetupHint
                  ? `Cuenta creada, pero el API no tiene correo saliente configurado. ${r.smtpSetupHint}`
                  : "Cuenta creada, pero el servidor no tiene SMTP configurado: no se envió ningún correo. Configura Gmail u otro SMTP en las variables de entorno del **servicio Node** (no en el build del sitio estático).";
              }
              navigate("/entrar", { replace: true, state: { registrationNotice } });
              return;
            }
            const { me, devVerificationUrl } = r;
            if (!me) throw new Error("register_session_missing");
            const registrationNotice = devVerificationUrl
              ? `Verifica tu correo con este enlace (entorno no productivo): ${devVerificationUrl}`
              : me.email && !me.emailVerified
                ? "Te enviamos un enlace de verificación al correo (revisa spam)."
                : undefined;
            navigate("/entrar", { replace: true, state: registrationNotice ? { registrationNotice } : undefined });
          } catch (x) {
            setErr(x instanceof Error ? x.message : "Error");
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
        <label className="block text-sm font-medium text-body">
          Correo
          <input
            type="email"
            required
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
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Creando…" : "Registrarme"}
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

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PasswordField } from "@/components/PasswordField";
import { authRegister } from "@/lib/authApi";

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-md px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold tracking-tight text-primary">Crear cuenta</h1>
      <p className="mt-2 text-sm text-muted">
        Correo y contraseña (mínimo 8 caracteres). Debes escribir la contraseña dos veces; no se puede pegar en la
        confirmación. Al terminar iniciarás sesión de inmediato.
      </p>

      {err ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>
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
          setBusy(true);
          try {
            await authRegister({
              email: email.trim().toLowerCase(),
              password,
              displayName: displayName.trim() || undefined,
            });
            navigate("/mis-anuncios", { replace: true });
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

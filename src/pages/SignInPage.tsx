import { useState } from "react";
import { Link } from "react-router-dom";

export function SignInPage() {
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold tracking-tight text-primary">Entrar</h1>
      <p className="mt-2 text-sm text-muted">
        v1 prevé <span className="font-medium text-body">WhatsApp OTP</span> como método principal
        y correo + contraseña como respaldo. Aquí solo está el flujo UI (sin backend).
      </p>

      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSent(true);
        }}
      >
        <label className="block text-sm font-medium text-body">
          Celular (México)
          <input
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+52 33 …"
            className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110"
        >
          Enviar código por WhatsApp
        </button>
      </form>

      {sent ? (
        <p className="mt-4 rounded-xl border border-border bg-bg-light p-3 text-sm text-muted">
          En producción aquí iría la verificación con Meta. Por ahora no se envía nada.
        </p>
      ) : null}

      <p className="mt-8 text-sm text-muted">
        ¿Buscas cuarto?{" "}
        <Link to="/buscar" className="font-semibold text-primary underline-offset-2 hover:underline">
          Ir a buscar
        </Link>
      </p>
    </div>
  );
}

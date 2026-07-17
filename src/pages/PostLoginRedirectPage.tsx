import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authMe } from "@/lib/authApi";
import { resolvePostLoginPath } from "@/lib/postLoginRedirect";

/** Landing after OAuth / generic login — routes publishers vs seekers. */
export function PostLoginRedirectPage() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const me = await authMe();
        if (!me) {
          if (!cancelled) navigate("/entrar", { replace: true });
          return;
        }
        const dest = await resolvePostLoginPath();
        if (!cancelled) navigate(dest, { replace: true });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (failed) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-2xl font-bold tracking-tight text-primary">No pudimos continuar</h1>
        <p className="mt-2 text-sm text-muted">Intenta de nuevo o ve a tus búsquedas guardadas.</p>
        <Link
          to="/mis-busquedas"
          className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg"
        >
          Ir a Mis búsquedas
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-sm text-muted">Entrando…</p>
    </div>
  );
}

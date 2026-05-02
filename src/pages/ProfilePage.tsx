import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authMe, type AuthMe } from "@/lib/authApi";

export function ProfilePage() {
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);

  const load = useCallback(async () => {
    setMe(await authMe().catch(() => null));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (me === undefined) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-sm text-muted">Cargando…</p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-bold text-primary">Perfil</h1>
        <p className="mt-2 text-sm text-muted">Inicia sesión para ver tu cuenta.</p>
        <Link
          to="/entrar"
          className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg"
        >
          Entrar
        </Link>
      </div>
    );
  }

  const hasEmail = Boolean(me.email);
  const phoneOk = Boolean(me.phoneE164);

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:py-14">
      <h1 className="text-2xl font-bold text-primary">Perfil</h1>
      <p className="mt-2 text-sm text-muted">
        Hola, <span className="font-medium text-body">{me.displayName}</span>. Aquí ves el estado de tu cuenta y tus
        datos de confianza.
      </p>

      <ul className="mt-8 space-y-3 rounded-2xl border border-border bg-surface p-4 text-sm">
        <li className="flex items-center justify-between gap-2">
          <span className="text-body">Correo</span>
          <span className="text-muted">{me.email ?? "— (cuenta solo WhatsApp)"}</span>
        </li>
        <li className="flex items-center justify-between gap-2">
          <span className="text-body">Correo verificado</span>
          {hasEmail ? (
            <span className="text-primary">Listo</span>
          ) : (
            <span className="text-muted">— (cuenta solo WhatsApp)</span>
          )}
        </li>
        <li className="flex items-center justify-between gap-2">
          <span className="text-body">WhatsApp en cuenta</span>
          {phoneOk ? (
            <span className="truncate text-muted">{me.phoneE164}</span>
          ) : (
            <Link
              to="/entrar?tab=wa"
              className="inline-flex rounded-full bg-error/15 px-2 py-0.5 text-xs font-semibold text-error underline-offset-2 transition hover:bg-error/25 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Agregar
            </Link>
          )}
        </li>
        <li className="flex items-center justify-between gap-2">
          <span className="text-body">Publicadores vinculados</span>
          <span className="text-muted">{me.linkedPublisherIds.length}</span>
        </li>
      </ul>

      {!phoneOk ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">Completa tu perfil</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
            <li>
              Vincula WhatsApp desde{" "}
              <Link to="/entrar?tab=wa" className="font-semibold underline">
                Entrar → pestaña WhatsApp
              </Link>
              .
            </li>
          </ul>
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/perfil/editar"
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-body hover:bg-surface-elevated"
        >
          Editar datos
        </Link>
        <Link
          to="/mis-anuncios"
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-body hover:bg-surface-elevated"
        >
          Mis anuncios
        </Link>
        <Link
          to="/publicar"
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:brightness-110"
        >
          Publicar anuncio
        </Link>
        <Link to="/entrar" className="rounded-full px-4 py-2 text-sm font-semibold text-primary underline-offset-2">
          Ajustes de sesión
        </Link>
      </div>
    </div>
  );
}

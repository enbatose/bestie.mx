import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import type { AuthMe } from "@/lib/authApi";
import { useAuthModal } from "@/contexts/AuthModalContext";

function navClass({ isActive }: { isActive: boolean }) {
  return [
    "rounded-lg px-3 py-2 text-sm font-medium transition",
    isActive
      ? "bg-surface-elevated text-primary ring-1 ring-border"
      : "text-body hover:bg-surface-elevated",
  ].join(" ");
}

type Props = {
  me: AuthMe | null | undefined;
  profileIncomplete: boolean;
  unreadCount: number;
};

export function HeaderMegaMenu({ me, profileIncomplete, unreadCount }: Props) {
  const { openLogin, openRegister } = useAuthModal();
  const [megaOpen, setMegaOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const megaRef = useRef<HTMLDivElement>(null);

  const dismissNav = useCallback(() => {
    setMegaOpen(false);
    setMobileOpen(false);
  }, []);

  useEffect(() => {
    if (!megaOpen) return;
    const close = (e: MouseEvent) => {
      if (megaRef.current && !megaRef.current.contains(e.target as Node)) setMegaOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [megaOpen]);

  const linkCol = "flex flex-col gap-1";
  const h = "text-xs font-semibold uppercase tracking-wide text-muted";

  const megaPanel = (
    <div className="grid gap-6 sm:grid-cols-3">
      <div className={linkCol}>
        <p className={h}>Explorar</p>
        <NavLink to="/buscar" className={navClass} onClick={dismissNav}>
          Buscar
        </NavLink>
        <NavLink to="/faq" className={navClass} onClick={dismissNav}>
          FAQ
        </NavLink>
      </div>
      <div className={linkCol}>
        <p className={h}>Publicar</p>
        <NavLink to="/publicar" className={navClass} onClick={dismissNav}>
          Publicar anuncio
        </NavLink>
        <NavLink to="/mis-anuncios" className={navClass} onClick={dismissNav}>
          Mis anuncios
        </NavLink>
        {me?.id ? (
          <>
            <NavLink to="/grupos" className={navClass} onClick={dismissNav}>
              Grupos
            </NavLink>
            <NavLink to="/perfil" className={navClass} onClick={dismissNav}>
              <span className="inline-flex items-center gap-1">
                Perfil
                {profileIncomplete ? (
                  <span className="rounded-full bg-error px-1.5 py-0.5 text-[9px] font-bold text-white">!</span>
                ) : null}
              </span>
            </NavLink>
            <NavLink to="/mensajes" className={navClass} onClick={dismissNav}>
              <span className="inline-flex items-center gap-1">
                Mensajes
                {unreadCount > 0 ? (
                  <span className="rounded-full bg-error px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </span>
            </NavLink>
            {me.isAdmin ? (
              <NavLink to="/admin" className={navClass} onClick={dismissNav}>
                Admin
              </NavLink>
            ) : null}
          </>
        ) : (
          <>
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-left text-sm font-medium text-body hover:bg-surface-elevated"
              onClick={() => {
                dismissNav();
                openRegister();
              }}
            >
              Registro (modal)
            </button>
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-left text-sm font-medium text-body hover:bg-surface-elevated"
              onClick={() => {
                dismissNav();
                openLogin();
              }}
            >
              Entrar (modal)
            </button>
          </>
        )}
      </div>
      <div className={linkCol}>
        <p className={h}>Ayuda</p>
        <NavLink to="/contacto" className={navClass} onClick={dismissNav}>
          Contacto
        </NavLink>
        <NavLink to="/legal" className={navClass} onClick={dismissNav}>
          Legal
        </NavLink>
        <Link
          to="/entrar"
          className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-surface-elevated"
          onClick={dismissNav}
        >
          Página completa entrar
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: primary row + mega */}
      <div className="hidden flex-wrap items-center justify-end gap-1 md:flex lg:gap-2">
        <NavLink to="/buscar" className={navClass}>
          Buscar
        </NavLink>
        <NavLink to="/publicar" className={navClass}>
          Publicar
        </NavLink>
        <NavLink to="/mis-anuncios" className={navClass}>
          Mis anuncios
        </NavLink>
        {me?.id ? (
          <>
            <span className="hidden text-sm text-muted lg:inline">
              Hola, <span className="font-semibold text-body">{me.displayName.split(/\s+/)[0] ?? "…"}</span>
            </span>
            <NavLink to="/perfil" className={navClass}>
              <span className="inline-flex items-center gap-1">
                Perfil
                {profileIncomplete ? (
                  <span className="rounded-full bg-error px-1.5 py-0.5 text-[9px] font-bold text-white">!</span>
                ) : null}
              </span>
            </NavLink>
            <NavLink to="/mensajes" className={navClass}>
              <span className="inline-flex items-center gap-1">
                Mensajes
                {unreadCount > 0 ? (
                  <span className="rounded-full bg-error px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </span>
            </NavLink>
            <NavLink to="/grupos" className={navClass}>
              Grupos
            </NavLink>
            {me.isAdmin ? (
              <NavLink to="/admin" className={navClass}>
                Admin
              </NavLink>
            ) : null}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={openRegister}
              className="rounded-full px-3 py-2 text-sm font-semibold text-primary hover:bg-surface-elevated"
            >
              Registro
            </button>
            <button
              type="button"
              onClick={openLogin}
              className="rounded-full border border-border px-3 py-2 text-sm font-semibold text-body hover:bg-surface-elevated"
            >
              Entrar
            </button>
          </>
        )}
        <div className="relative" ref={megaRef}>
          <button
            type="button"
            onClick={() => setMegaOpen((v) => !v)}
            className="rounded-full border border-border bg-bg-light px-4 py-2 text-sm font-bold text-body hover:bg-surface-elevated dark:border-slate-600"
          >
            Menú ▾
          </button>
          {megaOpen ? (
            <div className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,640px)] rounded-2xl border border-border bg-surface p-5 shadow-xl dark:border-slate-600 dark:bg-slate-900">
              {megaPanel}
            </div>
          ) : null}
        </div>
        {me?.id ? (
          <Link
            to="/entrar"
            className="rounded-full border border-border px-3 py-2 text-sm font-semibold text-body hover:bg-surface-elevated"
          >
            Sesión
          </Link>
        ) : null}
      </div>

      {/* Mobile: hamburger + sheet */}
      <div className="flex items-center gap-2 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg border border-border bg-bg-light px-3 py-2 text-sm font-bold text-body dark:border-slate-600"
          aria-expanded={mobileOpen}
        >
          ☰ Menú
        </button>
        {me?.id ? (
          <NavLink to="/mensajes" className="relative rounded-full border border-border px-3 py-2 text-xs font-semibold">
            Msgs
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </NavLink>
        ) : null}
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[90] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Cerrar menú"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute right-0 top-0 flex h-full w-[min(100%,320px)] flex-col border-l border-border bg-surface p-4 shadow-xl dark:border-slate-600 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-primary">Bestie</span>
              <button type="button" className="text-muted" onClick={() => setMobileOpen(false)}>
                ✕
              </button>
            </div>
            {!me?.id ? (
              <div className="mt-4 flex flex-col gap-2 border-b border-border pb-4 dark:border-slate-600">
                <Link
                  to="/entrar"
                  className="rounded-xl bg-primary py-3 text-center text-sm font-semibold text-primary-fg transition hover:brightness-110"
                  onClick={() => setMobileOpen(false)}
                >
                  Entrar
                </Link>
                <Link
                  to="/registro"
                  className="rounded-xl border border-border bg-bg-light py-3 text-center text-sm font-semibold text-body transition hover:bg-surface-elevated dark:border-slate-600 dark:bg-slate-800"
                  onClick={() => setMobileOpen(false)}
                >
                  Crear cuenta
                </Link>
              </div>
            ) : null}
            <div className="mt-4 flex-1 overflow-y-auto overscroll-contain">
              {megaPanel}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

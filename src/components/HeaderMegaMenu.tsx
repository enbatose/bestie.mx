import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, ChevronDown, CirclePlus, MessageSquare, Search } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import type { AuthMe } from "@/lib/authApi";
import { authLogout } from "@/lib/authApi";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserAvatar } from "@/components/UserAvatar";

function navClass({ isActive }: { isActive: boolean }) {
  return [
    "rounded-lg px-3 py-2 text-sm font-medium transition",
    isActive
      ? "bg-surface-elevated text-primary ring-1 ring-border"
      : "text-body hover:bg-surface-elevated",
  ].join(" ");
}

const dropItem =
  "block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-body transition hover:bg-surface-elevated";
const dropBtn =
  "block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-body transition hover:bg-surface-elevated";

function NavIconLabel({
  icon: Icon,
  label,
  iconClassName = "h-4 w-4",
}: {
  icon: typeof Search;
  label: string;
  iconClassName?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className={`shrink-0 ${iconClassName}`} aria-hidden />
      {label}
    </span>
  );
}

const iconBtnClass =
  "relative inline-flex items-center justify-center rounded-lg p-2 text-body transition hover:bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function UnreadDot() {
  return (
    <span
      className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-error ring-2 ring-surface"
      aria-hidden
    />
  );
}

type MockNotification = {
  id: string;
  text: string;
  to: string;
};

const MOCK_NOTIFICATIONS: MockNotification[] = [
  {
    id: "created-room-americana",
    text: "Tu nuevo anuncio de Cuarto 'Cuarto en la Americana' se ha creado exitosamente, no olvides publicarlo.",
    to: "/publicar/vista-previa?listing=cuarto-americana",
  },
  {
    id: "created-property-providencia",
    text: "Tu nuevo anuncio de Propiedad 'Casa en Providencia' se ha creado exitosamente, no olvides publicarlo.",
    to: "/publicar/vista-previa?listing=casa-providencia",
  },
  {
    id: "published-room-americana",
    text: "Has publicado exitosamente tu anuncio de Cuarto 'Cuarto en la Americana'.",
    to: "/publicar/vista-previa?listing=cuarto-americana",
  },
  {
    id: "reminder-room-americana",
    text: "Tu anuncio 'Cuarto en la Americana' lleva 3 días creado sin publicarse. ¡Publícalo hoy!",
    to: "/publicar/vista-previa?listing=cuarto-americana",
  },
];

function LoggedInIconActions({
  unreadCount,
  notificationsOpen,
  onToggleNotifications,
  notificationsRef,
  onDismiss,
}: {
  unreadCount: number;
  notificationsOpen: boolean;
  onToggleNotifications: () => void;
  notificationsRef: React.RefObject<HTMLDivElement | null>;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <NavLink
        to="/mensajes"
        className={iconBtnClass}
        aria-label={
          unreadCount > 0 ? `Mensajes (${unreadCount > 99 ? "99+" : unreadCount} sin leer)` : "Mensajes (sin leer)"
        }
      >
        <span className="relative inline-flex">
          <MessageSquare className="h-5 w-5 shrink-0" aria-hidden />
          <UnreadDot />
        </span>
      </NavLink>

      <div className="relative" ref={notificationsRef}>
        <button
          type="button"
          onClick={onToggleNotifications}
          className={`${iconBtnClass} gap-0.5 px-1.5`}
          aria-expanded={notificationsOpen}
          aria-haspopup="menu"
          aria-label="Notificaciones"
        >
          <span className="relative inline-flex">
            <Bell className="h-5 w-5 shrink-0" aria-hidden />
            <UnreadDot />
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
        </button>
        {notificationsOpen ? (
          <div className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,22rem)] rounded-2xl border border-border bg-surface shadow-xl dark:border-slate-600 dark:bg-slate-900">
            <p className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted dark:border-slate-600">
              Notificaciones
            </p>
            <ul className="max-h-80 overflow-y-auto p-1">
              {MOCK_NOTIFICATIONS.slice(0, 5).map((n) => (
                <li key={n.id}>
                  <Link
                    to={n.to}
                    onClick={onDismiss}
                    className="block rounded-lg px-3 py-2.5 text-sm leading-snug text-body transition hover:bg-surface-elevated"
                  >
                    {n.text}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AvatarTrigger({
  me,
  size = "md",
  showChevron = false,
}: {
  me: AuthMe | null | undefined;
  size?: "sm" | "md";
  showChevron?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <UserAvatar displayName={me?.displayName} profilePictureUrl={me?.profilePictureUrl} size={size} />
      {showChevron ? (
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
      ) : null}
    </span>
  );
}

type Props = {
  me: AuthMe | null | undefined;
  profileIncomplete: boolean;
  unreadCount: number;
  onAuthChange?: () => void;
};

export function HeaderMegaMenu({ me, profileIncomplete, unreadCount, onAuthChange }: Props) {
  const navigate = useNavigate();
  const { openLogin } = useAuthModal();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const dismissNav = useCallback(() => {
    setMenuOpen(false);
    setAvatarOpen(false);
    setNotificationsOpen(false);
    setMobileOpen(false);
  }, []);

  useEffect(() => {
    if (!menuOpen && !avatarOpen && !notificationsOpen) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuOpen && menuRef.current && !menuRef.current.contains(t)) setMenuOpen(false);
      if (avatarOpen && avatarRef.current && !avatarRef.current.contains(t)) setAvatarOpen(false);
      if (notificationsOpen && notificationsRef.current && !notificationsRef.current.contains(t)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen, avatarOpen, notificationsOpen]);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  const onLogout = async () => {
    dismissNav();
    await authLogout();
    onAuthChange?.();
    navigate("/");
  };

  const menuLinks = (
    <>
      <NavLink to="/faq" className={navClass} onClick={dismissNav}>
        FAQ
      </NavLink>
      {me?.id ? (
        <>
          <NavLink to="/mis-anuncios" className={navClass} onClick={dismissNav}>
            Mis anuncios
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
        </>
      ) : null}
      <div className="px-1 py-1">
        <ThemeToggle />
      </div>
      <a
        href="mailto:soporte@bestie.mx"
        className={dropItem}
        onClick={dismissNav}
      >
        Contacto
      </a>
      <NavLink to="/legal" className={navClass} onClick={dismissNav}>
        Legal
      </NavLink>
    </>
  );

  const menuDropdown = (
    <div className="flex min-w-[12rem] flex-col gap-0.5 p-1">{menuLinks}</div>
  );

  const avatarDropdown = me?.id ? (
    <div className="flex min-w-[12rem] flex-col gap-0.5 p-1">
      <NavLink to="/perfil" className={navClass} onClick={dismissNav}>
        <span className="inline-flex items-center gap-1">
          Mi Perfil
          {profileIncomplete ? (
            <span className="rounded-full bg-error px-1.5 py-0.5 text-[9px] font-bold text-white">!</span>
          ) : null}
        </span>
      </NavLink>
      {me.isAdmin ? (
        <NavLink to="/admin" className={navClass} onClick={dismissNav}>
          Admin
        </NavLink>
      ) : null}
      <button type="button" className={dropBtn} onClick={() => void onLogout()}>
        Cerrar sesión
      </button>
    </div>
  ) : (
    <div className="flex min-w-[12rem] flex-col gap-0.5 p-1">
      <button
        type="button"
        className={dropBtn}
        onClick={() => {
          dismissNav();
          openLogin();
        }}
      >
        Iniciar sesión / Registrarse
      </button>
    </div>
  );

  const mobileSheet = (
    <div className="fixed inset-0 z-[90] md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Cerrar menú"
        onClick={() => setMobileOpen(false)}
      />
      <div
        className="absolute right-0 top-0 flex h-dvh w-[min(100%,320px)] flex-col border-l border-border bg-surface p-4 shadow-xl dark:border-slate-600 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-label="Menú principal"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-primary">Bestie</span>
          <button type="button" className="text-muted" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)}>
            ✕
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-1 border-b border-border pb-4 dark:border-slate-600">
          <NavLink to="/buscar" className={navClass} onClick={dismissNav}>
            <NavIconLabel icon={Search} label="Buscar" />
          </NavLink>
          <NavLink to="/publicar" className={navClass} onClick={dismissNav}>
            <NavIconLabel icon={CirclePlus} label="Publicar" />
          </NavLink>
        </div>
        <div className="mt-4 flex-1 overflow-y-auto overscroll-contain">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted">Menú</p>
          {menuLinks}
        </div>
        <div className="mt-4 border-t border-border pt-4 dark:border-slate-600">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted">Cuenta</p>
          {me?.id ? (
            <div className="flex flex-col gap-0.5">
              <Link to="/perfil" className={dropItem} onClick={dismissNav}>
                <span className="inline-flex items-center gap-2">
                  <UserAvatar
                    displayName={me.displayName}
                    profilePictureUrl={me.profilePictureUrl}
                    size="sm"
                  />
                  Mi Perfil
                  {profileIncomplete ? (
                    <span className="rounded-full bg-error px-1.5 py-0.5 text-[9px] font-bold text-white">!</span>
                  ) : null}
                </span>
              </Link>
              {me.isAdmin ? (
                <NavLink to="/admin" className={navClass} onClick={dismissNav}>
                  Admin
                </NavLink>
              ) : null}
              <button type="button" className={dropBtn} onClick={() => void onLogout()}>
                Cerrar sesión
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={dropBtn}
              onClick={() => {
                dismissNav();
                openLogin();
              }}
            >
              Iniciar sesión / Registrarse
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden items-center justify-end gap-1 md:flex lg:gap-2">
        <NavLink to="/buscar" className={navClass}>
          <NavIconLabel icon={Search} label="Buscar" />
        </NavLink>
        <NavLink to="/publicar" className={navClass}>
          <NavIconLabel icon={CirclePlus} label="Publicar" />
        </NavLink>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => {
              setAvatarOpen(false);
              setNotificationsOpen(false);
              setMenuOpen((v) => !v);
            }}
            className="rounded-full border border-border bg-bg-light px-4 py-2 text-sm font-bold text-body hover:bg-surface-elevated dark:border-slate-600"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            Menú ▾
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-full z-50 mt-2 rounded-2xl border border-border bg-surface shadow-xl dark:border-slate-600 dark:bg-slate-900">
              {menuDropdown}
            </div>
          ) : null}
        </div>

        {me?.id ? (
          <LoggedInIconActions
            unreadCount={unreadCount}
            notificationsOpen={notificationsOpen}
            onToggleNotifications={() => {
              setMenuOpen(false);
              setAvatarOpen(false);
              setNotificationsOpen((v) => !v);
            }}
            notificationsRef={notificationsRef}
            onDismiss={dismissNav}
          />
        ) : null}

        <div className="relative" ref={avatarRef}>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setNotificationsOpen(false);
              setAvatarOpen((v) => !v);
            }}
            className="inline-flex items-center rounded-full p-0.5 transition hover:ring-2 hover:ring-accent/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-expanded={avatarOpen}
            aria-haspopup="menu"
            aria-label={me?.id ? "Menú de cuenta" : "Iniciar sesión o registrarse"}
          >
            <AvatarTrigger me={me} size="md" showChevron={Boolean(me?.id)} />
          </button>
          {avatarOpen ? (
            <div className="absolute right-0 top-full z-50 mt-2 rounded-2xl border border-border bg-surface shadow-xl dark:border-slate-600 dark:bg-slate-900">
              {avatarDropdown}
            </div>
          ) : null}
        </div>
      </div>

      {/* Mobile */}
      <div className="flex items-center gap-2 md:hidden">
        <NavLink
          to="/buscar"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-xs font-semibold text-body dark:border-slate-600"
        >
          <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Buscar
        </NavLink>
        <NavLink
          to="/publicar"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-xs font-semibold text-body dark:border-slate-600"
        >
          <CirclePlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Publicar
        </NavLink>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg border border-border bg-bg-light px-3 py-2 text-sm font-bold text-body dark:border-slate-600"
          aria-expanded={mobileOpen}
          aria-haspopup="dialog"
        >
          Menú
        </button>
        {me?.id ? (
          <LoggedInIconActions
            unreadCount={unreadCount}
            notificationsOpen={notificationsOpen}
            onToggleNotifications={() => {
              setMobileOpen(false);
              setNotificationsOpen((v) => !v);
            }}
            notificationsRef={notificationsRef}
            onDismiss={dismissNav}
          />
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (me?.id) {
              setNotificationsOpen(false);
              setMobileOpen(true);
            } else {
              openLogin();
            }
          }}
          className="inline-flex items-center rounded-full p-0.5"
          aria-label={me?.id ? "Abrir menú de cuenta" : "Iniciar sesión o registrarse"}
        >
          <AvatarTrigger me={me} size="sm" showChevron={Boolean(me?.id)} />
        </button>
      </div>

      {mobileOpen ? createPortal(mobileSheet, document.body) : null}
    </>
  );
}

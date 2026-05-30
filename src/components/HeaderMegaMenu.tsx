import { useCallback, useEffect, useRef, useState } from "react";
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

const dropBtn =
  "block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-body transition hover:bg-surface-elevated";

function primaryNavClass({ isActive }: { isActive: boolean }) {
  return [
    "inline-flex items-center gap-2 transition",
    isActive
      ? "bg-surface-elevated text-primary ring-1 ring-border"
      : "text-body hover:bg-surface-elevated",
    "rounded-lg border border-border px-2.5 py-2 text-xs font-semibold dark:border-slate-600",
    "md:rounded-lg md:border-0 md:px-3 md:py-2 md:text-sm md:font-medium",
  ].join(" ");
}

const iconBtnClass =
  "relative inline-flex items-center justify-center rounded-lg p-2 text-body transition hover:bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function UnreadDot({ className = "" }: { className?: string }) {
  return (
    <span
      className={`h-2 w-2 shrink-0 rounded-full bg-error ring-2 ring-surface ${className}`}
      aria-hidden
    />
  );
}

type NotificationItem = {
  id: string;
  text: string;
  date: string;
  time: string;
  isRead: boolean;
  link: string;
};

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "created-room-americana",
    text: "Tu nuevo anuncio de Cuarto 'Cuarto en la Americana' se ha creado exitosamente, no olvides publicarlo.",
    date: "28 may 2026",
    time: "09:15",
    isRead: false,
    link: "/publicar/vista-previa?listing=cuarto-americana",
  },
  {
    id: "created-property-providencia",
    text: "Tu nuevo anuncio de Propiedad 'Casa en Providencia' se ha creado exitosamente, no olvides publicarlo.",
    date: "27 may 2026",
    time: "18:42",
    isRead: false,
    link: "/publicar/vista-previa?listing=casa-providencia",
  },
  {
    id: "published-room-americana",
    text: "Has publicado exitosamente tu anuncio de Cuarto 'Cuarto en la Americana'.",
    date: "26 may 2026",
    time: "11:03",
    isRead: true,
    link: "/publicar/vista-previa?listing=cuarto-americana",
  },
  {
    id: "reminder-room-americana",
    text: "Tu anuncio 'Cuarto en la Americana' lleva 3 días creado sin publicarse. ¡Publícalo hoy!",
    date: "25 may 2026",
    time: "08:00",
    isRead: false,
    link: "/publicar/vista-previa?listing=cuarto-americana",
  },
];

function LoggedInIconActions({
  hasUnreadMessages,
  notifications,
  hasUnreadNotifications,
  notificationsOpen,
  onToggleNotifications,
  onNotificationClick,
  notificationsRef,
  onDismiss,
}: {
  hasUnreadMessages: boolean;
  notifications: NotificationItem[];
  hasUnreadNotifications: boolean;
  notificationsOpen: boolean;
  onToggleNotifications: () => void;
  onNotificationClick: (id: string) => void;
  notificationsRef: React.RefObject<HTMLDivElement | null>;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <NavLink
        to="/mensajes"
        className={iconBtnClass}
        aria-label={hasUnreadMessages ? "Mensajes (sin leer)" : "Mensajes"}
      >
        <span className="relative inline-flex">
          <MessageSquare className="h-5 w-5 shrink-0" aria-hidden />
          {hasUnreadMessages ? (
            <UnreadDot className="absolute -right-0.5 -top-0.5" />
          ) : null}
        </span>
      </NavLink>

      <div className="relative" ref={notificationsRef}>
        <button
          type="button"
          onClick={onToggleNotifications}
          className={`${iconBtnClass} gap-0.5 px-1.5`}
          aria-expanded={notificationsOpen}
          aria-haspopup="menu"
          aria-label={
            hasUnreadNotifications ? "Notificaciones (sin leer)" : "Notificaciones"
          }
        >
          <span className="relative inline-flex">
            <Bell className="h-5 w-5 shrink-0" aria-hidden />
            {hasUnreadNotifications ? (
              <UnreadDot className="absolute -right-0.5 -top-0.5" />
            ) : null}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
        </button>
        {notificationsOpen ? (
          <div className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-border bg-surface shadow-xl dark:border-slate-600 dark:bg-slate-900">
            <p className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted dark:border-slate-600">
              Notificaciones
            </p>
            <ul className="max-h-80 overflow-y-auto p-1.5">
              {notifications.slice(0, 5).map((n) => (
                <li key={n.id}>
                  <Link
                    to={n.link}
                    onClick={() => {
                      onNotificationClick(n.id);
                      onDismiss();
                    }}
                    className={[
                      "flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition",
                      n.isRead
                        ? "hover:bg-surface-elevated"
                        : "bg-primary/5 hover:bg-primary/10",
                    ].join(" ")}
                  >
                    {!n.isRead ? (
                      <UnreadDot className="mt-1.5 ring-surface" />
                    ) : (
                      <span className="mt-1.5 h-2 w-2 shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-snug text-body">{n.text}</span>
                      <span className="mt-1 block text-xs text-muted">
                        {n.date} · {n.time}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-border p-1.5 dark:border-slate-600">
              <Link
                to="/notifications"
                onClick={onDismiss}
                className="block w-full rounded-lg px-3 py-2.5 text-center text-sm font-semibold text-primary transition hover:bg-surface-elevated"
              >
                Ver todas las notificaciones
              </Link>
            </div>
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

function AvatarMenuSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-border p-1 first:border-t-0 dark:border-slate-600">{children}</div>
  );
}

type Props = {
  me: AuthMe | null | undefined;
  profileIncomplete: boolean;
  unreadCount: number;
  onAuthChange?: () => void;
};

export function HeaderMegaMenu({ me, profileIncomplete, onAuthChange }: Props) {
  const navigate = useNavigate();
  const { openLogin } = useAuthModal();
  const [hasUnreadMessages, setHasUnreadMessages] = useState(true);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const hasUnreadNotifications = notifications.some((n) => !n.isRead);

  const dismissNav = useCallback(() => {
    setAvatarOpen(false);
    setNotificationsOpen(false);
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
  }, []);

  useEffect(() => {
    if (!avatarOpen && !notificationsOpen) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (avatarOpen && avatarRef.current && !avatarRef.current.contains(t)) setAvatarOpen(false);
      if (notificationsOpen && notificationsRef.current && !notificationsRef.current.contains(t)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [avatarOpen, notificationsOpen]);

  const onLogout = async () => {
    dismissNav();
    await authLogout();
    onAuthChange?.();
    navigate("/");
  };

  const avatarDropdown = me?.id ? (
    <div className="flex min-w-[14rem] flex-col py-1">
      <AvatarMenuSection>
        <NavLink to="/perfil" className={navClass} onClick={dismissNav}>
          <span className="inline-flex items-center gap-1">
            Mi Perfil
            {profileIncomplete ? (
              <span className="rounded-full bg-error px-1.5 py-0.5 text-[9px] font-bold text-white">!</span>
            ) : null}
          </span>
        </NavLink>
        <NavLink to="/mis-anuncios" className={navClass} onClick={dismissNav}>
          Mis Anuncios
        </NavLink>
        {me.isAdmin ? (
          <NavLink to="/admin" className={navClass} onClick={dismissNav}>
            Administrador
          </NavLink>
        ) : null}
      </AvatarMenuSection>

      <AvatarMenuSection>
        <NavLink to="/grupos" className={navClass} onClick={dismissNav}>
          Comunidades
        </NavLink>
        <NavLink to="/faq" className={navClass} onClick={dismissNav}>
          Preguntas Frecuentes
        </NavLink>
        <a
          href="mailto:soporte@bestie.mx"
          className={dropBtn}
          onClick={dismissNav}
        >
          Contacto
        </a>
        <div className="px-1 py-1">
          <ThemeToggle />
        </div>
      </AvatarMenuSection>

      <AvatarMenuSection>
        <NavLink to="/legal" className={navClass} onClick={dismissNav}>
          Términos y Privacidad
        </NavLink>
        <button type="button" className={dropBtn} onClick={() => void onLogout()}>
          Cerrar sesión
        </button>
      </AvatarMenuSection>
    </div>
  ) : (
    <div className="flex min-w-[14rem] flex-col py-1">
      <AvatarMenuSection>
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
      </AvatarMenuSection>

      <AvatarMenuSection>
        <NavLink to="/grupos" className={navClass} onClick={dismissNav}>
          Comunidades
        </NavLink>
        <NavLink to="/faq" className={navClass} onClick={dismissNav}>
          Preguntas Frecuentes
        </NavLink>
        <a
          href="mailto:soporte@bestie.mx"
          className={dropBtn}
          onClick={dismissNav}
        >
          Contacto
        </a>
        <div className="px-1 py-1">
          <ThemeToggle />
        </div>
      </AvatarMenuSection>

      <AvatarMenuSection>
        <NavLink to="/legal" className={navClass} onClick={dismissNav}>
          Términos y Privacidad
        </NavLink>
      </AvatarMenuSection>
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-end gap-1 lg:gap-2">
        <NavLink to="/buscar" className={primaryNavClass}>
          <Search className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" aria-hidden />
          Buscar
        </NavLink>
        <NavLink to="/publicar" className={primaryNavClass}>
          <CirclePlus className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" aria-hidden />
          Publicar
        </NavLink>

        {me?.id ? (
          <LoggedInIconActions
            hasUnreadMessages={hasUnreadMessages}
            notifications={notifications}
            hasUnreadNotifications={hasUnreadNotifications}
            notificationsOpen={notificationsOpen}
            onToggleNotifications={() => {
              setAvatarOpen(false);
              setNotificationsOpen((v) => !v);
            }}
            onNotificationClick={markNotificationRead}
            notificationsRef={notificationsRef}
            onDismiss={dismissNav}
          />
        ) : null}

        <div className="relative" ref={avatarRef}>
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen(false);
              setAvatarOpen((v) => !v);
            }}
            className="inline-flex items-center rounded-full p-0.5 transition hover:ring-2 hover:ring-accent/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-expanded={avatarOpen}
            aria-haspopup="menu"
            aria-label={me?.id ? "Menú de cuenta" : "Iniciar sesión o registrarse"}
          >
            <span className="md:hidden">
              <AvatarTrigger me={me} size="sm" showChevron />
            </span>
            <span className="hidden md:inline-flex">
              <AvatarTrigger me={me} size="md" showChevron />
            </span>
          </button>
          {avatarOpen ? (
            <div className="absolute right-0 top-full z-50 mt-2 rounded-2xl border border-border bg-surface shadow-xl dark:border-slate-600 dark:bg-slate-900">
              {avatarDropdown}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

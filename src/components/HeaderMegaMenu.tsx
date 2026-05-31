import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  ChevronDown,
  CirclePlus,
  LayoutGrid,
  LogOut,
  Mail,
  MessageSquare,
  Search,
  Shield,
  User,
} from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import type { AuthMe } from "@/lib/authApi";
import { authLogout } from "@/lib/authApi";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import type { NotificationItem } from "@/lib/notificationsMock";
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

const logoutBtn =
  "block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-body transition hover:bg-red-50 hover:text-error dark:hover:bg-red-950/30";

const mobileMenuItem =
  "flex w-full items-center justify-start gap-3 rounded-lg px-4 py-3 text-sm font-medium text-body transition hover:bg-gray-50 dark:hover:bg-surface-elevated";

function mobileNavClass({ isActive }: { isActive: boolean }) {
  return [
    mobileMenuItem,
    isActive ? "bg-surface-elevated text-primary ring-1 ring-border" : "",
  ].join(" ");
}

function MobileMenuDivider() {
  return <div className="my-1 border-t border-gray-100 dark:border-slate-700" role="separator" />;
}

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

type NotificationItemProps = NotificationItem;

function LoggedInIconActions({
  hasUnreadMessages,
  onMessagesClick,
  notifications,
  hasUnreadNotifications,
  notificationsOpen,
  onToggleNotifications,
  onNotificationClick,
  notificationsRef,
  onDismiss,
}: {
  hasUnreadMessages: boolean;
  onMessagesClick: () => void;
  notifications: NotificationItemProps[];
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
        onClick={onMessagesClick}
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
                        {n.relativeTime}
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

function AvatarMenuSection({
  children,
  showDivider = true,
}: {
  children: React.ReactNode;
  showDivider?: boolean;
}) {
  return (
    <div
      className={[
        "p-1",
        showDivider ? "my-1 border-t border-gray-100 dark:border-slate-700" : "",
      ].join(" ")}
    >
      {children}
    </div>
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
  const { notifications, hasUnreadNotifications, markNotificationRead } = useNotifications();
  const [hasUnreadMessages, setHasUnreadMessages] = useState(true);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (unreadCount > 0) setHasUnreadMessages(true);
  }, [unreadCount]);

  const dismissNav = useCallback(() => {
    setAvatarOpen(false);
    setNotificationsOpen(false);
  }, []);

  const onMessagesClick = useCallback(() => {
    setHasUnreadMessages(false);
  }, []);

  useEffect(() => {
    if (!avatarOpen && !notificationsOpen) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      const desktop = window.matchMedia("(min-width: 768px)").matches;
      if (avatarOpen && desktop && avatarRef.current && !avatarRef.current.contains(t)) {
        setAvatarOpen(false);
      }
      if (notificationsOpen && notificationsRef.current && !notificationsRef.current.contains(t)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [avatarOpen, notificationsOpen]);

  useEffect(() => {
    if (!avatarOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissNav();
    };

    if (window.matchMedia("(max-width: 767px)").matches) {
      document.body.style.overflow = "hidden";
    }
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [avatarOpen, dismissNav]);

  const onLogout = async () => {
    dismissNav();
    await authLogout();
    onAuthChange?.();
    navigate("/");
  };

  const avatarDropdown = me?.id ? (
    <div className="flex min-w-[14rem] flex-col py-1">
      <AvatarMenuSection showDivider={false}>
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
        <NavLink
          to="/mensajes"
          className={navClass}
          onClick={() => {
            onMessagesClick();
            dismissNav();
          }}
        >
          <span className="inline-flex items-center gap-1">
            Mensajes
            {hasUnreadMessages ? (
              unreadCount > 0 ? (
                <span className="rounded-full bg-error px-1.5 py-0.5 text-[9px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : (
                <span className="h-2 w-2 rounded-full bg-error" aria-hidden />
              )
            ) : null}
          </span>
        </NavLink>
      </AvatarMenuSection>

      {me.isAdmin ? (
        <AvatarMenuSection>
          <NavLink to="/admin" className={navClass} onClick={dismissNav}>
            Administrador
          </NavLink>
        </AvatarMenuSection>
      ) : null}

      <AvatarMenuSection>
        <Link to="/contacto" className={dropBtn} onClick={dismissNav}>
          Contacto
        </Link>
      </AvatarMenuSection>

      <AvatarMenuSection>
        <button type="button" className={logoutBtn} onClick={() => void onLogout()}>
          Cerrar sesión
        </button>
      </AvatarMenuSection>
    </div>
  ) : (
    <div className="flex min-w-[14rem] flex-col py-1">
      <AvatarMenuSection showDivider={false}>
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
        <Link to="/contacto" className={dropBtn} onClick={dismissNav}>
          Contacto
        </Link>
      </AvatarMenuSection>
    </div>
  );

  const mobileMenuPanel = me?.id ? (
    <div className="flex w-full flex-col py-1">
      <NavLink to="/buscar" className={mobileNavClass} onClick={dismissNav}>
        <Search className="h-5 w-5 shrink-0" aria-hidden />
        Buscar
      </NavLink>
      <NavLink
        to="/mensajes"
        className={mobileNavClass}
        onClick={() => {
          onMessagesClick();
          dismissNav();
        }}
      >
        <MessageSquare className="h-5 w-5 shrink-0" aria-hidden />
        <span className="inline-flex min-w-0 flex-1 items-center gap-2">
          Mensajes
          {hasUnreadMessages ? (
            unreadCount > 0 ? (
              <span className="rounded-full bg-error px-1.5 py-0.5 text-[9px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : (
              <span className="h-2 w-2 rounded-full bg-error" aria-hidden />
            )
          ) : null}
        </span>
      </NavLink>
      <NavLink to="/mis-anuncios" className={mobileNavClass} onClick={dismissNav}>
        <LayoutGrid className="h-5 w-5 shrink-0" aria-hidden />
        Mis Anuncios
      </NavLink>
      <NavLink to="/publicar" className={mobileNavClass} onClick={dismissNav}>
        <CirclePlus className="h-5 w-5 shrink-0" aria-hidden />
        Publicar
      </NavLink>

      <MobileMenuDivider />

      <NavLink to="/perfil" className={mobileNavClass} onClick={dismissNav}>
        <User className="h-5 w-5 shrink-0" aria-hidden />
        <span className="inline-flex items-center gap-2">
          Mi Perfil
          {profileIncomplete ? (
            <span className="rounded-full bg-error px-1.5 py-0.5 text-[9px] font-bold text-white">!</span>
          ) : null}
        </span>
      </NavLink>
      {me.isAdmin ? (
        <NavLink to="/admin" className={mobileNavClass} onClick={dismissNav}>
          <Shield className="h-5 w-5 shrink-0" aria-hidden />
          Administrador
        </NavLink>
      ) : null}

      <MobileMenuDivider />

      <Link to="/contacto" className={mobileMenuItem} onClick={dismissNav}>
        <Mail className="h-5 w-5 shrink-0" aria-hidden />
        Contacto
      </Link>

      <MobileMenuDivider />

      <button
        type="button"
        className={`${mobileMenuItem} hover:bg-red-50 hover:text-error dark:hover:bg-red-950/30`}
        onClick={() => void onLogout()}
      >
        <LogOut className="h-5 w-5 shrink-0" aria-hidden />
        Cerrar sesión
      </button>
    </div>
  ) : (
    <div className="flex w-full flex-col py-1">
      <NavLink to="/buscar" className={mobileNavClass} onClick={dismissNav}>
        <Search className="h-5 w-5 shrink-0" aria-hidden />
        Buscar
      </NavLink>
      <NavLink to="/publicar" className={mobileNavClass} onClick={dismissNav}>
        <CirclePlus className="h-5 w-5 shrink-0" aria-hidden />
        Publicar
      </NavLink>

      <MobileMenuDivider />

      <button
        type="button"
        className={mobileMenuItem}
        onClick={() => {
          dismissNav();
          openLogin();
        }}
      >
        <User className="h-5 w-5 shrink-0" aria-hidden />
        Iniciar sesión / Registrarse
      </button>

      <MobileMenuDivider />

      <Link to="/contacto" className={mobileMenuItem} onClick={dismissNav}>
        <Mail className="h-5 w-5 shrink-0" aria-hidden />
        Contacto
      </Link>
    </div>
  );

  const mobileMenuSheet = (
    <div className="fixed inset-0 z-[90] md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Cerrar menú"
        onClick={dismissNav}
      />
      <div
        className="absolute right-0 top-0 flex h-dvh w-[min(100%,20rem)] flex-col border-l border-border bg-surface shadow-xl dark:border-slate-600 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-label="Menú principal"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3 dark:border-slate-600">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-body">
            <UserAvatar displayName={me?.displayName} profilePictureUrl={me?.profilePictureUrl} size="sm" />
            {me?.displayName ?? "Menú"}
          </span>
          <button type="button" className="text-muted" aria-label="Cerrar menú" onClick={dismissNav}>
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-2">{mobileMenuPanel}</div>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-end gap-1 lg:gap-2">
        <NavLink
          to="/buscar"
          className={(props) => `${primaryNavClass(props)} hidden md:inline-flex`}
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          Buscar
        </NavLink>
        <NavLink
          to="/publicar"
          className={(props) => `${primaryNavClass(props)} hidden md:inline-flex`}
        >
          <CirclePlus className="h-4 w-4 shrink-0" aria-hidden />
          Publicar
        </NavLink>

        {me?.id ? (
          <div className="hidden md:block">
            <LoggedInIconActions
              hasUnreadMessages={hasUnreadMessages}
              onMessagesClick={onMessagesClick}
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
          </div>
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
            aria-label={me?.id ? "Menú de cuenta" : "Abrir menú"}
          >
            <span className="md:hidden">
              <AvatarTrigger me={me} size="sm" showChevron />
            </span>
            <span className="hidden md:inline-flex">
              <AvatarTrigger me={me} size="md" showChevron />
            </span>
          </button>
          {avatarOpen ? (
            <div className="absolute right-0 top-full z-50 mt-2 hidden min-w-[14rem] rounded-2xl border border-border bg-surface shadow-xl dark:border-slate-600 dark:bg-slate-900 md:block">
              {avatarDropdown}
            </div>
          ) : null}
        </div>
      </div>

      {avatarOpen ? createPortal(mobileMenuSheet, document.body) : null}
    </>
  );
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { SavedSearchIcon } from "@/components/icons/SavedSearchIcon";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import type { AuthMe } from "@/lib/authApi";
import { authLogout } from "@/lib/authApi";
import { resetAnalyticsUser, track } from "@/lib/analytics";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import type { NotificationItem } from "@/lib/notificationsApi";
import { UserAvatar } from "@/components/UserAvatar";

const HOME_PUBLISH_NUDGE_DELAY_MS = 3_000;
const HOME_PUBLISH_MOBILE_LABEL_MS = 7_000;
const HOME_PUBLISH_DESKTOP_RING_MS = 1_600;
/** Brand forest — matches `theme(colors.primary.DEFAULT)`. SVG stroke cannot use Tailwind classes. */
const PRIMARY_STROKE = "#143D30";

/**
 * One-shot outline travel around Publicar (desktop). Same pattern as SaveSearch PulseRing.
 */
function PublishNudgePulseRing() {
  const height = 44;
  const cornerRadius = 10;
  const strokeWidth = 3;
  const inset = strokeWidth / 2 + 1;
  const dashArray = "0.18 0.82";

  return (
    <svg
      className="pointer-events-none absolute -inset-[3px] z-10 h-[calc(100%+6px)] w-[calc(100%+6px)] overflow-visible"
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <rect
        x={inset}
        y={inset}
        width={100 - inset * 2}
        height={height - inset * 2}
        rx={cornerRadius}
        ry={cornerRadius}
        fill="none"
        stroke={PRIMARY_STROKE}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        pathLength="1"
        strokeDasharray={dashArray}
        className="animate-[autosave-ring-travel_1.5s_linear_forwards] drop-shadow-[0_0_6px_rgba(20,61,48,0.45)]"
      />
    </svg>
  );
}

const desktopMenuItem =
  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-body transition hover:bg-surface-elevated";

function desktopNavClass({ isActive }: { isActive: boolean }) {
  return [
    desktopMenuItem,
    isActive ? "bg-surface-elevated text-primary ring-1 ring-border" : "",
  ].join(" ");
}

const desktopLogoutBtn =
  `${desktopMenuItem} hover:bg-error/5 hover:text-error`;

function DesktopMenuDivider() {
  return <div className="my-1 border-t border-border" role="separator" />;
}

const mobileMenuItem =
  "flex w-full items-center justify-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-body transition hover:bg-surface-elevated";

function mobileNavClass({ isActive }: { isActive: boolean }) {
  return [
    mobileMenuItem,
    isActive ? "bg-surface-elevated text-primary ring-1 ring-border" : "",
  ].join(" ");
}

function MobileMenuDivider() {
  return <div className="my-1 border-t border-border" role="separator" />;
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

/** Mobile header actions share one hit height so search / Publicar / avatar stay aligned. */
const mobileHeaderActionClass =
  "relative inline-flex h-9 shrink-0 items-center justify-center rounded-lg text-body transition hover:bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** Desktop: stepped gaps via Tailwind. Mobile: gap applied via inline style from hook. */
const headerIconActionsGapClass = "gap-0 md:gap-1.5 lg:gap-2";
const loggedInIconActionsGapClass = "gap-0 md:gap-0.5";

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
  notifications,
  hasUnreadNotifications,
  notificationsOpen,
  onToggleNotifications,
  onNotificationClick,
  onMarkAllRead,
  notificationsRef,
  onDismiss,
  iconGapPx,
}: {
  hasUnreadMessages: boolean;
  notifications: NotificationItemProps[];
  hasUnreadNotifications: boolean;
  notificationsOpen: boolean;
  onToggleNotifications: () => void;
  onNotificationClick: (id: string) => void;
  onMarkAllRead: () => void;
  notificationsRef: React.RefObject<HTMLDivElement | null>;
  onDismiss: () => void;
  iconGapPx: number;
}) {
  const notificationsButtonRef = useRef<HTMLButtonElement>(null);
  const [mobilePanelTopPx, setMobilePanelTopPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!notificationsOpen) {
      setMobilePanelTopPx(null);
      return;
    }

    const updateMobilePanelTop = () => {
      if (window.matchMedia("(min-width: 768px)").matches) {
        setMobilePanelTopPx(null);
        return;
      }
      const button = notificationsButtonRef.current;
      if (!button) return;
      // Sit just below the notification trigger, with the same 8px gap as desktop `mt-2`.
      setMobilePanelTopPx(button.getBoundingClientRect().bottom + 8);
    };

    updateMobilePanelTop();
    window.addEventListener("resize", updateMobilePanelTop);
    window.addEventListener("scroll", updateMobilePanelTop, true);
    return () => {
      window.removeEventListener("resize", updateMobilePanelTop);
      window.removeEventListener("scroll", updateMobilePanelTop, true);
    };
  }, [notificationsOpen]);

  return (
    <div
      className={`flex items-center ${loggedInIconActionsGapClass}`}
      style={iconGapPx > 0 ? { gap: `${iconGapPx}px` } : undefined}
    >
      <NavLink
        to="/mensajes"
        data-header-action="true"
        className={`${mobileHeaderActionClass} w-9 md:w-auto md:p-2`}
        aria-label={hasUnreadMessages ? "Mensajes (sin leer)" : "Mensajes"}
      >
        <span className="relative inline-flex">
          <MessageSquare className="h-5 w-5 shrink-0 md:h-4 md:w-4" aria-hidden />
          {hasUnreadMessages ? (
            <UnreadDot className="absolute -right-0.5 -top-0.5" />
          ) : null}
        </span>
      </NavLink>

      <div className="relative" ref={notificationsRef} data-header-action="true">
        <button
          ref={notificationsButtonRef}
          type="button"
          onClick={onToggleNotifications}
          className={`${mobileHeaderActionClass} w-9 gap-0.5 px-1.5 md:w-auto md:py-2`}
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
          <ChevronDown
            className="hidden h-3.5 w-3.5 shrink-0 text-muted md:block"
            aria-hidden
          />
        </button>
        {notificationsOpen ? (
          <div
            className="fixed inset-x-3 z-[1850] max-h-[min(70dvh,28rem)] overflow-hidden rounded-2xl border border-border bg-surface shadow-xl dark:border-slate-600 dark:bg-slate-900 md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 md:max-h-none md:w-[min(92vw,22rem)]"
            style={mobilePanelTopPx != null ? { top: mobilePanelTopPx } : undefined}
            role="menu"
          >
            <div className="flex max-h-[min(70dvh,28rem)] flex-col md:max-h-none">
              <p className="shrink-0 border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted dark:border-slate-600">
                Notificaciones
              </p>
              <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 md:max-h-80">
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
              <div className="flex shrink-0 items-center gap-1.5 border-t border-border p-1.5 dark:border-slate-600">
                <Link
                  to="/notifications"
                  onClick={onDismiss}
                  className="block flex-1 rounded-lg px-3 py-2.5 text-center text-sm font-semibold text-primary transition hover:bg-surface-elevated"
                >
                  Ver todas las notificaciones
                </Link>
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  disabled={!hasUnreadNotifications}
                  className="rounded-lg px-3 py-2.5 text-center text-sm font-semibold text-primary transition hover:bg-surface-elevated disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent"
                >
                  Marcar como leídas
                </button>
              </div>
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
    <span className="inline-flex h-full items-center gap-0.5">
      <UserAvatar displayName={me?.displayName} profilePictureUrl={me?.profilePictureUrl} size={size} />
      {showChevron ? (
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
      ) : null}
    </span>
  );
}

type Props = {
  me: AuthMe | null | undefined;
  unreadCount: number;
  onAuthChange?: () => void;
  /** Gap in px between mobile icon buttons, computed by useHeaderChromeFit. 0 on desktop. */
  iconGapPx?: number;
};

export function HeaderMegaMenu({ me, unreadCount, onAuthChange, iconGapPx = 0 }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { openLogin } = useAuthModal();
  const { notifications, hasUnreadNotifications, markNotificationRead, markAllNotificationsRead } =
    useNotifications();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [homePublishDesktopPulse, setHomePublishDesktopPulse] = useState(false);
  const [homePublishMobileLabel, setHomePublishMobileLabel] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const hasUnreadMessages = unreadCount > 0;
  const isHome = location.pathname === "/";

  const dismissNav = useCallback(() => {
    setAvatarOpen(false);
    setNotificationsOpen(false);
  }, []);

  useEffect(() => {
    // Mobile "Publicar" label nudge is guests-only (logged-in header is already crowded).
    const showMobilePublishLabel = isHome && !me?.id;
    const showDesktopPublishPulse = isHome;

    if (!showMobilePublishLabel) {
      setHomePublishMobileLabel(false);
    }
    if (!showDesktopPublishPulse) {
      setHomePublishDesktopPulse(false);
    }
    if (!isHome) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) return;

    const startId = window.setTimeout(() => {
      if (showDesktopPublishPulse) setHomePublishDesktopPulse(true);
      if (showMobilePublishLabel) setHomePublishMobileLabel(true);
    }, HOME_PUBLISH_NUDGE_DELAY_MS);

    const desktopEndId = window.setTimeout(() => {
      setHomePublishDesktopPulse(false);
    }, HOME_PUBLISH_NUDGE_DELAY_MS + HOME_PUBLISH_DESKTOP_RING_MS);

    const mobileEndId = window.setTimeout(() => {
      setHomePublishMobileLabel(false);
    }, HOME_PUBLISH_NUDGE_DELAY_MS + HOME_PUBLISH_MOBILE_LABEL_MS);

    return () => {
      window.clearTimeout(startId);
      window.clearTimeout(desktopEndId);
      window.clearTimeout(mobileEndId);
    };
  }, [isHome, me?.id]);

  useEffect(() => {
    if (!avatarOpen && !notificationsOpen) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (avatarOpen && avatarRef.current && !avatarRef.current.contains(t)) {
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
    if (!avatarOpen && !notificationsOpen) return;

    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissNav();
    };

    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [avatarOpen, notificationsOpen, dismissNav]);

  const onLogout = async () => {
    dismissNav();
    await authLogout();
    track("user_logged_out", {});
    resetAnalyticsUser();
    onAuthChange?.();
    navigate("/");
  };

  const avatarDropdown = me?.id ? (
    <div className="flex w-full flex-col gap-0.5 p-1.5">
      {me.isAdmin ? (
        <>
          <NavLink to="/admin" className={desktopNavClass} onClick={dismissNav}>
            <Shield className="h-4 w-4 shrink-0" aria-hidden />
            Administrador
          </NavLink>
          <DesktopMenuDivider />
        </>
      ) : null}
      <NavLink to="/mis-anuncios" className={desktopNavClass} onClick={dismissNav}>
        <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
        Mis anuncios
      </NavLink>
      <NavLink to="/mis-busquedas" className={desktopNavClass} onClick={dismissNav}>
        <SavedSearchIcon className="h-4 w-4 shrink-0" />
        Mis Búsquedas
      </NavLink>
      <NavLink
        to="/mensajes"
        className={desktopNavClass}
        onClick={() => {
          dismissNav();
        }}
      >
        <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
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

      <DesktopMenuDivider />
      <NavLink to="/buscar" className={desktopNavClass} onClick={dismissNav}>
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        Buscar
      </NavLink>
      <NavLink to="/publicar" className={desktopNavClass} onClick={dismissNav}>
        <CirclePlus className="h-4 w-4 shrink-0" aria-hidden />
        Publicar
      </NavLink>

      <DesktopMenuDivider />
      <NavLink to="/perfil" className={desktopNavClass} onClick={dismissNav}>
        <User className="h-4 w-4 shrink-0" aria-hidden />
        Mi Perfil
      </NavLink>
      <Link to="/contacto" className={desktopMenuItem} onClick={dismissNav}>
        <Mail className="h-4 w-4 shrink-0" aria-hidden />
        Contacto
      </Link>
      <button type="button" className={desktopLogoutBtn} onClick={() => void onLogout()}>
        <LogOut className="h-4 w-4 shrink-0" aria-hidden />
        Cerrar sesión
      </button>
    </div>
  ) : (
    <div className="flex w-full flex-col gap-0.5 p-1.5">
      <button
        type="button"
        className={desktopMenuItem}
        onClick={() => {
          dismissNav();
          openLogin();
        }}
      >
        <User className="h-4 w-4 shrink-0" aria-hidden />
        Iniciar sesión / Registrarse
      </button>

      <DesktopMenuDivider />
      <Link to="/contacto" className={desktopMenuItem} onClick={dismissNav}>
        <Mail className="h-4 w-4 shrink-0" aria-hidden />
        Contacto
      </Link>
    </div>
  );

  const mobileMenuPanel = me?.id ? (
    <div className="flex w-full flex-col gap-0.5 p-1.5">
      {me.isAdmin ? (
        <>
          <NavLink to="/admin" className={mobileNavClass} onClick={dismissNav}>
            <Shield className="h-4 w-4 shrink-0" aria-hidden />
            Administrador
          </NavLink>
          <MobileMenuDivider />
        </>
      ) : null}
      <NavLink to="/mis-anuncios" className={mobileNavClass} onClick={dismissNav}>
        <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
        Mis anuncios
      </NavLink>
      <NavLink to="/mis-busquedas" className={mobileNavClass} onClick={dismissNav}>
        <SavedSearchIcon className="h-4 w-4 shrink-0" />
        Mis Búsquedas
      </NavLink>
      <NavLink
        to="/mensajes"
        className={mobileNavClass}
        onClick={() => {
          dismissNav();
        }}
      >
        <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
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

      <MobileMenuDivider />

      <NavLink to="/buscar" className={mobileNavClass} onClick={dismissNav}>
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        Buscar
      </NavLink>
      <NavLink to="/publicar" className={mobileNavClass} onClick={dismissNav}>
        <CirclePlus className="h-4 w-4 shrink-0" aria-hidden />
        Publicar
      </NavLink>

      <MobileMenuDivider />

      <NavLink to="/perfil" className={mobileNavClass} onClick={dismissNav}>
        <User className="h-4 w-4 shrink-0" aria-hidden />
        Mi Perfil
      </NavLink>
      <Link to="/contacto" className={mobileMenuItem} onClick={dismissNav}>
        <Mail className="h-4 w-4 shrink-0" aria-hidden />
        Contacto
      </Link>
      <button
        type="button"
        className={`${mobileMenuItem} hover:bg-error/5 hover:text-error`}
        onClick={() => void onLogout()}
      >
        <LogOut className="h-4 w-4 shrink-0" aria-hidden />
        Cerrar sesión
      </button>
    </div>
  ) : (
    <div className="flex w-full flex-col gap-0.5 p-1.5">
      <NavLink to="/buscar" className={mobileNavClass} onClick={dismissNav}>
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        Buscar
      </NavLink>
      <NavLink to="/publicar" className={mobileNavClass} onClick={dismissNav}>
        <CirclePlus className="h-4 w-4 shrink-0" aria-hidden />
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
        <User className="h-4 w-4 shrink-0" aria-hidden />
        Iniciar sesión / Registrarse
      </button>

      <MobileMenuDivider />

      <Link to="/contacto" className={mobileMenuItem} onClick={dismissNav}>
        <Mail className="h-4 w-4 shrink-0" aria-hidden />
        Contacto
      </Link>
    </div>
  );

  return (
    <>
      <div
        className={`flex items-center justify-end ${headerIconActionsGapClass}`}
        style={iconGapPx > 0 ? { gap: `${iconGapPx}px` } : undefined}
      >
        <NavLink
          to="/buscar"
          className={(props) => `${primaryNavClass(props)} hidden md:inline-flex`}
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          Buscar
        </NavLink>
        <span className="relative hidden overflow-visible md:inline-flex">
          <NavLink to="/publicar" className={(props) => `${primaryNavClass(props)} inline-flex`}>
            <CirclePlus className="h-4 w-4 shrink-0" aria-hidden />
            Publicar
          </NavLink>
          {homePublishDesktopPulse ? <PublishNudgePulseRing /> : null}
        </span>

        <NavLink
          to="/buscar"
          data-header-action="true"
          className={(props) =>
            [
              mobileHeaderActionClass,
              "w-8 md:hidden",
              props.isActive ? "bg-surface-elevated text-primary ring-1 ring-border" : "",
            ].join(" ")
          }
          aria-label="Buscar"
        >
          <Search className="h-5 w-5 shrink-0" aria-hidden />
        </NavLink>
        <NavLink
          to="/publicar"
          data-header-action="true"
          className={(props) =>
            [
              mobileHeaderActionClass,
              "md:hidden",
              homePublishMobileLabel
                ? "gap-1.5 bg-primary/10 px-2 text-primary ring-1 ring-primary/20"
                : "w-8",
              props.isActive && !homePublishMobileLabel
                ? "bg-surface-elevated text-primary ring-1 ring-border"
                : "",
              props.isActive && homePublishMobileLabel ? "ring-primary/30" : "",
            ].join(" ")
          }
          aria-label="Publicar"
        >
          <CirclePlus className="h-5 w-5 shrink-0" aria-hidden />
          <span
            className={[
              "overflow-hidden whitespace-nowrap text-xs font-semibold leading-none transition-[max-width,opacity,margin] duration-300 ease-out",
              homePublishMobileLabel ? "ml-0 max-w-[4.5rem] opacity-100" : "ml-0 max-w-0 opacity-0",
            ].join(" ")}
            aria-hidden
          >
            Publicar
          </span>
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
            onMarkAllRead={markAllNotificationsRead}
            notificationsRef={notificationsRef}
            onDismiss={dismissNav}
            iconGapPx={iconGapPx}
          />
        ) : null}

        <div className="relative flex h-9 items-center" ref={avatarRef} data-header-action="true">
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen(false);
              setAvatarOpen((v) => !v);
            }}
            className="inline-flex h-9 items-center rounded-full px-0.5 transition hover:ring-2 hover:ring-accent/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-expanded={avatarOpen}
            aria-haspopup="menu"
            aria-label={me?.id ? "Menú de cuenta" : "Abrir menú"}
          >
            <span className="inline-flex h-9 items-center md:hidden">
              <AvatarTrigger me={me} size="sm" showChevron />
            </span>
            <span className="hidden h-9 items-center md:inline-flex">
              <AvatarTrigger me={me} size="md" showChevron />
            </span>
          </button>
          {avatarOpen ? (
            <div
              className="absolute right-0 top-full z-[1850] mt-2 w-[min(92vw,16rem)] overflow-hidden rounded-2xl border border-border bg-surface shadow-xl dark:border-slate-600 dark:bg-slate-900 md:w-60"
              role="menu"
            >
              <div className="max-h-[min(70dvh,28rem)] overflow-x-hidden overflow-y-auto overscroll-contain md:max-h-none">
                <div className="md:hidden">{mobileMenuPanel}</div>
                <div className="hidden md:block">{avatarDropdown}</div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { HeaderMegaMenu } from "@/components/HeaderMegaMenu";
import { SiteFooter } from "@/components/SiteFooter";
import { AuthModal } from "@/components/AuthModal";
import { AuthModalProvider } from "@/contexts/AuthModalContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { analyticsHeartbeat, authMe, needsEmailVerification, type AuthMe } from "@/lib/authApi";
import { fetchUnreadMessageCount } from "@/lib/messagesApi";
import { Link } from "react-router-dom";
import type { AppShellOutletContext } from "@/layouts/appShellOutletContext";

export function AppShellLayout() {
  const location = useLocation();
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);
  const [unread, setUnread] = useState(0);

  const profileIncomplete = me != null && me.id && Boolean(me.email && !me.phoneE164);

  const refreshMe = useCallback(async () => {
    try {
      setMe(await authMe());
    } catch {
      setMe(null);
    }
  }, []);

  const refreshUnread = useCallback(async () => {
    try {
      setUnread(await fetchUnreadMessageCount());
    } catch {
      setUnread(0);
    }
  }, []);

  useEffect(() => {
    void analyticsHeartbeat();
  }, []);

  /** Keep header badge and menu in sync after login, profile PATCH, etc. (without full page reload). */
  useEffect(() => {
    void refreshMe();
  }, [location.pathname, refreshMe]);

  useEffect(() => {
    const onChange = () => void refreshMe();
    window.addEventListener("bestie:me-changed", onChange);
    return () => window.removeEventListener("bestie:me-changed", onChange);
  }, [refreshMe]);

  useEffect(() => {
    if (!me?.id) {
      setUnread(0);
      return;
    }
    void refreshUnread();
    const t = window.setInterval(() => void refreshUnread(), 25_000);
    return () => window.clearInterval(t);
  }, [me?.id, refreshUnread]);

  useEffect(() => {
    const onReadChange = () => void refreshUnread();
    window.addEventListener("bestie:messages-read-changed", onReadChange);
    return () => window.removeEventListener("bestie:messages-read-changed", onReadChange);
  }, [refreshUnread]);

  const isSearchPage = location.pathname === "/buscar" || location.pathname.startsWith("/buscar/");
  const showEmailVerificationBanner =
    me != null && needsEmailVerification(me) && location.pathname !== "/verificar-correo";

  const outletContext: AppShellOutletContext = { me, refreshMe };

  return (
    <AuthModalProvider>
      <NotificationsProvider>
      <div className={`flex flex-col dark:bg-bg-dark ${isSearchPage ? "h-dvh min-h-0" : "min-h-screen"}`}>
        <header className="sticky top-0 z-[1800] border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
          <div className="flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <BrandLogo />
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <HeaderMegaMenu
                me={me}
                profileIncomplete={profileIncomplete}
                unreadCount={unread}
                onAuthChange={refreshMe}
              />
            </div>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
          {showEmailVerificationBanner ? (
            <div className="border-b border-warning/40 bg-warning/10 px-4 py-2.5 text-center text-sm text-body dark:border-warning/30 dark:bg-warning/10">
              <span className="font-semibold">Validación pendiente:</span> confirma tu correo{" "}
              <span className="font-medium">{me.email}</span> (revisa spam).{" "}
              <Link to="/verificar-correo" className="font-semibold underline underline-offset-2">
                Ingresar código
              </Link>
            </div>
          ) : null}
          <Outlet context={outletContext} />
        </main>

        {!isSearchPage ? <SiteFooter /> : null}

        <AuthModal />
      </div>
      </NotificationsProvider>
    </AuthModalProvider>
  );
}

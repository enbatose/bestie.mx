import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { HeaderMegaMenu } from "@/components/HeaderMegaMenu";
import { SiteFooter } from "@/components/SiteFooter";
import { AuthModal } from "@/components/AuthModal";
import { AuthModalProvider } from "@/contexts/AuthModalContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { analyticsHeartbeat, authMe, type AuthMe } from "@/lib/authApi";
import { fetchUnreadMessageCount } from "@/lib/messagesApi";

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
    const load = () => void fetchUnreadMessageCount().then(setUnread).catch(() => setUnread(0));
    load();
    const t = window.setInterval(load, 25_000);
    return () => window.clearInterval(t);
  }, [me?.id]);

  const isSearchPage = location.pathname === "/buscar" || location.pathname.startsWith("/buscar/");

  return (
    <AuthModalProvider>
      <NotificationsProvider>
      <div className={`flex flex-col dark:bg-bg-dark ${isSearchPage ? "h-dvh min-h-0" : "min-h-screen"}`}>
        <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <BrandLogo />
            <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
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
          <Outlet />
        </main>

        {!isSearchPage ? <SiteFooter /> : null}

        <AuthModal />
      </div>
      </NotificationsProvider>
    </AuthModalProvider>
  );
}

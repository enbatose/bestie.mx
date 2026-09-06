import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { HeaderMegaMenu } from "@/components/HeaderMegaMenu";
import { SiteFooter } from "@/components/SiteFooter";
import { AuthModal } from "@/components/AuthModal";
import { CompletaTuPerfilModal, profileNagStorageKey } from "@/components/CompletaTuPerfilModal";
import { AuthModalProvider } from "@/contexts/AuthModalContext";
import { FeedbackModalProvider } from "@/contexts/FeedbackModalContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { PostHogIdentify, PostHogPageViews } from "@/components/analytics/PostHogApp";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { analyticsHeartbeat, authMe, needsEmailVerification, needsProfileCompletion, type AuthMe } from "@/lib/authApi";
import { fetchUnreadMessageCount } from "@/lib/messagesApi";
import { Link } from "react-router-dom";
import type { AppShellOutletContext } from "@/layouts/appShellOutletContext";
import { useHeaderChromeFit } from "@/hooks/useHeaderChromeFit";

export function AppShellLayout() {
  const location = useLocation();
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);
  const [unread, setUnread] = useState(0);
  const [profileNagSkipped, setProfileNagSkipped] = useState(false);
  const { rowRef, actionsRef, markOnly, iconGapPx } = useHeaderChromeFit(
    me?.id,
    me !== undefined,
  );
  useEffect(() => {
    if (!me?.id) {
      setProfileNagSkipped(false);
      return;
    }
    try {
      setProfileNagSkipped(sessionStorage.getItem(profileNagStorageKey(me.id)) === "1");
    } catch {
      setProfileNagSkipped(false);
    }
  }, [me?.id]);

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

  /**
   * Reset scroll on route change. Without this, navigating from a long page
   * (home CTA / footer) to a short page like FAQ keeps the previous scroll
   * offset and lands at the bottom.
   * Hash targets (e.g. /legal/privacidad#eliminacion-de-datos) are left to
   * their own scroll handlers.
   */
  useLayoutEffect(() => {
    if (location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.querySelector("main")?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.hash]);

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
    const onReadChange = (ev: Event) => {
      const detail = (ev as CustomEvent<{ unreadCount?: number }>).detail;
      if (detail && typeof detail.unreadCount === "number") {
        setUnread(detail.unreadCount);
        return;
      }
      void refreshUnread();
    };
    window.addEventListener("bestie:messages-read-changed", onReadChange);
    return () => window.removeEventListener("bestie:messages-read-changed", onReadChange);
  }, [refreshUnread]);

  const isSearchPage =
    location.pathname === "/buscar" ||
    location.pathname.startsWith("/buscar/") ||
    location.pathname.startsWith("/busquedas/");
  const showEmailVerificationBanner =
    me != null && needsEmailVerification(me) && location.pathname !== "/verificar-correo";
  const showCompleteProfileModal =
    me != null &&
    needsProfileCompletion(me) &&
    !profileNagSkipped &&
    location.pathname !== "/verificar-correo";

  const outletContext: AppShellOutletContext = { me, refreshMe, unreadMessageCount: unread };

  return (
    <AuthModalProvider>
      <FeedbackModalProvider>
      <NotificationsProvider>
      <PostHogPageViews />
      <PostHogIdentify me={me} />
      <div className={`flex flex-col dark:bg-bg-dark ${isSearchPage ? "h-dvh min-h-0" : "min-h-screen"}`}>
        <header className="sticky top-0 z-[1800] border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
          <div
            ref={rowRef}
            className="flex w-full min-w-0 items-center justify-between gap-1.5 px-3 py-3 sm:gap-3 sm:px-6 lg:px-8"
          >
            <div className="min-w-0 shrink">
              <BrandLogo markOnly={markOnly} />
            </div>
            <div
              ref={actionsRef}
              className="flex shrink-0 items-center justify-end"
            >
              <HeaderMegaMenu
                me={me}
                unreadCount={unread}
                onAuthChange={refreshMe}
                iconGapPx={iconGapPx}
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
        {me ? (
          <CompletaTuPerfilModal
            open={showCompleteProfileModal}
            me={me}
            onSaved={() => void refreshMe()}
            onDismissed={() => {
              setProfileNagSkipped(true);
              void refreshMe();
            }}
          />
        ) : null}
      </div>
      <CookieConsentBanner />
      </NotificationsProvider>
      </FeedbackModalProvider>
    </AuthModalProvider>
  );
}

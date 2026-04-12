import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HeaderMegaMenu } from "@/components/HeaderMegaMenu";
import { AuthModal } from "@/components/AuthModal";
import { AuthModalProvider } from "@/contexts/AuthModalContext";
import { analyticsHeartbeat, authMe, isAuthApiConfigured, type AuthMe } from "@/lib/authApi";
import { fetchUnreadMessageCount } from "@/lib/messagesApi";

export function AppShellLayout() {
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);
  const [unread, setUnread] = useState(0);

  const profileIncomplete =
    me != null && me.id && Boolean(me.email && (me.emailVerified !== true || !me.phoneE164));

  useEffect(() => {
    if (!isAuthApiConfigured()) {
      setMe(null);
      return;
    }
    void analyticsHeartbeat();
    void authMe()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    if (!me?.id || !isAuthApiConfigured()) {
      setUnread(0);
      return;
    }
    const load = () => void fetchUnreadMessageCount().then(setUnread).catch(() => setUnread(0));
    load();
    const t = window.setInterval(load, 25_000);
    return () => window.clearInterval(t);
  }, [me?.id]);

  return (
    <AuthModalProvider>
      <div className="flex min-h-screen flex-col dark:bg-bg-dark">
        <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <BrandLogo />
            <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
              <ThemeToggle />
              <HeaderMegaMenu me={me} profileIncomplete={profileIncomplete} unreadCount={unread} />
            </div>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </main>

        <footer className="border-t border-border bg-surface px-4 py-8 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 flex-col gap-3">
              <BrandLogo imgClassName="h-7 w-auto max-w-[200px] object-left sm:h-8" />
              <p className="text-sm text-muted">
                © {new Date().getFullYear()} Bestie™ ·{" "}
                <a
                  href="mailto:support@bestie.mx"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  support@bestie.mx
                </a>
              </p>
              <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-primary">
                <Link to="/contacto" className="underline-offset-2 hover:underline">
                  Contacto
                </Link>
                <Link to="/faq" className="underline-offset-2 hover:underline">
                  FAQ
                </Link>
                <Link to="/legal" className="underline-offset-2 hover:underline">
                  Legal y privacidad
                </Link>
              </nav>
            </div>
            <p className="text-xs text-muted sm:text-right">bestie.mx — MVP en construcción</p>
          </div>
        </footer>

        <AuthModal />
      </div>
    </AuthModalProvider>
  );
}

import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { HeaderMegaMenu } from "@/components/HeaderMegaMenu";
import { AuthModal } from "@/components/AuthModal";
import { AuthModalProvider } from "@/contexts/AuthModalContext";
import { analyticsHeartbeat, authMe, type AuthMe } from "@/lib/authApi";
import { fetchUnreadMessageCount } from "@/lib/messagesApi";

export function AppShellLayout() {
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);
  const [unread, setUnread] = useState(0);

  const profileIncomplete = me != null && me.id && Boolean(me.email && !me.phoneE164);

  useEffect(() => {
    void analyticsHeartbeat();
    void authMe()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

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

  return (
    <AuthModalProvider>
      <div className="flex min-h-screen flex-col dark:bg-bg-dark">
        <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <BrandLogo />
            <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
              <HeaderMegaMenu me={me} profileIncomplete={profileIncomplete} unreadCount={unread} />
            </div>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>

        <footer className="border-t border-border bg-surface px-4 py-8 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <BrandLogo imgClassName="h-7 w-auto max-w-[200px] object-left sm:h-8" />
            <div className="mx-auto w-full max-w-2xl">
              <nav className="grid grid-cols-3 text-center text-sm font-medium text-primary">
                <a href="mailto:soporte@bestie.mx" className="underline-offset-2 hover:underline">
                  Contacto
                </a>
                <Link to="/faq" className="underline-offset-2 hover:underline">
                  FAQ
                </Link>
                <Link to="/legal" className="underline-offset-2 hover:underline">
                  Legal y privacidad
                </Link>
              </nav>
              <div className="mt-2 grid grid-cols-3 text-sm text-muted">
                <div aria-hidden className="min-w-0" />
                <p className="text-center">© {new Date().getFullYear()} Bestie™</p>
                <div aria-hidden className="min-w-0" />
              </div>
            </div>
          </div>
        </footer>

        <AuthModal />
      </div>
    </AuthModalProvider>
  );
}

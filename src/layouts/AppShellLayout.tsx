import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
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
          <p className="mx-auto max-w-6xl text-center text-sm text-muted">
            © {new Date().getFullYear()} Bestie™
          </p>
        </footer>

        <AuthModal />
      </div>
    </AuthModalProvider>
  );
}

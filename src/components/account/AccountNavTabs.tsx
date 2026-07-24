import { NavLink, useLocation } from "react-router-dom";

const ACCOUNT_TABS = [
  { to: "/mis-anuncios", label: "Mis Anuncios", end: true },
  { to: "/mis-busquedas", label: "Mis Búsquedas", end: true },
  { to: "/mensajes", label: "Mensajes", end: true },
  { to: "/contacto", label: "Contacto", end: true },
  { to: "/perfil", label: "Mi Perfil", end: false },
] as const;

function tabIsActive(pathname: string, to: string, end: boolean): boolean {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

type AccountNavTabsProps = {
  unreadMessageCount?: number;
};

export function AccountNavTabs({ unreadMessageCount = 0 }: AccountNavTabsProps) {
  const location = useLocation();
  const hideOnMobileThread =
    location.pathname === "/mensajes" && Boolean(new URLSearchParams(location.search).get("c"));

  return (
    <nav
      aria-label="Menú de cuenta"
      className={`sticky top-0 z-[1100] border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 ${
        hideOnMobileThread ? "hidden md:block" : ""
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div
          role="tablist"
          className="-mb-px flex gap-1 overflow-x-auto overscroll-x-contain pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {ACCOUNT_TABS.map((tab) => {
            const active = tabIsActive(location.pathname, tab.to, tab.end);
            const showUnread = tab.to === "/mensajes" && unreadMessageCount > 0;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                role="tab"
                aria-selected={active}
                className={`relative inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition sm:px-4 ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:border-border hover:text-body"
                }`}
              >
                {tab.label}
                {showUnread ? (
                  <span className="rounded-full bg-error px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

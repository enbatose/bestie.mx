import { Outlet } from "react-router-dom";
import { AccountNavTabs } from "@/components/account/AccountNavTabs";
import { useAppShellOutlet } from "@/layouts/appShellOutletContext";

/**
 * Shared account-area chrome: tab navigation across Mis Anuncios, Mis Búsquedas,
 * Mensajes, Contacto, and Mi Perfil (including /perfil/editar).
 */
export function AccountTabsLayout() {
  const outletContext = useAppShellOutlet();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AccountNavTabs unreadMessageCount={outletContext.unreadMessageCount ?? 0} />
      <Outlet context={outletContext} />
    </div>
  );
}

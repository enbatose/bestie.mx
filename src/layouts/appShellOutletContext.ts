import { useOutletContext } from "react-router-dom";
import type { AuthMe } from "@/lib/authApi";

export type AppShellOutletContext = {
  me: AuthMe | null | undefined;
  refreshMe: () => Promise<void>;
  unreadMessageCount?: number;
};

export function useAppShellOutlet(): AppShellOutletContext {
  return useOutletContext<AppShellOutletContext>();
}

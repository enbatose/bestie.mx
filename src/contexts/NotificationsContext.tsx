import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchNotifications,
  markAllNotificationsReadApi,
  markNotificationReadApi,
  type NotificationItem,
} from "@/lib/notificationsApi";
import { authMe } from "@/lib/authApi";

type NotificationsContextValue = {
  notifications: NotificationItem[];
  hasUnreadNotifications: boolean;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  refreshNotifications: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [authed, setAuthed] = useState(false);

  const refreshNotifications = useCallback(async () => {
    try {
      const me = await authMe().catch(() => null);
      if (!me?.id) {
        setAuthed(false);
        setNotifications([]);
        return;
      }
      setAuthed(true);
      setNotifications(await fetchNotifications());
    } catch {
      setNotifications([]);
    }
  }, []);

  useEffect(() => {
    void refreshNotifications();
    const onMe = () => void refreshNotifications();
    window.addEventListener("bestie:me-changed", onMe);
    const t = window.setInterval(() => {
      if (authed) void refreshNotifications();
    }, 45_000);
    return () => {
      window.removeEventListener("bestie:me-changed", onMe);
      window.clearInterval(t);
    };
  }, [refreshNotifications, authed]);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: n.readAt ?? new Date().toISOString() } : n)));
    void markNotificationReadApi(id);
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: n.readAt ?? new Date().toISOString() })),
    );
    void markAllNotificationsReadApi();
  }, []);

  const hasUnreadNotifications = notifications.some((n) => !n.isRead);

  const value = useMemo(
    () => ({
      notifications,
      hasUnreadNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      refreshNotifications: () => void refreshNotifications(),
    }),
    [
      notifications,
      hasUnreadNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      refreshNotifications,
    ],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}

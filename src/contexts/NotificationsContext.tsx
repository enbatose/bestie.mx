import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { INITIAL_NOTIFICATIONS, type NotificationItem } from "@/lib/notificationsMock";

type NotificationsContextValue = {
  notifications: NotificationItem[];
  hasUnreadNotifications: boolean;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  const hasUnreadNotifications = notifications.some((n) => !n.isRead);

  const value = useMemo(
    () => ({
      notifications,
      hasUnreadNotifications,
      markNotificationRead,
      markAllNotificationsRead,
    }),
    [notifications, hasUnreadNotifications, markNotificationRead, markAllNotificationsRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}

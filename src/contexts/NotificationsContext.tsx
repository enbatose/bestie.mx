import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { INITIAL_NOTIFICATIONS, type NotificationItem } from "@/lib/notificationsMock";

type NotificationsContextValue = {
  notifications: NotificationItem[];
  hasUnreadNotifications: boolean;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const STORAGE_KEY = "bestie:notifications:read-state:v1";

function readStoredReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { readIds?: unknown };
    if (!Array.isArray(parsed.readIds)) return new Set();
    return new Set(parsed.readIds.filter((value): value is string => typeof value === "string"));
  } catch {
    return new Set();
  }
}

function buildInitialNotifications(): NotificationItem[] {
  const readIds = readStoredReadIds();
  return INITIAL_NOTIFICATIONS.map((notification) =>
    readIds.has(notification.id) ? { ...notification, isRead: true } : notification,
  );
}

function persistNotifications(notifications: NotificationItem[]): void {
  if (typeof window === "undefined") return;
  try {
    const readIds = notifications.filter((notification) => notification.isRead).map((notification) => notification.id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ readIds }));
  } catch {
    // Ignore storage failures; in-memory state still works.
  }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => buildInitialNotifications());

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, isRead: true } : n));
      persistNotifications(next);
      return next;
    });
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, isRead: true }));
      persistNotifications(next);
      return next;
    });
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

import { deviceHeaders } from "@/lib/deviceFingerprint";
import { apiBase } from "@/lib/apiBase";

const cred: RequestCredentials = "include";

export type NotificationItem = {
  id: string;
  text: string;
  link: string;
  createdAt: string;
  readAt: string | null;
  isRead: boolean;
  /** Client-formatted relative label. */
  relativeTime: string;
};

function formatRelativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diffSec = Math.round((Date.now() - t) / 1000);
  if (diffSec < 60) return "Hace un momento";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH} hora${diffH === 1 ? "" : "s"}`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return "Ayer";
  if (diffD < 7) return `Hace ${diffD} días`;
  return new Date(t).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

function mapRow(raw: {
  id: string;
  text: string;
  link: string;
  createdAt: string;
  readAt: string | null;
  isRead: boolean;
}): NotificationItem {
  return {
    id: raw.id,
    text: raw.text,
    link: raw.link || "/notifications",
    createdAt: raw.createdAt,
    readAt: raw.readAt,
    isRead: Boolean(raw.isRead),
    relativeTime: formatRelativeTime(raw.createdAt),
  };
}

export async function fetchNotifications(signal?: AbortSignal): Promise<NotificationItem[]> {
  const base = apiBase();
  const res = await fetch(`${base}/api/notifications`, { credentials: cred, signal });
  if (res.status === 401) return [];
  if (!res.ok) return [];
  const j = (await res.json()) as {
    notifications?: Array<{
      id: string;
      text: string;
      link: string;
      createdAt: string;
      readAt: string | null;
      isRead: boolean;
    }>;
  };
  return (j.notifications ?? []).map(mapRow);
}

export async function markNotificationReadApi(id: string): Promise<void> {
  const base = apiBase();
  await fetch(`${base}/api/notifications/${encodeURIComponent(id)}/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: "{}",
  });
}

export async function markAllNotificationsReadApi(): Promise<void> {
  const base = apiBase();
  await fetch(`${base}/api/notifications/read-all`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: "{}",
  });
}

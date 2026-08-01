import { Bell, BellRing, CheckCircle, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/contexts/NotificationsContext";

export function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, markNotificationRead, markAllNotificationsRead } = useNotifications();

  const onItemClick = (id: string, link: string) => {
    markNotificationRead(id);
    navigate(link);
  };

  if (notifications.length === 0) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-16 text-center">
        <BellRing className="h-14 w-14 text-muted/60" aria-hidden />
        <h1 className="mt-6 text-2xl font-bold text-primary">Notificaciones</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">No tienes notificaciones nuevas por ahora.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-primary">Notificaciones</h1>
        <button
          type="button"
          onClick={markAllNotificationsRead}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-body transition hover:bg-surface-elevated"
        >
          <CheckCircle className="h-4 w-4 shrink-0" aria-hidden />
          Marcar todas como leídas
        </button>
      </div>

      <ul className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface">
        {notifications.map((n) => (
          <li key={n.id} className="border-b border-border last:border-b-0">
            <button
              type="button"
              onClick={() => onItemClick(n.id, n.link)}
              className={[
                "flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-surface-elevated",
                !n.isRead ? "bg-secondary/10 dark:bg-secondary/5" : "",
              ].join(" ")}
            >
              {!n.isRead ? (
                <span
                  className="mt-2 h-2 w-2 shrink-0 rounded-full bg-error ring-2 ring-surface"
                  aria-hidden
                />
              ) : (
                <span className="mt-2 h-2 w-2 shrink-0" aria-hidden />
              )}
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-muted">
                <Info className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="ph-no-capture block text-sm leading-snug text-body">{n.text}</span>
                <span className="mt-1.5 block text-xs text-muted">{n.relativeTime}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted">
        <Bell className="h-3.5 w-3.5" aria-hidden />
        Mostrando {notifications.length} notificaciones
      </p>
    </div>
  );
}

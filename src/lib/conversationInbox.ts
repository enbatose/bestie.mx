import type { ConversationKind, ConversationSummary } from "@/lib/messagesApi";
import type { AdminSupportConversationRow } from "@/lib/authApi";

export type UserConversationSortKey = "updated" | "user" | "unread" | "listing" | "support" | "feedback";
export type AdminSupportSortKey = "updated" | "user" | "unread" | "email";
export type AdminSupportKindFilter = "all" | "support" | "feedback" | "blog";

export const USER_CONVERSATION_SORT_OPTIONS: { value: UserConversationSortKey; label: string }[] = [
  { value: "updated", label: "Más recientes" },
  { value: "user", label: "Usuario" },
  { value: "unread", label: "No leídos" },
  { value: "listing", label: "Anuncios primero" },
  { value: "support", label: "Soporte primero" },
  { value: "feedback", label: "Feedback primero" },
];

export const ADMIN_SUPPORT_SORT_OPTIONS: { value: AdminSupportSortKey; label: string }[] = [
  { value: "updated", label: "Más recientes" },
  { value: "user", label: "Usuario" },
  { value: "unread", label: "No leídos" },
  { value: "email", label: "Correo" },
];

export const ADMIN_SUPPORT_KIND_FILTER_OPTIONS: { value: AdminSupportKindFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "support", label: "Solo Soporte" },
  { value: "feedback", label: "Solo Feedback" },
  { value: "blog", label: "Solo Blog" },
];

function cmpStr(a: string, b: string): number {
  return a.localeCompare(b, "es", { sensitivity: "base" });
}

function kindRank(kind: ConversationKind, prefer: ConversationKind): number {
  if (kind === prefer) return 0;
  return 1;
}

export function sortUserConversations(
  rows: ConversationSummary[],
  sort: UserConversationSortKey,
): ConversationSummary[] {
  const next = [...rows];
  next.sort((a, b) => {
    switch (sort) {
      case "user":
        return cmpStr(a.otherDisplayName, b.otherDisplayName) || b.updatedAt.localeCompare(a.updatedAt);
      case "unread":
        return b.unreadCount - a.unreadCount || b.updatedAt.localeCompare(a.updatedAt);
      case "listing":
        return (
          kindRank(a.kind, "listing") - kindRank(b.kind, "listing") || b.updatedAt.localeCompare(a.updatedAt)
        );
      case "support":
        return (
          kindRank(a.kind, "support") - kindRank(b.kind, "support") || b.updatedAt.localeCompare(a.updatedAt)
        );
      case "feedback":
        return (
          kindRank(a.kind, "feedback") - kindRank(b.kind, "feedback") || b.updatedAt.localeCompare(a.updatedAt)
        );
      case "updated":
      default:
        return b.updatedAt.localeCompare(a.updatedAt);
    }
  });
  return next;
}

export function sortAdminSupportConversations(
  rows: AdminSupportConversationRow[],
  sort: AdminSupportSortKey,
): AdminSupportConversationRow[] {
  const next = [...rows];
  next.sort((a, b) => {
    switch (sort) {
      case "user":
        return cmpStr(a.customerDisplayName, b.customerDisplayName) || b.updatedAt.localeCompare(a.updatedAt);
      case "unread":
        return b.unreadCount - a.unreadCount || b.updatedAt.localeCompare(a.updatedAt);
      case "email":
        return (
          cmpStr(a.customerEmail ?? "", b.customerEmail ?? "") || b.updatedAt.localeCompare(a.updatedAt)
        );
      case "updated":
      default:
        return b.updatedAt.localeCompare(a.updatedAt);
    }
  });
  return next;
}

export function formatRelativeUpdatedAt(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diffMs = Date.now() - t;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days} d`;
  return new Date(t).toLocaleDateString("es-MX", { dateStyle: "short" });
}

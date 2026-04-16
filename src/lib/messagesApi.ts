import { deviceHeaders } from "@/lib/deviceFingerprint";
import { apiBase } from "@/lib/apiBase";

const cred: RequestCredentials = "include";

export type ConversationSummary = {
  id: string;
  contextTitle: string;
  listingRoomId: string | null;
  updatedAt: string;
  otherUserId: string;
  otherDisplayName: string;
  lastPreview: string;
  unreadCount: number;
};

export type ChatMessage = {
  id: string;
  senderUserId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export async function fetchUnreadMessageCount(signal?: AbortSignal): Promise<number> {
  const base = apiBase();
  const res = await fetch(`${base}/api/messages/unread-count`, { credentials: cred, signal });
  if (res.status === 401) return 0;
  if (!res.ok) return 0;
  const j = (await res.json()) as { count?: number };
  return typeof j.count === "number" ? j.count : 0;
}

export async function fetchConversations(signal?: AbortSignal): Promise<ConversationSummary[]> {
  const base = apiBase();
  const res = await fetch(`${base}/api/messages/conversations`, { credentials: cred, signal });
  if (res.status === 401) return [];
  if (!res.ok) throw new Error(`conversations_${res.status}`);
  const j = (await res.json()) as { conversations: ConversationSummary[] };
  return j.conversations ?? [];
}

export async function startConversationFromListing(
  listingRoomId: string,
  signal?: AbortSignal,
): Promise<{ conversationId: string; created: boolean }> {
  const base = apiBase();
  const res = await fetch(`${base}/api/messages/conversations/from-listing`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify({ listingRoomId }),
    signal,
  });
  const j = (await res.json().catch(() => ({}))) as {
    conversationId?: string;
    created?: boolean;
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(j.message || j.error || `start_${res.status}`);
  }
  if (!j.conversationId) throw new Error("missing_conversation");
  return { conversationId: j.conversationId, created: Boolean(j.created) };
}

export async function fetchConversationMessages(
  conversationId: string,
  signal?: AbortSignal,
): Promise<ChatMessage[]> {
  const base = apiBase();
  const res = await fetch(`${base}/api/messages/conversations/${encodeURIComponent(conversationId)}/messages`, {
    credentials: cred,
    signal,
  });
  if (!res.ok) throw new Error(`messages_${res.status}`);
  const j = (await res.json()) as { messages: ChatMessage[] };
  return j.messages ?? [];
}

export async function postConversationMessage(
  conversationId: string,
  body: string,
  signal?: AbortSignal,
): Promise<void> {
  const base = apiBase();
  const res = await fetch(`${base}/api/messages/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify({ body }),
    signal,
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || `post_${res.status}`);
  }
}

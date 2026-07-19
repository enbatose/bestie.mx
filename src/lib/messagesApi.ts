import { deviceHeaders } from "@/lib/deviceFingerprint";
import { apiBase } from "@/lib/apiBase";

const cred: RequestCredentials = "include";

export type MessageAttachment = {
  url: string;
  mimeType: string;
  size: number;
  filename: string;
};

export type ConversationKind = "listing" | "support";

export type ConversationSummary = {
  id: string;
  contextTitle: string;
  listingRoomId: string | null;
  kind: ConversationKind;
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
  attachments: MessageAttachment[];
};

export async function fetchUnreadMessageCount(signal?: AbortSignal): Promise<number> {
  const base = apiBase();
  const res = await fetch(`${base}/api/messages/unread-count`, { credentials: cred, signal });
  if (res.status === 401) return 0;
  if (!res.ok) return 0;
  const j = (await res.json()) as { count?: number };
  return typeof j.count === "number" ? j.count : 0;
}

export async function fetchConversations(
  opts?: { q?: string; signal?: AbortSignal },
): Promise<ConversationSummary[]> {
  const base = apiBase();
  const q = opts?.q?.trim();
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  const res = await fetch(`${base}/api/messages/conversations${qs}`, {
    credentials: cred,
    signal: opts?.signal,
  });
  if (res.status === 401) return [];
  if (!res.ok) throw new Error(`conversations_${res.status}`);
  const j = (await res.json()) as { conversations: ConversationSummary[] };
  return j.conversations ?? [];
}

export async function startSupportConversation(
  input: { subject: string; body: string; attachments?: MessageAttachment[] },
  signal?: AbortSignal,
): Promise<{ conversationId: string }> {
  const base = apiBase();
  const res = await fetch(`${base}/api/messages/conversations/from-support`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify({ subject: input.subject, body: input.body, attachments: input.attachments ?? [] }),
    signal,
  });
  const j = (await res.json().catch(() => ({}))) as { conversationId?: string; error?: string; message?: string };
  if (!res.ok) {
    throw new Error(j.message || j.error || `support_start_${res.status}`);
  }
  if (!j.conversationId) throw new Error("missing_conversation");
  return { conversationId: j.conversationId };
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
  attachments: MessageAttachment[] = [],
  signal?: AbortSignal,
): Promise<void> {
  const base = apiBase();
  const res = await fetch(`${base}/api/messages/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify({ body, attachments }),
    signal,
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || `post_${res.status}`);
  }
}

/** Uploads a message attachment (image) and returns its metadata for `postConversationMessage`/`startSupportConversation`. */
export async function uploadMessageAttachment(file: File, signal?: AbortSignal): Promise<MessageAttachment> {
  const base = apiBase();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${base}/api/uploads`, {
    method: "POST",
    headers: { ...deviceHeaders() },
    credentials: cred,
    body: form,
    signal,
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { error?: string; message?: string };
      detail = j.message ? `: ${j.message}` : j.error ? `: ${j.error}` : "";
    } catch {
      /* ignore */
    }
    throw new Error(`upload_http_${res.status}${detail}`);
  }
  const j = (await res.json()) as { url?: string };
  if (typeof j.url !== "string" || !j.url.startsWith("/api/uploads/")) {
    throw new Error("upload_bad_response");
  }
  return { url: j.url, mimeType: file.type, size: file.size, filename: file.name };
}

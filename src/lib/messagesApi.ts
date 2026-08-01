import { deviceHeaders } from "@/lib/deviceFingerprint";
import { apiBase } from "@/lib/apiBase";

const cred: RequestCredentials = "include";

export type MessageAttachment = {
  url: string;
  mimeType: string;
  size: number;
  filename: string;
};

export type ConversationKind = "listing" | "support" | "feedback";

export type ConversationSummary = {
  id: string;
  contextTitle: string;
  listingRoomId: string | null;
  kind: ConversationKind;
  updatedAt: string;
  otherUserId: string;
  otherDisplayName: string;
  otherProfilePictureUrl: string | null;
  lastPreview: string;
  unreadCount: number;
};

export type ChatMessage = {
  id: string;
  senderUserId: string;
  body: string;
  createdAt: string;
  /** Peer’s client has seen the message in their inbox (or opened the thread). */
  deliveredAt: string | null;
  readAt: string | null;
  attachments: MessageAttachment[];
};

/**
 * Search-bar context from Mis Anuncios: title first, then the public reference code
 * (e.g. `A550E8400` / `PC2193A56`) so similar titles cannot collide.
 */
export function messagesInboxSearchQuery(
  title: string | undefined | null,
  referenceCode: string,
): string {
  const code = referenceCode.trim();
  const label = (title ?? "").trim().replace(/\s+/g, " ");
  if (!label) return code;
  if (!code || label.includes(code)) return label;
  return `${label} ${code}`;
}

/** Deep-link into Mensajes with search-bar context (multi-keyword AND on the server). */
export function messagesInboxPath(opts: {
  /** Shown/edited in the Messages search bar. Prefer `messagesInboxSearchQuery(title, refCode)`. */
  q: string;
}): string {
  const params = new URLSearchParams();
  const q = opts.q.trim();
  if (q) params.set("q", q);
  const qs = params.size > 0 ? `?${params.toString()}` : "";
  return `/mensajes${qs}`;
}

export async function fetchUnreadMessageCount(signal?: AbortSignal): Promise<number> {
  const base = apiBase();
  const res = await fetch(`${base}/api/messages/unread-count`, { credentials: cred, signal });
  if (res.status === 401) return 0;
  if (!res.ok) return 0;
  const j = (await res.json()) as { count?: number };
  return typeof j.count === "number" ? j.count : 0;
}

export async function fetchConversations(
  opts?: {
    q?: string;
    listingRoomId?: string;
    propertyId?: string;
    signal?: AbortSignal;
  },
): Promise<ConversationSummary[]> {
  const base = apiBase();
  const params = new URLSearchParams();
  const q = opts?.q?.trim();
  if (q) params.set("q", q);
  if (opts?.listingRoomId) params.set("listing", opts.listingRoomId);
  if (opts?.propertyId) params.set("property", opts.propertyId);
  const qs = params.size > 0 ? `?${params.toString()}` : "";
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

export type FeedbackSource = "publish" | "search" | "menu" | "map";

export async function startFeedbackConversation(
  input: {
    rating: number;
    body: string;
    subject?: string;
    source?: FeedbackSource;
    listingRoomId?: string;
    comment?: string;
  },
  signal?: AbortSignal,
): Promise<{ conversationId: string }> {
  const base = apiBase();
  const res = await fetch(`${base}/api/messages/conversations/from-feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify({
      rating: input.rating,
      body: input.body,
      subject: input.subject ?? "Feedback",
      source: input.source ?? "menu",
      ...(input.listingRoomId ? { listingRoomId: input.listingRoomId } : {}),
      ...(input.comment != null ? { comment: input.comment } : {}),
    }),
    signal,
  });
  const j = (await res.json().catch(() => ({}))) as { conversationId?: string; error?: string; message?: string };
  if (!res.ok) {
    throw new Error(j.message || j.error || `feedback_start_${res.status}`);
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
): Promise<{ messages: ChatMessage[]; unreadCount: number }> {
  const base = apiBase();
  const res = await fetch(`${base}/api/messages/conversations/${encodeURIComponent(conversationId)}/messages`, {
    credentials: cred,
    signal,
  });
  if (!res.ok) throw new Error(`messages_${res.status}`);
  const j = (await res.json()) as { messages: ChatMessage[]; unreadCount?: number };
  return {
    messages: j.messages ?? [],
    unreadCount: typeof j.unreadCount === "number" ? j.unreadCount : 0,
  };
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

import type { MessageAttachment } from "@/lib/messagesApi";

/** Persists the Contacto draft across an OAuth redirect (text + already-uploaded attachment URLs). */
const CONTACT_PENDING_DRAFT_KEY = "bestie:contact-pending-draft";

export type ContactPendingDraft = {
  subject: string;
  message: string;
  attachments: MessageAttachment[];
};

function isMessageAttachment(value: unknown): value is MessageAttachment {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<MessageAttachment>;
  return (
    typeof row.url === "string" &&
    row.url.startsWith("/api/uploads/") &&
    typeof row.mimeType === "string" &&
    typeof row.size === "number" &&
    typeof row.filename === "string"
  );
}

export function setContactPendingDraft(draft: ContactPendingDraft): void {
  if (typeof window === "undefined") return;
  try {
    const payload: ContactPendingDraft = {
      subject: draft.subject,
      message: draft.message,
      attachments: Array.isArray(draft.attachments) ? draft.attachments.filter(isMessageAttachment) : [],
    };
    window.sessionStorage.setItem(CONTACT_PENDING_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function consumeContactPendingDraft(): ContactPendingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CONTACT_PENDING_DRAFT_KEY);
    window.sessionStorage.removeItem(CONTACT_PENDING_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ContactPendingDraft>;
    if (typeof parsed.subject !== "string" || typeof parsed.message !== "string") return null;
    const attachments = Array.isArray(parsed.attachments)
      ? parsed.attachments.filter(isMessageAttachment)
      : [];
    return { subject: parsed.subject, message: parsed.message, attachments };
  } catch {
    return null;
  }
}

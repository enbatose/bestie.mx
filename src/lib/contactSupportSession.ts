/** Persists the Contacto draft (subject/message only — not attachments) across an OAuth redirect. */
const CONTACT_PENDING_DRAFT_KEY = "bestie:contact-pending-draft";

export type ContactPendingDraft = { subject: string; message: string };

export function setContactPendingDraft(draft: ContactPendingDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CONTACT_PENDING_DRAFT_KEY, JSON.stringify(draft));
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
    return { subject: parsed.subject, message: parsed.message };
  } catch {
    return null;
  }
}

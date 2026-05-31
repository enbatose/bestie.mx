import type { Draft } from "@/pages/PublishWizardPage";
import type { ListingStatus } from "@/types/listing";
import { normalizeRoomDraft } from "@/lib/publishWizard/normalizeRoomDraft";

export type PublishWizardServerSync = {
  propertyId: string | null;
  roomIds: string[];
};

export type PublishPreviewSession = {
  draft: Draft;
  serverSync: PublishWizardServerSync;
  returnStep: number;
  editingLiveProperty: { status: Extract<ListingStatus, "published" | "paused"> } | null;
};

const STORAGE_KEY = "bestie-publish-preview-v1";

export function writePublishPreviewSession(session: PublishPreviewSession): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* ignore quota */
  }
}

export function readPublishPreviewSession(): PublishPreviewSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PublishPreviewSession;
    if (!parsed?.draft || !Array.isArray(parsed.draft.rooms)) return null;
    parsed.draft = {
      ...parsed.draft,
      rooms: parsed.draft.rooms.map((room) => normalizeRoomDraft(room)),
    };
    return parsed;
  } catch {
    return null;
  }
}

export function clearPublishPreviewSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Last step index in the wizard for the current post mode. */
export function publishWizardLastStepIndex(postMode: Draft["postMode"]): number {
  return postMode === "property" ? 4 : 5;
}

export function publishWizardPhotosStepIndex(postMode: Draft["postMode"]): number {
  return postMode === "room" ? 4 : -1;
}

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
export function publishWizardLastStepIndex(
  postMode: Draft["postMode"],
  roomCreateFlow?: Draft["roomCreateFlow"],
): number {
  if (roomCreateFlow === "ai") return 2;
  if (postMode === "property") return 4;
  return 5;
}

/**
 * Self-serve AI Datos → Verificar. Live published/paused edits stay on the long wizard.
 * In-progress drafts often get `?edit=` from autosave — that must not disable AI.
 */
export function isAiRoomCreateFlow(
  d: Pick<Draft, "roomCreateFlow">,
  opts?: { liveEdit?: boolean },
): boolean {
  if (opts?.liveEdit) return false;
  return d.roomCreateFlow === "ai";
}

/** How to resume a listing loaded from the API (not the in-memory wizard draft). */
export function roomCreateFlowFromHydratedListing(opts: {
  status?: string | null;
  wizardStep?: number | null;
}): Draft["roomCreateFlow"] {
  if (opts.status === "published" || opts.status === "paused") return "manual";
  if (typeof opts.wizardStep === "number" && opts.wizardStep >= 2) return "manual";
  return "ai";
}

/**
 * AI vs manual is chosen after post type. Returning to type selection forgets that choice
 * so choosing a type again opens the AI step, not the long manual wizard.
 */
export function forgetManualRoomCreateChoice<T extends Pick<Draft, "roomCreateFlow">>(draft: T): T {
  if (draft.roomCreateFlow === "ai") return draft;
  return { ...draft, roomCreateFlow: "ai" };
}

export function publishWizardPhotosStepIndex(postMode: Draft["postMode"]): number {
  return postMode === "room" ? 4 : -1;
}

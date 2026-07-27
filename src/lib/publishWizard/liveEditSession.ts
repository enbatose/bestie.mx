import type { Draft } from "@/pages/PublishWizardPage";
import type { ListingStatus } from "@/types/listing";
import { normalizeRoomDraft } from "@/lib/publishWizard/normalizeRoomDraft";
import type { PublishWizardServerSync } from "@/lib/publishWizard/previewSession";

const LIVE_EDIT_KEY = "bestie-publish-live-edit-v1";
const PHOTO_PICKER_INTENT_KEY = "bestie-publish-photo-picker-intent-v1";

/** How long a live-edit snapshot remains valid across camera/tab kills. */
export const LIVE_EDIT_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export type LiveEditSession = {
  propertyId: string;
  roomId: string | null;
  scope: "property" | "room";
  status: Extract<ListingStatus, "published" | "paused">;
  draft: Draft;
  serverSync: PublishWizardServerSync;
  previewRoomIndex: number;
  returnListingId: string | null;
  /** Re-open the inline photo editor after a camera/gallery remount. */
  editingPhotos: boolean;
  updatedAt: number;
};

export type PhotoPickerIntent = {
  at: number;
  source: "camera" | "gallery" | "unknown";
};

function normalizeSessionDraft(draft: Draft): Draft {
  return {
    ...draft,
    rooms: (draft.rooms ?? []).map((room) => normalizeRoomDraft(room)),
  };
}

export function writeLiveEditSession(session: LiveEditSession): void {
  try {
    sessionStorage.setItem(LIVE_EDIT_KEY, JSON.stringify(session));
  } catch {
    /* ignore quota */
  }
}

export function readLiveEditSession(): LiveEditSession | null {
  try {
    const raw = sessionStorage.getItem(LIVE_EDIT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LiveEditSession;
    if (!parsed?.propertyId || !parsed?.draft || !Array.isArray(parsed.draft.rooms)) return null;
    if (!parsed.serverSync || typeof parsed.updatedAt !== "number") return null;
    if (Date.now() - parsed.updatedAt > LIVE_EDIT_SESSION_TTL_MS) {
      sessionStorage.removeItem(LIVE_EDIT_KEY);
      return null;
    }
    return {
      ...parsed,
      draft: normalizeSessionDraft(parsed.draft),
      roomId: parsed.roomId ?? null,
      returnListingId: parsed.returnListingId ?? null,
      editingPhotos: Boolean(parsed.editingPhotos),
      scope: parsed.scope === "property" ? "property" : "room",
      status: parsed.status === "paused" ? "paused" : "published",
      previewRoomIndex: Number.isFinite(parsed.previewRoomIndex) ? parsed.previewRoomIndex : 0,
    };
  } catch {
    return null;
  }
}

export function clearLiveEditSession(): void {
  try {
    sessionStorage.removeItem(LIVE_EDIT_KEY);
  } catch {
    /* ignore */
  }
}

/** Mark that the OS photo picker/camera is about to open (tab may be killed). */
export function markPhotoPickerIntent(source: PhotoPickerIntent["source"]): void {
  try {
    const payload: PhotoPickerIntent = { at: Date.now(), source };
    sessionStorage.setItem(PHOTO_PICKER_INTENT_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function consumePhotoPickerIntent(maxAgeMs = 15 * 60 * 1000): PhotoPickerIntent | null {
  try {
    const raw = sessionStorage.getItem(PHOTO_PICKER_INTENT_KEY);
    sessionStorage.removeItem(PHOTO_PICKER_INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PhotoPickerIntent;
    if (!parsed?.at || Date.now() - parsed.at > maxAgeMs) return null;
    return {
      at: parsed.at,
      source: parsed.source === "camera" || parsed.source === "gallery" ? parsed.source : "unknown",
    };
  } catch {
    return null;
  }
}

export function clearPhotoPickerIntent(): void {
  try {
    sessionStorage.removeItem(PHOTO_PICKER_INTENT_KEY);
  } catch {
    /* ignore */
  }
}

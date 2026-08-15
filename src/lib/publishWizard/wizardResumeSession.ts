import type { Draft } from "@/pages/PublishWizardPage";
import { normalizeRoomDraft } from "@/lib/publishWizard/normalizeRoomDraft";
import type { PublishWizardServerSync } from "@/lib/publishWizard/previewSession";

export type WizardResumeSnapshot = {
  draft: Draft;
  serverSync: PublishWizardServerSync;
  step: number;
  updatedAt: number;
};

const STORAGE_KEY = "bestie-publish-wizard-resume-v1";

export function writeWizardResumeSnapshot(snapshot: WizardResumeSnapshot): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore quota */
  }
}

export function readWizardResumeSnapshot(): WizardResumeSnapshot | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WizardResumeSnapshot;
    if (!parsed?.draft || !Array.isArray(parsed.draft.rooms)) return null;
    if (!parsed.serverSync || typeof parsed.step !== "number") return null;
    parsed.draft = {
      ...parsed.draft,
      rooms: parsed.draft.rooms.map((room) => normalizeRoomDraft(room)),
    };
    return parsed;
  } catch {
    return null;
  }
}

export function clearWizardResumeSnapshot(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

import type { Draft } from "@/pages/PublishWizardPage";
import { normalizeRoomDraft } from "@/lib/publishWizard/normalizeRoomDraft";
import type { PublishWizardServerSync } from "@/lib/publishWizard/previewSession";

export type AssistedDraftClaimSession = {
  token: string;
  draft: Draft;
  serverSync: PublishWizardServerSync;
  step: number;
};

const TOKEN_KEY = "bestie-assisted-claim-token";
const sessionKey = (token: string) => `bestie-assisted-claim-v1:${token}`;

export function writeAssistedDraftClaimToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore quota */
  }
}

export function readAssistedDraftClaimToken(): string | null {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY)?.trim();
    return token || null;
  } catch {
    return null;
  }
}

export function writeAssistedDraftClaimSession(session: AssistedDraftClaimSession): void {
  try {
    sessionStorage.setItem(sessionKey(session.token), JSON.stringify(session));
    writeAssistedDraftClaimToken(session.token);
  } catch {
    /* ignore quota */
  }
}

export function readAssistedDraftClaimSession(token: string): AssistedDraftClaimSession | null {
  try {
    const raw = sessionStorage.getItem(sessionKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AssistedDraftClaimSession;
    if (parsed?.token !== token || !parsed.draft || !Array.isArray(parsed.draft.rooms)) return null;
    parsed.draft = {
      ...parsed.draft,
      rooms: parsed.draft.rooms.map((room) => normalizeRoomDraft(room)),
    };
    return parsed;
  } catch {
    return null;
  }
}

export function clearAssistedDraftClaimSession(token: string): void {
  try {
    sessionStorage.removeItem(sessionKey(token));
    if (sessionStorage.getItem(TOKEN_KEY) === token) sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export const SAVE_SEARCH_GUEST_NUDGE_SESSION_KEY = "bestie:save-search-guest-nudge-dismissed";
export const SAVE_SEARCH_PENDING_ACTION_KEY = "bestie:save-search-pending-action";

export type SaveSearchPendingAction = "save" | "follow";

export function isSaveSearchGuestNudgeDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.sessionStorage.getItem(SAVE_SEARCH_GUEST_NUDGE_SESSION_KEY) === "1";
  } catch {
    return true;
  }
}

export function dismissSaveSearchGuestNudge(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SAVE_SEARCH_GUEST_NUDGE_SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function setSaveSearchPendingAction(action: SaveSearchPendingAction): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SAVE_SEARCH_PENDING_ACTION_KEY, action);
  } catch {
    /* ignore */
  }
}

export function consumeSaveSearchPendingAction(): SaveSearchPendingAction | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SAVE_SEARCH_PENDING_ACTION_KEY);
    window.sessionStorage.removeItem(SAVE_SEARCH_PENDING_ACTION_KEY);
    if (raw === "save" || raw === "follow") return raw;
    return null;
  } catch {
    return null;
  }
}

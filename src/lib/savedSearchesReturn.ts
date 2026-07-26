/** Snapshot of `/mis-busquedas` URL to restore tab/search when returning from the map. */
export type SavedSearchesReturnContext = {
  pathname: string;
  search: string;
};

export function savedSearchesReturnFromLocation(
  pathname: string,
  search: string,
): SavedSearchesReturnContext {
  return { pathname, search };
}

export function readSavedSearchesReturn(state: unknown): SavedSearchesReturnContext | null {
  if (!state || typeof state !== "object") return null;
  const raw = (state as { savedSearchesReturn?: unknown }).savedSearchesReturn;
  if (!raw || typeof raw !== "object") return null;
  const { pathname, search } = raw as SavedSearchesReturnContext;
  if (typeof pathname !== "string" || !pathname.startsWith("/mis-busquedas")) return null;
  if (typeof search !== "string") return null;
  return { pathname, search };
}

export function savedSearchesNavigationState(savedSearchesReturn: SavedSearchesReturnContext) {
  return { savedSearchesReturn };
}

/** Restore Mis Búsquedas with the same query string (tab / search if any). */
export function buildSavedSearchesRestorePath(
  savedSearchesReturn: SavedSearchesReturnContext,
): string {
  const qs = savedSearchesReturn.search.startsWith("?")
    ? savedSearchesReturn.search.slice(1)
    : savedSearchesReturn.search;
  return qs ? `${savedSearchesReturn.pathname}?${qs}` : savedSearchesReturn.pathname;
}

/** Merge into an existing location.state object without dropping other keys. */
export function withSavedSearchesReturn(
  state: unknown,
  savedSearchesReturn: SavedSearchesReturnContext | null | undefined,
): Record<string, unknown> | undefined {
  const base =
    state && typeof state === "object" && !Array.isArray(state)
      ? { ...(state as Record<string, unknown>) }
      : {};
  if (savedSearchesReturn) {
    base.savedSearchesReturn = savedSearchesReturn;
  } else {
    delete base.savedSearchesReturn;
  }
  return Object.keys(base).length > 0 ? base : undefined;
}

/**
 * Snapshot of the narrowed search a user left when tapping "Ver todas (N)", so
 * the same control can bring their saved-search criteria back.
 */
export type ViewAllCityReturnContext = {
  pathname: string;
  search: string;
};

const STATE_KEY = "viewAllCityReturn";

export function readViewAllCityReturn(state: unknown): ViewAllCityReturnContext | null {
  if (!state || typeof state !== "object") return null;
  const raw = (state as Record<string, unknown>)[STATE_KEY];
  if (!raw || typeof raw !== "object") return null;
  const { pathname, search } = raw as ViewAllCityReturnContext;
  if (typeof pathname !== "string") return null;
  if (!pathname.startsWith("/buscar") && !pathname.startsWith("/busquedas")) return null;
  if (typeof search !== "string") return null;
  return { pathname, search };
}

/** Merge the snapshot into `location.state` without dropping other keys (e.g. `savedSearchesReturn`). */
export function withViewAllCityReturn(
  state: unknown,
  viewAllCityReturn: ViewAllCityReturnContext,
): Record<string, unknown> {
  const base =
    state && typeof state === "object" && !Array.isArray(state)
      ? { ...(state as Record<string, unknown>) }
      : {};
  base[STATE_KEY] = viewAllCityReturn;
  return base;
}

export function withoutViewAllCityReturn(state: unknown): Record<string, unknown> | undefined {
  if (!state || typeof state !== "object" || Array.isArray(state)) return undefined;
  const base = { ...(state as Record<string, unknown>) };
  delete base[STATE_KEY];
  return Object.keys(base).length > 0 ? base : undefined;
}

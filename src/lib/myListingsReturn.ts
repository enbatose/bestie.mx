/** Snapshot of `/mis-anuncios` URL to restore tab/search when returning from a detail page. */
export type MyListingsReturnContext = {
  pathname: string;
  search: string;
};

export function myListingsReturnFromLocation(
  pathname: string,
  search: string,
): MyListingsReturnContext {
  return { pathname, search };
}

export function readMyListingsReturn(state: unknown): MyListingsReturnContext | null {
  if (!state || typeof state !== "object") return null;
  const raw = (state as { myListingsReturn?: unknown }).myListingsReturn;
  if (!raw || typeof raw !== "object") return null;
  const { pathname, search } = raw as MyListingsReturnContext;
  if (typeof pathname !== "string" || !pathname.startsWith("/mis-anuncios")) return null;
  if (typeof search !== "string") return null;
  return { pathname, search };
}

export function myListingsNavigationState(myListingsReturn: MyListingsReturnContext) {
  return { myListingsReturn };
}

/** Restore Mis Anuncios with the same query string (tabs / filters if any). */
export function buildMyListingsRestorePath(myListingsReturn: MyListingsReturnContext): string {
  const qs = myListingsReturn.search.startsWith("?")
    ? myListingsReturn.search.slice(1)
    : myListingsReturn.search;
  return qs ? `${myListingsReturn.pathname}?${qs}` : myListingsReturn.pathname;
}

/** Merge into an existing location.state object without dropping other keys. */
export function withMyListingsReturn(
  state: unknown,
  myListingsReturn: MyListingsReturnContext | null | undefined,
): Record<string, unknown> | undefined {
  const base =
    state && typeof state === "object" && !Array.isArray(state)
      ? { ...(state as Record<string, unknown>) }
      : {};
  if (myListingsReturn) {
    base.myListingsReturn = myListingsReturn;
  } else {
    delete base.myListingsReturn;
  }
  return Object.keys(base).length > 0 ? base : undefined;
}

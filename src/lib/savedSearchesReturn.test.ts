import { describe, expect, it } from "vitest";
import {
  buildSavedSearchesRestorePath,
  readSavedSearchesReturn,
  savedSearchesNavigationState,
  savedSearchesReturnFromLocation,
  withSavedSearchesReturn,
} from "./savedSearchesReturn";

describe("savedSearchesReturn", () => {
  it("reads and restores a Mis Búsquedas snapshot", () => {
    const ctx = savedSearchesReturnFromLocation("/mis-busquedas", "?tab=with-alert");
    const state = savedSearchesNavigationState(ctx);
    expect(readSavedSearchesReturn(state)).toEqual(ctx);
    expect(buildSavedSearchesRestorePath(ctx)).toBe("/mis-busquedas?tab=with-alert");
  });

  it("rejects non-Mis-Búsquedas paths", () => {
    expect(
      readSavedSearchesReturn({ savedSearchesReturn: { pathname: "/buscar", search: "" } }),
    ).toBeNull();
    expect(readSavedSearchesReturn(null)).toBeNull();
  });

  it("merges into existing location state", () => {
    const ctx = savedSearchesReturnFromLocation("/mis-busquedas", "");
    expect(withSavedSearchesReturn({ listingUpdated: true }, ctx)).toEqual({
      listingUpdated: true,
      savedSearchesReturn: ctx,
    });
    expect(withSavedSearchesReturn({ savedSearchesReturn: ctx }, null)).toBeUndefined();
  });
});

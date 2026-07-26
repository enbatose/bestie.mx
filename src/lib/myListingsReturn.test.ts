import { describe, expect, it } from "vitest";
import {
  buildMyListingsRestorePath,
  myListingsNavigationState,
  myListingsReturnFromLocation,
  readMyListingsReturn,
  withMyListingsReturn,
} from "./myListingsReturn";

describe("myListingsReturn", () => {
  it("reads and restores a Mis Anuncios snapshot", () => {
    const ctx = myListingsReturnFromLocation("/mis-anuncios", "?tab=draft");
    const state = myListingsNavigationState(ctx);
    expect(readMyListingsReturn(state)).toEqual(ctx);
    expect(buildMyListingsRestorePath(ctx)).toBe("/mis-anuncios?tab=draft");
  });

  it("rejects non-Mis-Anuncios paths", () => {
    expect(readMyListingsReturn({ myListingsReturn: { pathname: "/buscar", search: "" } })).toBeNull();
    expect(readMyListingsReturn(null)).toBeNull();
  });

  it("merges into existing location state", () => {
    const ctx = myListingsReturnFromLocation("/mis-anuncios", "");
    expect(withMyListingsReturn({ listingUpdated: true }, ctx)).toEqual({
      listingUpdated: true,
      myListingsReturn: ctx,
    });
    expect(withMyListingsReturn({ myListingsReturn: ctx }, null)).toBeUndefined();
  });
});

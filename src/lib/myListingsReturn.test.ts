import { describe, expect, it } from "vitest";
import {
  buildMyListingsHubPath,
  buildMyListingsRestorePath,
  myListingsNavigationState,
  myListingsPropertyDomId,
  myListingsReturnFromLocation,
  parseMyListingsTab,
  readMyListingsReturn,
  withMyListingsReturn,
} from "./myListingsReturn";

describe("myListingsReturn", () => {
  it("parses hub tab query values", () => {
    expect(parseMyListingsTab("draft")).toBe("draft");
    expect(parseMyListingsTab("published")).toBe("published");
    expect(parseMyListingsTab("archived")).toBe("archived");
    expect(parseMyListingsTab("paused")).toBeNull();
    expect(parseMyListingsTab(null)).toBeNull();
  });

  it("builds hub paths with tab and focus", () => {
    expect(buildMyListingsHubPath({ tab: "draft" })).toBe("/mis-anuncios?tab=draft");
    expect(buildMyListingsHubPath({ tab: "draft", focusPropertyId: "prop-1" })).toBe(
      "/mis-anuncios?tab=draft&focus=prop-1",
    );
    expect(myListingsPropertyDomId("prop-1")).toBe("listing-property-prop-1");
  });

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

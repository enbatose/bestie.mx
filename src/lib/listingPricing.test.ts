import { describe, expect, it } from "vitest";
import {
  interleaveHiddenPricingListings,
  interleaveHiddenPricingListingsStable,
  isPricingHidden,
} from "./listingPricing";

describe("interleaveHiddenPricingListings", () => {
  it("keeps priced order and inserts hidden at rng indexes", () => {
    const priced = [
      { id: "a", hidePricing: false },
      { id: "b", hidePricing: false },
      { id: "c", hidePricing: false },
    ];
    const hidden = [{ id: "h1", hidePricing: true }, { id: "h2", hidePricing: true }];
    const seq = [0, 0.4];
    let i = 0;
    const out = interleaveHiddenPricingListings([...priced, ...hidden], () => seq[i++] ?? 0);
    expect(out.map((r) => r.id)).toEqual(["h1", "a", "h2", "b", "c"]);
  });

  it("returns only hidden rows when every listing hides price", () => {
    const rows = [{ id: "h1", hidePricing: true }, { id: "h2", hidePricing: true }];
    expect(interleaveHiddenPricingListings(rows, () => 1).map((r) => r.id)).toEqual(["h1", "h2"]);
  });

  it("stable shuffle is deterministic for the same ids", () => {
    const rows = [
      { id: "a", hidePricing: false },
      { id: "b", hidePricing: false },
      { id: "h1", hidePricing: true },
    ];
    expect(interleaveHiddenPricingListingsStable(rows).map((r) => r.id)).toEqual(
      interleaveHiddenPricingListingsStable(rows).map((r) => r.id),
    );
  });
});

describe("isPricingHidden", () => {
  it("is true only when the flag is set", () => {
    expect(isPricingHidden(undefined)).toBe(false);
    expect(isPricingHidden({})).toBe(false);
    expect(isPricingHidden({ hidePricing: true })).toBe(true);
  });
});

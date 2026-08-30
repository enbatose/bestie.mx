import { describe, expect, it } from "vitest";
import {
  applyDraftHidePricing,
  draftHasRealListingPhone,
  draftHidePricingContactOk,
  hidePricingContactRequired,
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

describe("hidePricingContactRequired", () => {
  it("is only required on published listings", () => {
    expect(hidePricingContactRequired("draft")).toBe(false);
    expect(hidePricingContactRequired("paused")).toBe(false);
    expect(hidePricingContactRequired("published")).toBe(true);
  });
});

describe("isPricingHidden", () => {
  it("is true only when the flag is set", () => {
    expect(isPricingHidden(undefined)).toBe(false);
    expect(isPricingHidden({})).toBe(false);
    expect(isPricingHidden({ hidePricing: true })).toBe(true);
  });
});

describe("applyDraftHidePricing", () => {
  it("treats placeholder digits as no phone", () => {
    expect(draftHasRealListingPhone("0000000000000")).toBe(false);
    expect(draftHasRealListingPhone("3329306218")).toBe(true);
  });

  it("allows hide-pricing on a draft with no phone and no chat", () => {
    const draft = { hidePricing: false, showWhatsApp: false, contactWhatsApp: "" };
    expect(applyDraftHidePricing(draft, true, { hasChat: false, requireContact: false })).toEqual({
      hidePricing: true,
      showWhatsApp: false,
      contactWhatsApp: "",
    });
    expect(draftHidePricingContactOk(draft, { hasChat: false, requireContact: false })).toBe(true);
  });

  it("allows hide-pricing via Bestie chat without a phone", () => {
    const next = applyDraftHidePricing(
      { hidePricing: false, showWhatsApp: false, contactWhatsApp: "" },
      true,
      { hasChat: true },
    );
    expect(next).toEqual({ hidePricing: true, showWhatsApp: false, contactWhatsApp: "" });
    expect(draftHidePricingContactOk({ showWhatsApp: false, contactWhatsApp: "" }, { hasChat: true })).toBe(
      true,
    );
  });

  it("reveals a stored phone on a published listing with no chat", () => {
    const next = applyDraftHidePricing(
      { hidePricing: false, showWhatsApp: false, contactWhatsApp: "3329306218" },
      true,
      { hasChat: false, requireContact: true },
    );
    expect(next.hidePricing).toBe(true);
    expect(next.showWhatsApp).toBe(true);
  });

  it("does not enable hide-pricing on a published listing without phone or chat", () => {
    const draft = { hidePricing: false, showWhatsApp: false, contactWhatsApp: "" };
    expect(applyDraftHidePricing(draft, true, { hasChat: false, requireContact: true })).toEqual(draft);
    expect(draftHidePricingContactOk(draft, { hasChat: false, requireContact: true })).toBe(false);
  });
});

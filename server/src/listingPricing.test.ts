import { describe, expect, it } from "vitest";
import { hidePricingContactRequired, resolveShowWhatsappForHidePricing } from "./listingPricing.js";

describe("hidePricingContactRequired", () => {
  it("is only required on published listings", () => {
    expect(hidePricingContactRequired("draft")).toBe(false);
    expect(hidePricingContactRequired("paused")).toBe(false);
    expect(hidePricingContactRequired("published")).toBe(true);
  });
});

describe("resolveShowWhatsappForHidePricing", () => {
  it("leaves show-whatsapp unchanged when prices stay visible", () => {
    expect(
      resolveShowWhatsappForHidePricing({
        hidePricing: false,
        showWhatsapp: 0,
        hasPublicPhone: false,
        hasChat: false,
        hasStoredPhone: true,
      }),
    ).toEqual({ ok: true, showWhatsapp: 0 });
  });

  it("reveals a stored phone on unclaimed outreach", () => {
    expect(
      resolveShowWhatsappForHidePricing({
        hidePricing: true,
        showWhatsapp: 0,
        hasPublicPhone: false,
        hasChat: false,
        hasStoredPhone: true,
      }),
    ).toEqual({ ok: true, showWhatsapp: 1 });
  });

  it("rejects hide-pricing without phone or chat", () => {
    expect(
      resolveShowWhatsappForHidePricing({
        hidePricing: true,
        showWhatsapp: 0,
        hasPublicPhone: false,
        hasChat: false,
        hasStoredPhone: false,
      }),
    ).toEqual({ ok: false });
  });
});

import { describe, expect, it } from "vitest";
import { claimPublishMissingRent, outreachHidePricingForMissingRent } from "./claimPublishRent.js";

describe("claimPublishMissingRent", () => {
  it("does not require rent on occupied rooms when available rooms have prices", () => {
    expect(
      claimPublishMissingRent([
        { rent_mxn: 5800, occupancy_status: "available" },
        { rent_mxn: 5400, occupancy_status: "available" },
        { rent_mxn: 0, occupancy_status: "occupied" },
      ]),
    ).toBe(false);
  });

  it("requires rent when an available room is still 0", () => {
    expect(
      claimPublishMissingRent([
        { rent_mxn: 0, occupancy_status: "available" },
        { rent_mxn: 0, occupancy_status: "occupied" },
      ]),
    ).toBe(true);
  });

  it("rejects an empty room list", () => {
    expect(claimPublishMissingRent([])).toBe(true);
  });

  it("skips rent when hidePricing is on", () => {
    expect(
      claimPublishMissingRent([{ rent_mxn: 0, occupancy_status: "available" }], true),
    ).toBe(false);
  });
});

describe("outreachHidePricingForMissingRent", () => {
  it("turns hide-pricing on when AI extracted no monthly rent", () => {
    expect(outreachHidePricingForMissingRent(undefined)).toBe(true);
    expect(outreachHidePricingForMissingRent(0)).toBe(true);
    expect(outreachHidePricingForMissingRent(null)).toBe(true);
  });

  it("leaves hide-pricing off when a real rent was extracted", () => {
    expect(outreachHidePricingForMissingRent(5500)).toBe(false);
  });
});

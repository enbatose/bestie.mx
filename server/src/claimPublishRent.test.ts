import { describe, expect, it } from "vitest";
import { claimPublishMissingRent } from "./claimPublishRent.js";

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

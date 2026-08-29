import { describe, expect, it } from "vitest";
import {
  filterListingCallingCodes,
  listingCallingCodeOptions,
} from "@/lib/listingCallingCodes";

describe("listingCallingCodes", () => {
  it("pins México first and can filter by name or dial", () => {
    const all = listingCallingCodeOptions();
    const ordered = filterListingCallingCodes(all, "");
    expect(ordered[0]?.iso).toBe("MX");
    expect(ordered.length).toBeGreaterThan(80);

    const colombia = filterListingCallingCodes(all, "colo");
    expect(colombia.some((o) => o.iso === "CO" && o.dial === "57")).toBe(true);

    const byDial = filterListingCallingCodes(all, "34");
    expect(byDial.some((o) => o.iso === "ES")).toBe(true);
  });
});

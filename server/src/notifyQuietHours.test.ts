import { describe, expect, it } from "vitest";
import { isNotifyQuietHours } from "./notifyQuietHours.js";

describe("isNotifyQuietHours", () => {
  const gdl = "America/Mexico_City";
  const cun = "America/Cancun";

  it("is quiet from 23:00 through 06:00 local and open at 06:01", () => {
    // 22:59 CDMX 6 Sep 2026
    expect(isNotifyQuietHours(new Date("2026-09-07T04:59:00.000Z"), gdl)).toBe(false);
    // 23:00 CDMX
    expect(isNotifyQuietHours(new Date("2026-09-07T05:00:00.000Z"), gdl)).toBe(true);
    // 01:00 CDMX 7 Sep
    expect(isNotifyQuietHours(new Date("2026-09-07T07:00:00.000Z"), gdl)).toBe(true);
    // 06:00 CDMX
    expect(isNotifyQuietHours(new Date("2026-09-07T12:00:00.000Z"), gdl)).toBe(true);
    // 06:01 CDMX
    expect(isNotifyQuietHours(new Date("2026-09-07T12:01:00.000Z"), gdl)).toBe(false);
    // noon CDMX
    expect(isNotifyQuietHours(new Date("2026-09-07T18:00:00.000Z"), gdl)).toBe(false);
  });

  it("uses the listing timezone, not Mexico City by default", () => {
    // 22:00 CDMX = 23:00 Cancún (UTC-5 vs UTC-6)
    const at = new Date("2026-09-07T04:00:00.000Z");
    expect(isNotifyQuietHours(at, gdl)).toBe(false);
    expect(isNotifyQuietHours(at, cun)).toBe(true);
  });
});

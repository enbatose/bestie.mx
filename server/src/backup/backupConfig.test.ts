import { describe, expect, it } from "vitest";
import {
  dailyObjectKey,
  isMexicoCityMidnightHour,
  latestObjectKey,
  mexicoCityParts,
  weeklyObjectKey,
} from "./backupConfig.js";

describe("backupConfig", () => {
  it("builds stable object keys", () => {
    expect(dailyObjectKey("2026-07-31")).toBe("bestie-prod/daily/2026-07-31/bestie-data.tar.gz");
    expect(weeklyObjectKey("2026-07-26")).toBe("bestie-prod/weekly/2026-07-26/bestie-data.tar.gz");
    expect(latestObjectKey()).toBe("bestie-prod/latest/bestie-data.tar.gz");
  });

  it("reads Mexico City calendar parts (UTC-6, no DST since 2022)", () => {
    // 2026-08-01 05:30 UTC = 2026-07-31 23:30 Mexico City
    const evening = mexicoCityParts(new Date("2026-08-01T05:30:00.000Z"));
    expect(evening.dateKey).toBe("2026-07-31");
    expect(evening.hour).toBe(23);

    // 2026-08-01 06:15 UTC = 2026-08-01 00:15 Mexico City → midnight hour
    const midnight = new Date("2026-08-01T06:15:00.000Z");
    expect(mexicoCityParts(midnight).dateKey).toBe("2026-08-01");
    expect(mexicoCityParts(midnight).hour).toBe(0);
    expect(isMexicoCityMidnightHour(midnight)).toBe(true);

    // 2026-08-01 07:15 UTC = 01:15 Mexico City
    expect(isMexicoCityMidnightHour(new Date("2026-08-01T07:15:00.000Z"))).toBe(false);
  });
});

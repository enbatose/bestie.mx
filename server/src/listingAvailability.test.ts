import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { SMS_NOTIFY_MAX_CHARS } from "./listingFirstSeekerSms.js";
import {
  availabilityAgeDays,
  availabilityCycleStartMs,
  availabilityNotifyPlan,
  ensureListingAvailabilitySchema,
  listingAvailabilityClock,
  shouldPauseForAvailability,
  shouldSendAvailabilityNotice,
  AVAILABILITY_NOTICE_AFTER_DAYS,
  AVAILABILITY_PAUSE_AFTER_NOTICE_DAYS,
  AVAILABILITY_WINDOW_DAYS,
} from "./listingAvailability.js";
import { buildListingAvailabilitySms } from "./listingAvailabilitySms.js";

const DAY = 24 * 60 * 60 * 1000;

function daysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * DAY).toISOString();
}

describe("availability clock", () => {
  const now = new Date("2026-09-07T18:00:00.000Z");

  it("starts the clock at the later of publish and confirmation", () => {
    const start = availabilityCycleStartMs("2026-08-01T00:00:00.000Z", "2026-08-20T00:00:00.000Z");
    expect(start).toBe(Date.parse("2026-08-20T00:00:00.000Z"));
  });

  it("sends a notice at day 25 and does not pause until 5 days after that notice", () => {
    const publishedAt = daysAgo(now, 25);
    expect(
      shouldSendAvailabilityNotice({
        status: "published",
        publishedAt,
        confirmedAt: null,
        noticeSentAt: null,
        now,
      }),
    ).toBe(true);
    expect(
      shouldPauseForAvailability({
        status: "published",
        publishedAt,
        confirmedAt: null,
        noticeSentAt: null,
        now,
      }),
    ).toBe(false);

    const noticeSentAt = now.toISOString();
    const fourDaysLater = new Date(now.getTime() + 4 * DAY);
    expect(
      shouldPauseForAvailability({
        status: "published",
        publishedAt,
        confirmedAt: null,
        noticeSentAt,
        now: fourDaysLater,
      }),
    ).toBe(false);
    const fiveDaysLater = new Date(now.getTime() + AVAILABILITY_PAUSE_AFTER_NOTICE_DAYS * DAY);
    expect(
      shouldPauseForAvailability({
        status: "published",
        publishedAt,
        confirmedAt: null,
        noticeSentAt,
        now: fiveDaysLater,
      }),
    ).toBe(true);
  });

  it("does not pause an already-old post until the notice grace elapses", () => {
    const publishedAt = daysAgo(now, 60);
    expect(
      shouldPauseForAvailability({
        status: "published",
        publishedAt,
        confirmedAt: null,
        noticeSentAt: null,
        now,
      }),
    ).toBe(false);
    expect(
      shouldSendAvailabilityNotice({
        status: "published",
        publishedAt,
        confirmedAt: null,
        noticeSentAt: null,
        now,
      }),
    ).toBe(true);
  });

  it("resets the cycle when they confirm", () => {
    const publishedAt = daysAgo(now, 40);
    const confirmedAt = daysAgo(now, 2);
    expect(availabilityAgeDays(availabilityCycleStartMs(publishedAt, confirmedAt)!, now)).toBeLessThan(
      AVAILABILITY_NOTICE_AFTER_DAYS,
    );
    expect(
      shouldSendAvailabilityNotice({
        status: "published",
        publishedAt,
        confirmedAt,
        noticeSentAt: daysAgo(now, 15),
        now,
      }),
    ).toBe(false);
  });
});

describe("listingAvailabilityClock", () => {
  const now = new Date("2026-09-07T18:00:00.000Z");

  it("reports the day within the 30-day window", () => {
    const clock = listingAvailabilityClock({
      status: "published",
      publishedAt: daysAgo(now, 11),
      confirmedAt: null,
      noticeSentAt: null,
      now,
    });
    expect(clock.dayOfWindow).toBe(12);
    expect(clock.expiresWithin5Days).toBe(false);
  });

  it("marks day 26 as expiring within 5 days", () => {
    const clock = listingAvailabilityClock({
      status: "published",
      publishedAt: daysAgo(now, 25),
      confirmedAt: null,
      noticeSentAt: null,
      now,
    });
    expect(clock.dayOfWindow).toBe(26);
    expect(clock.expiresWithin5Days).toBe(true);
    expect(clock.daysUntilPause).toBe(AVAILABILITY_PAUSE_AFTER_NOTICE_DAYS);
  });

  it("caps the displayed day at 30", () => {
    const clock = listingAvailabilityClock({
      status: "published",
      publishedAt: daysAgo(now, 40),
      confirmedAt: null,
      noticeSentAt: daysAgo(now, 1),
      now,
    });
    expect(clock.dayOfWindow).toBe(AVAILABILITY_WINDOW_DAYS);
    expect(clock.expiresWithin5Days).toBe(true);
  });
});

describe("availability notify channels", () => {
  it("emails and texts when both exist and SMS opt-in is on", () => {
    expect(
      availabilityNotifyPlan({
        email: "ana@example.com",
        phoneE164: "+523311112222",
        phoneNotifyOptIn: true,
        phoneOnly: false,
      }),
    ).toEqual({ email: true, sms: true });
  });

  it("emails only when both exist and SMS opt-in is off", () => {
    expect(
      availabilityNotifyPlan({
        email: "ana@example.com",
        phoneE164: "+523311112222",
        phoneNotifyOptIn: false,
        phoneOnly: false,
      }),
    ).toEqual({ email: true, sms: false });
  });

  it("texts phone-only contacts without opt-in", () => {
    expect(
      availabilityNotifyPlan({
        email: null,
        phoneE164: "+523311112222",
        phoneNotifyOptIn: false,
        phoneOnly: true,
      }),
    ).toEqual({ email: false, sms: true });
  });
});

describe("buildListingAvailabilitySms", () => {
  it("names the post and stays within 160 characters", () => {
    const text = buildListingAvailabilitySms({
      title: "Recámara amueblada privada céntrica luminosa amplia con balcón y roof garden en Americana",
      confirmUrl: "bestie.mx/c/k7m2pq",
      pauseUrl: "bestie.mx/p/k7m2pq",
    });
    expect(text).toContain("bestie.mx/c/k7m2pq");
    expect(text).toContain("bestie.mx/p/k7m2pq");
    expect(text).toContain("cumple 30 días");
    expect(Array.from(text).length).toBeLessThanOrEqual(SMS_NOTIFY_MAX_CHARS);
  });
});

describe("availability schema helpers", () => {
  it("opens the action-code table on a minimal properties db", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(`CREATE TABLE properties (id TEXT PRIMARY KEY, status TEXT)`);
    ensureListingAvailabilitySchema(db);
    const cols = db.prepare(`PRAGMA table_info(properties)`).all() as { name: string }[];
    expect(cols.map((c) => c.name)).toContain("availability_confirmed_at");
    expect(cols.map((c) => c.name)).toContain("availability_notice_sent_at");
  });
});

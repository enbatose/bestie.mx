import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { SMS_NOTIFY_MAX_CHARS } from "./listingFirstSeekerSms.js";
import {
  availabilityAgeDays,
  availabilityCycleStartMs,
  availabilityNotifyPlan,
  confirmRoomStillFree,
  ensureListingAvailabilitySchema,
  listingAvailabilityClock,
  markRoomRented,
  shouldPauseForAvailability,
  shouldSendAvailabilityNotice,
  AVAILABILITY_NOTICE_AFTER_DAYS,
  AVAILABILITY_PAUSE_AFTER_NOTICE_DAYS,
  AVAILABILITY_WINDOW_DAYS,
} from "./listingAvailability.js";
import { buildListingAvailabilityDigestSms, buildListingAvailabilitySms } from "./listingAvailabilitySms.js";

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
  it("uses one link and names the post when nobody asked for the number", () => {
    const text = buildListingAvailabilitySms({
      title: "Recámara amueblada privada céntrica luminosa amplia con balcón y roof garden en Americana",
      confirmUrl: "https://bestie.mx/c/k7m2pq",
      revealPeople: 0,
    });
    expect(text).toContain("https://bestie.mx/c/k7m2pq");
    expect(text).toContain("se oculta en 5 días");
    expect(text).not.toContain("/p/");
    expect(Array.from(text).length).toBeLessThanOrEqual(SMS_NOTIFY_MAX_CHARS);
  });

  it("mentions phone asks as a reason to answer, not as proof it is free", () => {
    const text = buildListingAvailabilitySms({
      title: "Cuarto en Americana",
      confirmUrl: "https://bestie.mx/c/k7m2pq",
      revealPeople: 3,
    });
    expect(text).toBe(
      'Bestie: 3 personas pidieron tu número por "Cuarto en Americana". ¿Sigue libre? https://bestie.mx/c/k7m2pq',
    );
  });
});

describe("buildListingAvailabilityDigestSms", () => {
  it("sends one morning text for several claimed posts", () => {
    const text = buildListingAvailabilityDigestSms({
      count: 3,
      hubUrl: "https://bestie.mx/mis-anuncios",
    });
    expect(text).toBe("Bestie: 3 anuncios se ocultan en 5 días si no confirmas. https://bestie.mx/mis-anuncios");
    expect(Array.from(text).length).toBeLessThanOrEqual(SMS_NOTIFY_MAX_CHARS);
  });
});

describe("availability confirmation titles", () => {
  function dbWithPost(opts: { postMode: string; roomTitle: string; extraRoom?: boolean }): DatabaseSync {
    const db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE properties (
        id TEXT PRIMARY KEY,
        publisher_id TEXT,
        status TEXT,
        post_mode TEXT,
        title TEXT,
        city TEXT,
        neighborhood TEXT,
        contact_whatsapp TEXT,
        published_at TEXT,
        availability_confirmed_at TEXT,
        availability_notice_sent_at TEXT,
        paused_by TEXT
      );
      CREATE TABLE rooms (
        id TEXT PRIMARY KEY,
        property_id TEXT,
        status TEXT,
        title TEXT,
        custom_name TEXT,
        occupancy_status TEXT,
        availability_confirmed_at TEXT,
        sort_order INTEGER,
        paused_by TEXT,
        updated_at TEXT
      );
    `);
    ensureListingAvailabilitySchema(db);
    db.prepare(
      `INSERT INTO properties (id, publisher_id, status, post_mode, title, city, neighborhood)
       VALUES ('prp-1', 'pub-1', 'published', ?, 'Casa con balcón en Versalles', 'Guadalajara', 'Chapalita')`,
    ).run(opts.postMode);
    db.prepare(
      `INSERT INTO rooms (id, property_id, status, title, custom_name, occupancy_status, sort_order)
       VALUES ('room-1', 'prp-1', 'published', ?, ?, 'available', 0)`,
    ).run(opts.roomTitle, opts.roomTitle);
    if (opts.extraRoom) {
      db.prepare(
        `INSERT INTO rooms (id, property_id, status, title, custom_name, occupancy_status, sort_order)
         VALUES ('room-2', 'prp-1', 'published', 'Recámara 2', 'Recámara 2', 'available', 1)`,
      ).run();
    }
    return db;
  }

  it("names a single-room post by its listing title, not the default Recámara 1", () => {
    const db = dbWithPost({ postMode: "room", roomTitle: "Recámara 1" });
    expect(markRoomRented(db, "prp-1", "room-1")).toMatchObject({
      ok: true,
      outcome: "rented",
      title: "Casa con balcón en Versalles",
    });
  });

  it("keeps the room name when a multi-room property marks one recámara rented", () => {
    const db = dbWithPost({ postMode: "property", roomTitle: "Recámara 1", extraRoom: true });
    expect(markRoomRented(db, "prp-1", "room-1")).toMatchObject({
      ok: true,
      outcome: "rented",
      title: "Recámara 1",
    });
  });

  it("uses the listing title when confirming a single-room post is still free", () => {
    const db = dbWithPost({ postMode: "room", roomTitle: "Recámara 1" });
    expect(confirmRoomStillFree(db, "prp-1", "room-1")).toMatchObject({
      ok: true,
      outcome: "confirmed",
      title: "Casa con balcón en Versalles",
    });
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

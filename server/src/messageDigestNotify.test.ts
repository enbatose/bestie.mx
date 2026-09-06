import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb } from "./db.js";
import { recordFirstSeekerListingMessage } from "./listingFirstSeekerNotify.js";
import * as mailer from "./mailer.js";
import { MESSAGE_DIGEST_DEBOUNCE_MS, sendMessageDigestForUser } from "./messageDigestNotify.js";
import * as sms from "./smsMasivosOtp.js";

const DAY = new Date("2026-09-06T18:00:00.000Z"); // 12:00 Guadalajara
const QUIET = new Date("2026-09-07T05:30:00.000Z"); // 23:30 Guadalajara 6 Sep
const MORNING = new Date("2026-09-07T12:01:00.000Z"); // 06:01 Guadalajara 7 Sep

function insertPublisherFixture(db: DatabaseSync): {
  publisherUserId: string;
  seekerId: string;
  roomId: string;
} {
  const now = DAY.toISOString();
  db.prepare(
    `INSERT INTO users (id, email, email_canonical, password_hash, display_name, created_at, email_verified_at, phone_e164, phone_verified_at, phone_notify_opt_in)
     VALUES ('pub-u', 'humberto@test.mx', 'humberto@test.mx', 'x', 'Humberto', ?, ?, '+523314655642', ?, 1)`,
  ).run(now, now, now);
  db.prepare(
    `INSERT INTO users (id, email, email_canonical, password_hash, display_name, created_at, email_verified_at)
     VALUES ('seek-a', 'alejandro@test.mx', 'alejandro@test.mx', 'x', 'Alejandro Padilla', ?, ?)`,
  ).run(now, now);
  db.prepare(`INSERT INTO user_publishers (user_id, publisher_id, created_at) VALUES ('pub-u', 'pub-1', ?)`).run(now);
  db.prepare(
    `INSERT INTO properties (
      id, publisher_id, status, post_mode, title, city, neighborhood,
      lat, lng, summary, contact_whatsapp, show_whatsapp, image_urls_json, created_at, published_at
    ) VALUES ('prp-1', 'pub-1', 'published', 'room', 'Cuarto Lafayette', 'Guadalajara', 'Lafayette',
      20.67, -103.35, 'Resumen', '523312345678', 1, '[]', ?, ?)`,
  ).run(now, now);
  db.prepare(
    `INSERT INTO rooms (
      id, property_id, status, title, rent_mxn, rooms_available, tags_json,
      roommate_gender_pref, age_min, age_max, summary
    ) VALUES ('room-1', 'prp-1', 'published', 'Recámara 1', 5500, 1, '[]', 'any', 18, 35, 'Resumen')`,
  ).run();
  return { publisherUserId: "pub-u", seekerId: "seek-a", roomId: "room-1" };
}

function addUnreadListingMessage(
  db: DatabaseSync,
  opts: { conversationId: string; seekerId: string; publisherUserId: string; roomId: string; messageId: string; body?: string },
): void {
  const now = DAY.toISOString();
  const existing = db.prepare(`SELECT id FROM conversations WHERE id = ?`).get(opts.conversationId) as
    | { id: string }
    | undefined;
  if (!existing) {
    db.prepare(
      `INSERT INTO conversations (id, listing_room_id, context_title, kind, created_at, updated_at)
       VALUES (?, ?, 'Cuarto Lafayette · Recámara 1', 'listing', ?, ?)`,
    ).run(opts.conversationId, opts.roomId, now, now);
    db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`).run(
      opts.conversationId,
      opts.seekerId,
    );
    db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`).run(
      opts.conversationId,
      opts.publisherUserId,
    );
  }
  db.prepare(
    `INSERT INTO messages (id, conversation_id, sender_user_id, body, created_at, read_at)
     VALUES (?, ?, ?, ?, ?, NULL)`,
  ).run(opts.messageId, opts.conversationId, opts.seekerId, opts.body ?? "Hola", now);
}

describe("message digest quiet hours and first-seeker SMS", () => {
  let dir: string;
  let db: DatabaseSync;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-digest-"));
    db = openDb(join(dir, "t.db"));
    vi.stubEnv("SMSMASIVOS_API_KEY", "test-key");
    vi.stubEnv("LISTING_FIRST_SEEKER_SMS", "");
    vi.spyOn(mailer, "sendTransactionalEmail").mockResolvedValue(true);
    vi.spyOn(sms, "smsMasivosSendSms").mockResolvedValue({ ok: true, sandbox: true });
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("sends email and SMS together on the first new seeker during the day", async () => {
    const fx = insertPublisherFixture(db);
    addUnreadListingMessage(db, {
      conversationId: "c1",
      seekerId: fx.seekerId,
      publisherUserId: fx.publisherUserId,
      roomId: fx.roomId,
      messageId: "m1",
    });
    const first = recordFirstSeekerListingMessage(db, {
      publisherUserId: fx.publisherUserId,
      seekerUserId: fx.seekerId,
      listingTitle: "Cuarto Lafayette · Recámara 1",
      excludeMessageId: "m1",
    });
    expect(first.isFirst).toBe(true);

    const ok = await sendMessageDigestForUser(db, fx.publisherUserId, DAY);
    expect(ok).toBe(true);
    expect(mailer.sendTransactionalEmail).toHaveBeenCalledOnce();
    expect(sms.smsMasivosSendSms).toHaveBeenCalledOnce();
    const smsBody = (sms.smsMasivosSendSms as ReturnType<typeof vi.fn>).mock.calls[0]![1] as string;
    expect(smsBody).toContain("Alejandro Padilla te escribió");
    expect(smsBody).toContain("Bestie.mx:");
  });

  it("holds a second new seeker until the 3-hour digest, then aggregates SMS", async () => {
    const fx = insertPublisherFixture(db);
    addUnreadListingMessage(db, {
      conversationId: "c1",
      seekerId: fx.seekerId,
      publisherUserId: fx.publisherUserId,
      roomId: fx.roomId,
      messageId: "m1",
    });
    recordFirstSeekerListingMessage(db, {
      publisherUserId: fx.publisherUserId,
      seekerUserId: fx.seekerId,
      listingTitle: "Cuarto Lafayette · Recámara 1",
      excludeMessageId: "m1",
    });
    await sendMessageDigestForUser(db, fx.publisherUserId, DAY);

    const now2 = DAY.toISOString();
    db.prepare(
      `INSERT INTO users (id, email, email_canonical, password_hash, display_name, created_at, email_verified_at)
       VALUES ('seek-b', 'maria@test.mx', 'maria@test.mx', 'x', 'María', ?, ?)`,
    ).run(now2, now2);
    addUnreadListingMessage(db, {
      conversationId: "c2",
      seekerId: "seek-b",
      publisherUserId: fx.publisherUserId,
      roomId: fx.roomId,
      messageId: "m2",
    });
    recordFirstSeekerListingMessage(db, {
      publisherUserId: fx.publisherUserId,
      seekerUserId: "seek-b",
      listingTitle: "Cuarto Lafayette · Recámara 1",
      excludeMessageId: "m2",
    });

    vi.mocked(mailer.sendTransactionalEmail).mockClear();
    vi.mocked(sms.smsMasivosSendSms).mockClear();
    const duringWait = await sendMessageDigestForUser(
      db,
      fx.publisherUserId,
      new Date(DAY.getTime() + 30 * 60 * 1000),
    );
    expect(duringWait).toBe(false);
    expect(mailer.sendTransactionalEmail).not.toHaveBeenCalled();
    expect(sms.smsMasivosSendSms).not.toHaveBeenCalled();

    const after3h = await sendMessageDigestForUser(
      db,
      fx.publisherUserId,
      new Date(DAY.getTime() + MESSAGE_DIGEST_DEBOUNCE_MS),
    );
    expect(after3h).toBe(true);
    expect(mailer.sendTransactionalEmail).toHaveBeenCalledOnce();
    expect(sms.smsMasivosSendSms).toHaveBeenCalledOnce();
    const smsBody = vi.mocked(sms.smsMasivosSendSms).mock.calls[0]![1];
    expect(smsBody).toContain("María te escribió");
    expect(smsBody).not.toContain("otro usuario");
  });

  it("does not send during quiet hours and sends once at 06:01 without stacking overnight lapses", async () => {
    const fx = insertPublisherFixture(db);
    addUnreadListingMessage(db, {
      conversationId: "c1",
      seekerId: fx.seekerId,
      publisherUserId: fx.publisherUserId,
      roomId: fx.roomId,
      messageId: "m1",
    });
    recordFirstSeekerListingMessage(db, {
      publisherUserId: fx.publisherUserId,
      seekerUserId: fx.seekerId,
      listingTitle: "Cuarto Lafayette · Recámara 1",
      excludeMessageId: "m1",
    });

    expect(await sendMessageDigestForUser(db, fx.publisherUserId, QUIET)).toBe(false);
    expect(await sendMessageDigestForUser(db, fx.publisherUserId, new Date("2026-09-07T08:00:00.000Z"))).toBe(false);
    expect(mailer.sendTransactionalEmail).not.toHaveBeenCalled();
    expect(sms.smsMasivosSendSms).not.toHaveBeenCalled();

    expect(await sendMessageDigestForUser(db, fx.publisherUserId, MORNING)).toBe(true);
    expect(mailer.sendTransactionalEmail).toHaveBeenCalledOnce();
    expect(sms.smsMasivosSendSms).toHaveBeenCalledOnce();

    vi.mocked(mailer.sendTransactionalEmail).mockClear();
    vi.mocked(sms.smsMasivosSendSms).mockClear();
    expect(await sendMessageDigestForUser(db, fx.publisherUserId, new Date(MORNING.getTime() + 60_000))).toBe(false);
    expect(mailer.sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("aggregates two new seekers held overnight into one 06:01 SMS", async () => {
    const fx = insertPublisherFixture(db);
    addUnreadListingMessage(db, {
      conversationId: "c1",
      seekerId: fx.seekerId,
      publisherUserId: fx.publisherUserId,
      roomId: fx.roomId,
      messageId: "m1",
    });
    recordFirstSeekerListingMessage(db, {
      publisherUserId: fx.publisherUserId,
      seekerUserId: fx.seekerId,
      listingTitle: "Cuarto Lafayette · Recámara 1",
      excludeMessageId: "m1",
    });
    const now2 = DAY.toISOString();
    db.prepare(
      `INSERT INTO users (id, email, email_canonical, password_hash, display_name, created_at, email_verified_at)
       VALUES ('seek-b', 'maria@test.mx', 'maria@test.mx', 'x', 'María', ?, ?)`,
    ).run(now2, now2);
    addUnreadListingMessage(db, {
      conversationId: "c2",
      seekerId: "seek-b",
      publisherUserId: fx.publisherUserId,
      roomId: fx.roomId,
      messageId: "m2",
    });
    recordFirstSeekerListingMessage(db, {
      publisherUserId: fx.publisherUserId,
      seekerUserId: "seek-b",
      listingTitle: "Cuarto Lafayette · Recámara 1",
      excludeMessageId: "m2",
    });

    expect(await sendMessageDigestForUser(db, fx.publisherUserId, QUIET)).toBe(false);
    expect(await sendMessageDigestForUser(db, fx.publisherUserId, MORNING)).toBe(true);
    expect(mailer.sendTransactionalEmail).toHaveBeenCalledOnce();
    expect(sms.smsMasivosSendSms).toHaveBeenCalledOnce();
    const smsBody = vi.mocked(sms.smsMasivosSendSms).mock.calls[0]![1];
    expect(smsBody).toContain("Alejandro Padilla y otro usuario te escribieron");
  });
});

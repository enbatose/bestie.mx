import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ARCO_TOMBSTONE_BODY,
  eraseUserForArco,
  hashArcoIdentifier,
  previewArcoErasure,
  searchArcoTargets,
} from "./arcoErasure.js";
import { canonicalLookupEmail } from "./authEmail.js";
import { openDb } from "./db.js";
import { DELETED_USER_ID, SUPPORT_BOT_USER_ID } from "./messagingSchema.js";

describe("ARCO user erasure", () => {
  let dir: string;
  let db: DatabaseSync;
  const prevAdmin = process.env.ADMIN_EMAILS;

  const adminId = randomUUID();
  const targetId = randomUUID();
  const seekerId = randomUUID();
  const publisherId = `pub-${targetId.slice(0, 8)}`;
  const propertyId = `prp__${randomUUID()}`;
  const roomId = randomUUID();
  const listingConvId = randomUUID();
  const supportConvId = randomUUID();
  const now = "2026-09-01T18:00:00.000Z";

  beforeAll(() => {
    process.env.ADMIN_EMAILS = "ops-arco@test.mx";
    dir = mkdtempSync(join(tmpdir(), "bestie-arco-"));
    db = openDb(join(dir, "t.db"));

    const insertUser = db.prepare(
      `INSERT INTO users (id, email, email_canonical, phone_e164, password_hash, display_name, created_at, email_verified_at)
       VALUES (?, ?, ?, ?, 'x', ?, ?, ?)`,
    );
    insertUser.run(
      adminId,
      "ops-arco@test.mx",
      canonicalLookupEmail("ops-arco@test.mx"),
      null,
      "Ops",
      now,
      now,
    );
    insertUser.run(
      targetId,
      "alexa.castelao@gmail.com",
      canonicalLookupEmail("alexa.castelao@gmail.com"),
      "+523312345678",
      "Alexa Castelao",
      now,
      now,
    );
    insertUser.run(seekerId, "seeker@test.mx", "seeker@test.mx", null, "Seeker", now, now);

    db.prepare(`INSERT INTO user_publishers (user_id, publisher_id, created_at) VALUES (?, ?, ?)`).run(
      targetId,
      publisherId,
      now,
    );
    db.prepare(
      `INSERT INTO properties
         (id, publisher_id, status, post_mode, title, city, neighborhood, lat, lng, summary, contact_whatsapp, image_urls_json)
       VALUES (?, ?, 'published', 'room', 'Cuarto en Americana', 'Guadalajara', 'Americana', 20.67, -103.35, 'Resumen', '3312345678', '[]')`,
    ).run(propertyId, publisherId);
    db.prepare(
      `INSERT INTO rooms
         (id, property_id, status, title, rent_mxn, rooms_available, tags_json, roommate_gender_pref, age_min, age_max, summary)
       VALUES (?, ?, 'published', 'Recámara 1', 5500, 1, '[]', 'any', 18, 35, 'Resumen')`,
    ).run(roomId, propertyId);

    db.prepare(
      `INSERT INTO conversations (id, listing_room_id, context_title, kind, created_at, updated_at)
       VALUES (?, ?, 'Cuarto en Americana', 'listing', ?, ?)`,
    ).run(listingConvId, roomId, now, now);
    db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`).run(
      listingConvId,
      targetId,
    );
    db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`).run(
      listingConvId,
      seekerId,
    );
    db.prepare(
      `INSERT INTO messages (id, conversation_id, sender_user_id, body, created_at)
       VALUES (?, ?, ?, 'Hola, el cuarto sigue disponible', ?)`,
    ).run(randomUUID(), listingConvId, targetId, now);
    db.prepare(
      `INSERT INTO messages (id, conversation_id, sender_user_id, body, created_at)
       VALUES (?, ?, ?, 'Me interesa', ?)`,
    ).run(randomUUID(), listingConvId, seekerId, now);

    db.prepare(
      `INSERT INTO conversations (id, listing_room_id, context_title, kind, created_at, updated_at)
       VALUES (?, NULL, 'Soporte', 'support', ?, ?)`,
    ).run(supportConvId, now, now);
    db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`).run(
      supportConvId,
      targetId,
    );
    db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`).run(
      supportConvId,
      SUPPORT_BOT_USER_ID,
    );
    db.prepare(
      `INSERT INTO messages (id, conversation_id, sender_user_id, body, created_at)
       VALUES (?, ?, ?, 'Quiero borrar mi cuenta', ?)`,
    ).run(randomUUID(), supportConvId, targetId, now);

    db.prepare(
      `INSERT INTO saved_searches
         (id, user_id, label, city_code, filters_json, location_json, search_url, unsubscribe_token, created_at, updated_at)
       VALUES (?, ?, 'GDL', 'gdl', '{}', '{}', '/buscar', ?, ?, ?)`,
    ).run(randomUUID(), targetId, randomUUID(), now, now);
  });

  afterAll(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
    process.env.ADMIN_EMAILS = prevAdmin;
  });

  it("searches by gmail dots-insensitive email and previews the listing", () => {
    const found = searchArcoTargets(db, "alexacastelao@gmail.com");
    expect(found.users.map((u) => u.user.id)).toContain(targetId);
    const preview = previewArcoErasure(db, targetId, adminId);
    expect(preview?.canErase).toBe(true);
    expect(preview?.listings).toHaveLength(1);
    expect(preview?.listings[0]?.title).toBe("Cuarto en Americana");
    expect(preview?.counts.properties).toBe(1);
    expect(preview?.counts.savedSearches).toBe(1);
    expect(preview?.counts.listingConversationsKept).toBe(1);
    expect(preview?.counts.supportConversationsDeleted).toBe(1);
  });

  it("refuses to erase an admin", () => {
    const preview = previewArcoErasure(db, adminId, seekerId);
    expect(preview?.canErase).toBe(false);
    expect(() =>
      eraseUserForArco(db, { userId: adminId, adminUserId: seekerId, emailConfirm: "ops-arco@test.mx" }),
    ).toThrow(/administrador|forbidden/i);
  });

  it("erases the user, listing, and support chat, and tombstones the listing thread", () => {
    const result = eraseUserForArco(db, {
      userId: targetId,
      adminUserId: adminId,
      emailConfirm: "alexa.castelao@gmail.com",
      source: "whatsapp",
      reason: "Solicitud ARCO Alexa",
    });
    expect(result.confirmationEmailTo).toBe("alexa.castelao@gmail.com");
    expect(result.confirmationPhoneE164).toBeNull();
    expect(result.whatsappMessage).toContain("ARCO");
    expect(result.counts.properties).toBe(1);

    const gone = db.prepare(`SELECT 1 AS x FROM users WHERE id = ?`).get(targetId) as { x: number } | undefined;
    expect(gone).toBeUndefined();
    const listing = db.prepare(`SELECT 1 AS x FROM properties WHERE id = ?`).get(propertyId) as
      | { x: number }
      | undefined;
    expect(listing).toBeUndefined();
    const room = db.prepare(`SELECT 1 AS x FROM rooms WHERE id = ?`).get(roomId) as { x: number } | undefined;
    expect(room).toBeUndefined();
    const support = db.prepare(`SELECT 1 AS x FROM conversations WHERE id = ?`).get(supportConvId) as
      | { x: number }
      | undefined;
    expect(support).toBeUndefined();

    const listingStill = db
      .prepare(`SELECT id FROM conversations WHERE id = ?`)
      .get(listingConvId) as { id: string } | undefined;
    expect(listingStill?.id).toBe(listingConvId);
    const peers = db
      .prepare(`SELECT user_id FROM conversation_participants WHERE conversation_id = ? ORDER BY user_id`)
      .all(listingConvId) as { user_id: string }[];
    expect(peers.map((p) => p.user_id).sort()).toEqual([DELETED_USER_ID, seekerId].sort());
    const bodies = db
      .prepare(`SELECT sender_user_id, body FROM messages WHERE conversation_id = ? ORDER BY created_at`)
      .all(listingConvId) as { sender_user_id: string; body: string }[];
    expect(bodies.some((m) => m.sender_user_id === DELETED_USER_ID && m.body === ARCO_TOMBSTONE_BODY)).toBe(
      true,
    );
    expect(bodies.some((m) => m.sender_user_id === seekerId && m.body === "Me interesa")).toBe(true);

    const searches = db.prepare(`SELECT COUNT(*) AS c FROM saved_searches WHERE user_id = ?`).get(targetId) as {
      c: number;
    };
    expect(searches.c).toBe(0);

    const after = searchArcoTargets(db, "alexacastelao@gmail.com");
    expect(after.users).toHaveLength(0);
    expect(after.priorErasures.length).toBeGreaterThan(0);
    expect(after.priorErasures[0]?.id).toBe(result.logId);
    const expectedHash = hashArcoIdentifier(canonicalLookupEmail("alexa.castelao@gmail.com"));
    const log = db
      .prepare(`SELECT email_hash FROM arco_erasure_log WHERE id = ?`)
      .get(result.logId) as { email_hash: string };
    expect(log.email_hash).toBe(expectedHash);
  });

  it("returns a phone SMS target when the account has no email", () => {
    const phoneOnlyId = randomUUID();
    db.prepare(
      `INSERT INTO users (id, email, email_canonical, phone_e164, password_hash, display_name, created_at, email_verified_at)
       VALUES (?, NULL, NULL, ?, 'x', ?, ?, NULL)`,
    ).run(phoneOnlyId, "+523398765432", "Phone Only", now);

    const preview = previewArcoErasure(db, phoneOnlyId, adminId);
    expect(preview?.user.email).toBeNull();
    expect(preview?.confirmHint).toContain(phoneOnlyId);

    const result = eraseUserForArco(db, {
      userId: phoneOnlyId,
      adminUserId: adminId,
      emailConfirm: phoneOnlyId,
      source: "admin",
    });
    expect(result.confirmationEmailTo).toBeNull();
    expect(result.confirmationPhoneE164).toBe("+523398765432");
    expect(result.confirmationPhoneLast4).toBe("5432");

    const gone = db.prepare(`SELECT 1 AS x FROM users WHERE id = ?`).get(phoneOnlyId) as { x: number } | undefined;
    expect(gone).toBeUndefined();
    const after = searchArcoTargets(db, "3398765432");
    expect(after.users).toHaveLength(0);
    expect(after.priorErasures.some((p) => p.id === result.logId)).toBe(true);
  });
});

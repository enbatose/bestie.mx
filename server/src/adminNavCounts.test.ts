import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { getAdminNavCounts } from "./adminNavCounts.js";
import { FEEDBACK_BOT_USER_ID, SUPPORT_BOT_USER_ID, ensureMessagingSchema } from "./messagingSchema.js";

function setupDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT,
      email_canonical TEXT,
      phone_e164 TEXT,
      password_hash TEXT,
      display_name TEXT,
      created_at TEXT,
      email_verified_at TEXT
    );
    CREATE TABLE properties (
      id TEXT PRIMARY KEY,
      status TEXT
    );
  `);
  ensureMessagingSchema(db);
  return db;
}

function insertUser(
  db: DatabaseSync,
  row: { id: string; email: string | null; verified: boolean },
): void {
  db.prepare(
    `INSERT INTO users (id, email, phone_e164, display_name, created_at, email_verified_at)
     VALUES (?, ?, NULL, ?, '2026-08-01T00:00:00.000Z', ?)`,
  ).run(row.id, row.email, row.id, row.verified ? "2026-08-01T01:00:00.000Z" : null);
}

describe("getAdminNavCounts", () => {
  const prevAdmin = process.env.ADMIN_EMAILS;

  it("counts verified users, published posts, and unread customer support messages", () => {
    process.env.ADMIN_EMAILS = "ops@test.mx";
    const db = setupDb();
    insertUser(db, { id: "u-real", email: "ana@test.mx", verified: true });
    insertUser(db, { id: "u-pending", email: "pedro@test.mx", verified: false });
    insertUser(db, { id: "u-admin", email: "ops@test.mx", verified: true });
    insertUser(db, { id: "u-phone", email: null, verified: false });

    db.prepare(`INSERT INTO properties (id, status) VALUES (?, ?)`).run("p1", "published");
    db.prepare(`INSERT INTO properties (id, status) VALUES (?, ?)`).run("p2", "published");
    db.prepare(`INSERT INTO properties (id, status) VALUES (?, ?)`).run("p3", "draft");

    db.prepare(
      `INSERT INTO conversations (id, context_title, kind, created_at, updated_at)
       VALUES ('c-support', 'Ayuda', 'support', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')`,
    ).run();
    db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES ('c-support', 'u-real')`).run();
    db.prepare(
      `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ('c-support', ?)`,
    ).run(SUPPORT_BOT_USER_ID);
    db.prepare(
      `INSERT INTO messages (id, conversation_id, sender_user_id, body, created_at, read_at)
       VALUES ('m1', 'c-support', 'u-real', 'hola', '2026-08-01T00:00:00.000Z', NULL)`,
    ).run();
    db.prepare(
      `INSERT INTO messages (id, conversation_id, sender_user_id, body, created_at, read_at)
       VALUES ('m2', 'c-support', 'u-real', 'otra', '2026-08-01T00:01:00.000Z', '2026-08-01T00:02:00.000Z')`,
    ).run();
    db.prepare(
      `INSERT INTO messages (id, conversation_id, sender_user_id, body, created_at, read_at)
       VALUES ('m3', 'c-support', ?, 'respuesta admin', '2026-08-01T00:03:00.000Z', NULL)`,
    ).run(SUPPORT_BOT_USER_ID);

    db.prepare(
      `INSERT INTO conversations (id, context_title, kind, created_at, updated_at)
       VALUES ('c-listing', 'Cuarto', 'listing', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')`,
    ).run();
    db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES ('c-listing', 'u-real')`).run();
    db.prepare(
      `INSERT INTO messages (id, conversation_id, sender_user_id, body, created_at, read_at)
       VALUES ('m4', 'c-listing', 'u-real', 'listing unread', '2026-08-01T00:00:00.000Z', NULL)`,
    ).run();

    expect(FEEDBACK_BOT_USER_ID).toBeTruthy();
    expect(getAdminNavCounts(db)).toEqual({
      verifiedUsers: 2,
      publishedPosts: 2,
      unreadSupportMessages: 1,
    });
    process.env.ADMIN_EMAILS = prevAdmin;
  });
});

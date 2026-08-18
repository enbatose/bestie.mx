import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { ensureMessagingSchema, FEEDBACK_BOT_USER_ID, SUPPORT_BOT_USER_ID } from "./messagingSchema.js";
import {
  ADMIN_SUPPORT_DEFAULT_SUBJECT,
  adminSupportSubjectForPost,
  startAdminSupportConversation,
} from "./adminSupportStart.js";

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
  `);
  ensureMessagingSchema(db);
  return db;
}

function insertUser(db: DatabaseSync, id: string, email = `${id}@test.mx`): void {
  db.prepare(
    `INSERT INTO users (id, email, phone_e164, display_name, created_at, email_verified_at)
     VALUES (?, ?, NULL, ?, '2026-08-01T00:00:00.000Z', '2026-08-01T01:00:00.000Z')`,
  ).run(id, email, id);
}

describe("startAdminSupportConversation", () => {
  it("creates a support thread with Soporte de Bestie", () => {
    const db = setupDb();
    insertUser(db, "u-ana", "ana@test.mx");

    const first = startAdminSupportConversation(db, { userId: "u-ana", subject: "Sobre tu anuncio P1" });
    expect(first).toMatchObject({ ok: true, created: true });
    if (!first.ok) return;

    const conv = db
      .prepare(`SELECT kind, context_title, listing_room_id FROM conversations WHERE id = ?`)
      .get(first.conversationId) as { kind: string; context_title: string; listing_room_id: string | null };
    expect(conv.kind).toBe("support");
    expect(conv.context_title).toBe("Sobre tu anuncio P1");
    expect(conv.listing_room_id).toBeNull();

    const participants = db
      .prepare(`SELECT user_id FROM conversation_participants WHERE conversation_id = ? ORDER BY user_id`)
      .all(first.conversationId) as { user_id: string }[];
    expect(participants.map((p) => p.user_id).sort()).toEqual(["u-ana", SUPPORT_BOT_USER_ID].sort());
  });

  it("reuses the latest support conversation instead of opening a second ticket", () => {
    const db = setupDb();
    insertUser(db, "u-ana", "ana@test.mx");

    const first = startAdminSupportConversation(db, { userId: "u-ana" });
    const second = startAdminSupportConversation(db, { userId: "u-ana", subject: "Otro asunto" });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.created).toBe(false);
    expect(second.conversationId).toBe(first.conversationId);

    const count = (db.prepare(`SELECT COUNT(*) as n FROM conversations WHERE kind = 'support'`).get() as { n: number })
      .n;
    expect(count).toBe(1);
  });

  it("rejects missing users and system bots", () => {
    const db = setupDb();
    expect(startAdminSupportConversation(db, { userId: "missing" })).toEqual({ ok: false, error: "not_found" });
    expect(startAdminSupportConversation(db, { userId: SUPPORT_BOT_USER_ID })).toEqual({
      ok: false,
      error: "invalid_user",
    });
    expect(startAdminSupportConversation(db, { userId: FEEDBACK_BOT_USER_ID })).toEqual({
      ok: false,
      error: "invalid_user",
    });
  });

  it("falls back to the default subject when none is given", () => {
    const db = setupDb();
    insertUser(db, "u-ana", "ana@test.mx");
    const result = startAdminSupportConversation(db, { userId: "u-ana" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const conv = db
      .prepare(`SELECT context_title FROM conversations WHERE id = ?`)
      .get(result.conversationId) as { context_title: string };
    expect(conv.context_title).toBe(ADMIN_SUPPORT_DEFAULT_SUBJECT);
  });
});

describe("adminSupportSubjectForPost", () => {
  it("includes the post short id", () => {
    expect(adminSupportSubjectForPost("P88EC553C")).toBe("Sobre tu anuncio P88EC553C");
    expect(adminSupportSubjectForPost("  ")).toBe(ADMIN_SUPPORT_DEFAULT_SUBJECT);
  });
});

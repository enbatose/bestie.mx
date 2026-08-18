import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { isSystemMessagingBot, SUPPORT_BOT_USER_ID } from "./messagingSchema.js";
import { clampStr } from "./validation.js";

export const ADMIN_SUPPORT_SUBJECT_MAX_LEN = 200;
export const ADMIN_SUPPORT_DEFAULT_SUBJECT = "Soporte de Bestie";

export type StartAdminSupportConversationResult =
  | { ok: true; conversationId: string; created: boolean }
  | { ok: false; error: "not_found" | "invalid_user" };

export function adminSupportSubjectForPost(shortId: string | null | undefined): string {
  const id = typeof shortId === "string" ? shortId.trim() : "";
  if (!id) return ADMIN_SUPPORT_DEFAULT_SUBJECT;
  return `Sobre tu anuncio ${id}`.slice(0, ADMIN_SUPPORT_SUBJECT_MAX_LEN);
}

function findLatestSupportConversation(db: DatabaseSync, userId: string): string | null {
  const row = db
    .prepare(
      `SELECT c.id
       FROM conversations c
       JOIN conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = ?
       JOIN conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = ?
       WHERE c.kind = 'support'
       ORDER BY c.updated_at DESC
       LIMIT 1`,
    )
    .get(userId, SUPPORT_BOT_USER_ID) as { id: string } | undefined;
  return row?.id ?? null;
}

function createSupportConversation(db: DatabaseSync, userId: string, subject: string): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO conversations (id, listing_room_id, context_title, kind, created_at, updated_at)
     VALUES (?, NULL, ?, 'support', ?, ?)`,
  ).run(id, subject, now, now);
  db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`).run(id, userId);
  db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`).run(
    id,
    SUPPORT_BOT_USER_ID,
  );
  return id;
}

/**
 * Opens (or creates) a support conversation between a customer and Soporte de Bestie
 * so an admin can write from the Soporte inbox.
 */
export function startAdminSupportConversation(
  db: DatabaseSync,
  opts: { userId: string; subject?: string },
): StartAdminSupportConversationResult {
  const userId = typeof opts.userId === "string" ? opts.userId.trim() : "";
  if (!userId || userId.length > 120) {
    return { ok: false, error: "not_found" };
  }
  if (isSystemMessagingBot(userId)) {
    return { ok: false, error: "invalid_user" };
  }
  const user = db.prepare(`SELECT id FROM users WHERE id = ?`).get(userId) as { id: string } | undefined;
  if (!user) {
    return { ok: false, error: "not_found" };
  }

  const existing = findLatestSupportConversation(db, userId);
  if (existing) {
    return { ok: true, conversationId: existing, created: false };
  }

  const subject =
    clampStr(typeof opts.subject === "string" ? opts.subject : "", ADMIN_SUPPORT_SUBJECT_MAX_LEN) ||
    ADMIN_SUPPORT_DEFAULT_SUBJECT;
  const conversationId = createSupportConversation(db, userId, subject);
  return { ok: true, conversationId, created: true };
}

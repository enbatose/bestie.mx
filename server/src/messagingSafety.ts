import type { DatabaseSync } from "node:sqlite";
import { isAdminEmail, isAdminUser } from "./adminAuth.js";
import { isSystemMessagingBot, normalizeConversationKind } from "./messagingSchema.js";

/**
 * In-app safety notice version for peer listing chats.
 *
 * When you change the tip list or legal copy in MessagingSafetyModal in a
 * material way, bump this string (e.g. "2026-08-24-v2"). Users who already
 * accepted an older version will see the modal again and must re-accept.
 * That keeps the DB acknowledgment aligned with the text they actually saw.
 */
export const MESSAGING_SAFETY_NOTICE_VERSION = "2026-08-23-v1";

export type MessagingSafetyRole = "seeker" | "publisher";

export function ensureMessagingSafetySchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messaging_safety_acknowledgments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      notice_version TEXT NOT NULL,
      role_at_acceptance TEXT NOT NULL,
      conversation_id TEXT,
      accepted_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_messaging_safety_user_version
      ON messaging_safety_acknowledgments(user_id, notice_version);
  `);
}

export function hasAcceptedMessagingSafety(
  db: DatabaseSync,
  userId: string,
  noticeVersion: string = MESSAGING_SAFETY_NOTICE_VERSION,
): boolean {
  const row = db
    .prepare(
      `SELECT 1 AS x FROM messaging_safety_acknowledgments
       WHERE user_id = ? AND notice_version = ? LIMIT 1`,
    )
    .get(userId, noticeVersion) as { x: number } | undefined;
  return Boolean(row);
}

export function recordMessagingSafetyAcknowledgment(
  db: DatabaseSync,
  input: {
    id: string;
    userId: string;
    noticeVersion: string;
    role: MessagingSafetyRole;
    conversationId: string | null;
    acceptedAt: string;
  },
): void {
  db.prepare(
    `INSERT INTO messaging_safety_acknowledgments
      (id, user_id, notice_version, role_at_acceptance, conversation_id, accepted_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    input.userId,
    input.noticeVersion,
    input.role,
    input.conversationId,
    input.acceptedAt,
  );
}

/**
 * Pure peer check (no DB). Prefer this in list mappers so we do not N+1 query
 * under Node's synchronous SQLite driver (blocks the event loop).
 */
export function isMessagingSafetyExemptPeer(
  kindRaw: string | null | undefined,
  otherUserId: string,
  otherEmail?: string | null,
): boolean {
  const kind = normalizeConversationKind(kindRaw);
  if (kind !== "listing") return true;
  if (isSystemMessagingBot(otherUserId)) return true;
  if (isAdminEmail(otherEmail)) return true;
  return false;
}

/** Peer listing threads with a non-admin, non-bot counterpart require the safety gate. */
export function isMessagingSafetyExemptConversation(
  db: DatabaseSync,
  kindRaw: string | null | undefined,
  otherUserId: string,
): boolean {
  const kind = normalizeConversationKind(kindRaw);
  if (kind !== "listing") return true;
  if (isSystemMessagingBot(otherUserId)) return true;
  if (isAdminUser(db, otherUserId)) return true;
  return false;
}

function ownerUserIdForRoom(db: DatabaseSync, roomListingId: string): string | null {
  const row = db
    .prepare(
      `SELECT up.user_id AS uid
       FROM rooms r
       INNER JOIN properties p ON p.id = r.property_id
       LEFT JOIN user_publishers up ON up.publisher_id = p.publisher_id
       WHERE r.id = ?`,
    )
    .get(roomListingId) as { uid: string | null } | undefined;
  return row?.uid && String(row.uid).trim() ? String(row.uid) : null;
}

export function resolveMessagingSafetyRole(
  db: DatabaseSync,
  userId: string,
  listingRoomId: string | null | undefined,
): MessagingSafetyRole {
  if (!listingRoomId) return "seeker";
  const owner = ownerUserIdForRoom(db, listingRoomId);
  return owner && owner === userId ? "publisher" : "seeker";
}

export const MESSAGING_SAFETY_PREVIEW_PLACEHOLDER = "Nuevo mensaje";

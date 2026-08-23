import type { DatabaseSync } from "node:sqlite";

/** Fixed system account used as the "other participant" in every support conversation. */
export const SUPPORT_BOT_USER_ID = "support-bestie";
export const SUPPORT_BOT_DISPLAY_NAME = "Soporte de Bestie";
const SUPPORT_BOT_EMAIL = "soporte-sistema@bestie.mx";

/** Fixed system account used as the "other participant" in every feedback conversation. */
export const FEEDBACK_BOT_USER_ID = "feedback-bestie";
export const FEEDBACK_BOT_DISPLAY_NAME = "Feedback de Bestie";
const FEEDBACK_BOT_EMAIL = "feedback-sistema@bestie.mx";

/** Not a valid scrypt hash — any login attempt against this account fails `verifyPassword`. */
const SYSTEM_BOT_PASSWORD_MARKER = "system-support-account-no-login";

export type MessagingConversationKind = "listing" | "support" | "feedback" | "blog" | "report";

export function isSystemMessagingBot(userId: string): boolean {
  return (
    userId === SUPPORT_BOT_USER_ID ||
    userId === FEEDBACK_BOT_USER_ID ||
    userId === "blog-bestie" ||
    userId === "report-bestie"
  );
}

export function normalizeConversationKind(kind: string | null | undefined): MessagingConversationKind {
  if (kind === "support") return "support";
  if (kind === "feedback") return "feedback";
  if (kind === "blog") return "blog";
  if (kind === "report") return "report";
  return "listing";
}

function tableHasColumn(db: DatabaseSync, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

function migrateConversationKind(db: DatabaseSync): void {
  if (!tableHasColumn(db, "conversations", "kind")) {
    db.exec(`ALTER TABLE conversations ADD COLUMN kind TEXT NOT NULL DEFAULT 'listing'`);
  }
}

function migrateMessageAttachments(db: DatabaseSync): void {
  if (!tableHasColumn(db, "messages", "attachments_json")) {
    db.exec(`ALTER TABLE messages ADD COLUMN attachments_json TEXT`);
  }
}

function migrateMessageDeliveredAt(db: DatabaseSync): void {
  if (!tableHasColumn(db, "messages", "delivered_at")) {
    db.exec(`ALTER TABLE messages ADD COLUMN delivered_at TEXT`);
  }
}

function ensureSystemBotUser(
  db: DatabaseSync,
  id: string,
  email: string,
  displayName: string,
): void {
  const row = db.prepare(`SELECT 1 AS x FROM users WHERE id = ?`).get(id) as { x: number } | undefined;
  if (row) return;
  db.prepare(
    `INSERT INTO users (id, email, email_canonical, phone_e164, password_hash, display_name, created_at, email_verified_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`,
  ).run(id, email, email, SYSTEM_BOT_PASSWORD_MARKER, displayName, new Date().toISOString(), null);
}

/** Seeds the "Soporte de Bestie" system account used as the counterpart of every support chat. */
function ensureSupportBotUser(db: DatabaseSync): void {
  ensureSystemBotUser(db, SUPPORT_BOT_USER_ID, SUPPORT_BOT_EMAIL, SUPPORT_BOT_DISPLAY_NAME);
}

/** Seeds the "Feedback de Bestie" system account used as the counterpart of every feedback chat. */
function ensureFeedbackBotUser(db: DatabaseSync): void {
  ensureSystemBotUser(db, FEEDBACK_BOT_USER_ID, FEEDBACK_BOT_EMAIL, FEEDBACK_BOT_DISPLAY_NAME);
}

/** In-app 1:1 messaging (listing threads + support/feedback chats), read receipts, and attachments. */
export function ensureMessagingSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      listing_room_id TEXT,
      context_title TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_conversations_listing ON conversations(listing_room_id);

    CREATE TABLE IF NOT EXISTS conversation_participants (
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (conversation_id, user_id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_user_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read_at TEXT,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);
  `);
  migrateConversationKind(db);
  migrateMessageAttachments(db);
  migrateMessageDeliveredAt(db);
  ensureSupportBotUser(db);
  ensureFeedbackBotUser(db);
}


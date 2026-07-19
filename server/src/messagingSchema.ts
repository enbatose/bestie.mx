import type { DatabaseSync } from "node:sqlite";

/** Fixed system account used as the "other participant" in every support conversation. */
export const SUPPORT_BOT_USER_ID = "support-bestie";
export const SUPPORT_BOT_DISPLAY_NAME = "Soporte de Bestie";
const SUPPORT_BOT_EMAIL = "soporte-sistema@bestie.mx";
/** Not a valid scrypt hash — any login attempt against this account fails `verifyPassword`. */
const SUPPORT_BOT_PASSWORD_MARKER = "system-support-account-no-login";

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

/** Seeds the "Soporte de Bestie" system account used as the counterpart of every support chat. */
function ensureSupportBotUser(db: DatabaseSync): void {
  const row = db.prepare(`SELECT 1 AS x FROM users WHERE id = ?`).get(SUPPORT_BOT_USER_ID) as
    | { x: number }
    | undefined;
  if (row) return;
  db.prepare(
    `INSERT INTO users (id, email, email_canonical, phone_e164, password_hash, display_name, created_at, email_verified_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`,
  ).run(
    SUPPORT_BOT_USER_ID,
    SUPPORT_BOT_EMAIL,
    SUPPORT_BOT_EMAIL,
    SUPPORT_BOT_PASSWORD_MARKER,
    SUPPORT_BOT_DISPLAY_NAME,
    new Date().toISOString(),
    null,
  );
}

/** In-app 1:1 messaging (listing threads + support chats), read receipts, and attachments. */
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
  ensureSupportBotUser(db);
}

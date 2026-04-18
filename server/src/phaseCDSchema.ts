import type { DatabaseSync } from "node:sqlite";

function usersTableHasColumn(db: DatabaseSync, column: string): boolean {
  const row = db
    .prepare("SELECT 1 AS x FROM sqlite_master WHERE type='table' AND name='users' LIMIT 1")
    .get() as { x: number } | undefined;
  if (!row) return false;
  const cols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

/**
 * Phase C/D: auth (email + WhatsApp OTP), Messenger webhook, handoff tokens,
 * renter groups, admin settings, analytics counters, audit log (no impersonation).
 */
export function ensurePhaseCDSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      phone_e164 TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      email_verified_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_e164);

    CREATE TABLE IF NOT EXISTS user_publishers (
      user_id TEXT NOT NULL,
      publisher_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, publisher_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_publishers_pub ON user_publishers(publisher_id);

    CREATE TABLE IF NOT EXISTS whatsapp_otp_challenges (
      id TEXT PRIMARY KEY,
      phone_e164 TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_otp_phone ON whatsapp_otp_challenges(phone_e164);

    CREATE TABLE IF NOT EXISTS messenger_handoff_tokens (
      token TEXT PRIMARY KEY,
      publisher_id TEXT NOT NULL,
      draft_property_id TEXT,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS renter_groups (
      id TEXT PRIMARY KEY,
      owner_publisher_id TEXT NOT NULL,
      name TEXT NOT NULL,
      min_age INTEGER,
      max_age INTEGER,
      min_income_mxn INTEGER,
      invite_code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS renter_group_members (
      group_id TEXT NOT NULL,
      publisher_id TEXT NOT NULL,
      joined_at TEXT NOT NULL,
      PRIMARY KEY (group_id, publisher_id),
      FOREIGN KEY (group_id) REFERENCES renter_groups(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analytics_daily (
      day TEXT NOT NULL,
      metric TEXT NOT NULL,
      dimension TEXT NOT NULL DEFAULT '',
      value INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, metric, dimension)
    );

    CREATE TABLE IF NOT EXISTS messenger_events (
      id TEXT PRIMARY KEY,
      sender_psid TEXT,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dau_publishers (
      day TEXT NOT NULL,
      publisher_id TEXT NOT NULL,
      PRIMARY KEY (day, publisher_id)
    );

    CREATE TABLE IF NOT EXISTS client_events (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      publisher_id TEXT NOT NULL,
      user_id TEXT,
      name TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_client_events_created_at ON client_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_client_events_name ON client_events(name);

    CREATE TABLE IF NOT EXISTS messenger_chat_sessions (
      psid TEXT PRIMARY KEY,
      publisher_id TEXT NOT NULL,
      flow TEXT NOT NULL DEFAULT 'idle',
      draft_json TEXT NOT NULL DEFAULT '{}',
      updated_at INTEGER NOT NULL
    );
  `);
  /** Older DBs: `CREATE TABLE IF NOT EXISTS` does not add new columns; register INSERT would fail otherwise. */
  if (!usersTableHasColumn(db, "email_verified_at")) {
    db.exec("ALTER TABLE users ADD COLUMN email_verified_at TEXT");
  }
  db.prepare(
    `UPDATE users SET email_verified_at = created_at WHERE email IS NOT NULL AND (email_verified_at IS NULL OR trim(email_verified_at) = '')`,
  ).run();
}

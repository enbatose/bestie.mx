import type { DatabaseSync } from "node:sqlite";

/** Saved search snapshots + email notification state. */
export function ensureSavedSearchSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_searches (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      label TEXT NOT NULL,
      city_code TEXT NOT NULL,
      filters_json TEXT NOT NULL,
      location_json TEXT NOT NULL,
      search_url TEXT NOT NULL,
      email_notify_enabled INTEGER NOT NULL DEFAULT 0,
      unsubscribe_token TEXT NOT NULL UNIQUE,
      last_notified_at TEXT,
      is_draft INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_saved_searches_user_draft ON saved_searches(user_id, is_draft);

    CREATE TABLE IF NOT EXISTS saved_search_notified_rooms (
      saved_search_id TEXT NOT NULL,
      room_id TEXT NOT NULL,
      notified_at TEXT NOT NULL,
      PRIMARY KEY (saved_search_id, room_id),
      FOREIGN KEY (saved_search_id) REFERENCES saved_searches(id) ON DELETE CASCADE
    );
  `);

  try {
    db.exec(`ALTER TABLE saved_searches ADD COLUMN is_draft INTEGER NOT NULL DEFAULT 0`);
  } catch {
    /* column already exists */
  }
}

export const MAX_SAVED_SEARCHES_PER_USER = 20;

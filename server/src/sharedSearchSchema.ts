import type { DatabaseSync } from "node:sqlite";

/** Canonical shared search (vanity `/busquedas/:id`) plus per-user subscriptions via `saved_searches.share_id`. */
export function ensureSharedSearchSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS shared_searches (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL DEFAULT 'template',
      forked_from_id TEXT,
      owner_user_id TEXT,
      created_by_user_id TEXT NOT NULL,
      source_facebook_url TEXT,
      source_facebook_key TEXT,
      seeker_name TEXT,
      seeker_gender TEXT,
      city_code TEXT NOT NULL,
      city_label TEXT,
      label TEXT NOT NULL,
      filters_json TEXT NOT NULL,
      location_json TEXT NOT NULL,
      similar_json TEXT NOT NULL,
      insights_json TEXT NOT NULL,
      non_negotiables_json TEXT NOT NULL,
      q_text TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_shared_searches_facebook_key
      ON shared_searches(source_facebook_key);
    CREATE INDEX IF NOT EXISTS idx_shared_searches_owner
      ON shared_searches(owner_user_id);
  `);

  try {
    db.exec(`ALTER TABLE saved_searches ADD COLUMN share_id TEXT`);
  } catch {
    /* column already exists */
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_saved_searches_share ON saved_searches(share_id)`);
}

import type { DatabaseSync } from "node:sqlite";

function tableHasColumn(db: DatabaseSync, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

/** Schema for admin-assisted draft creation (outreach flow). */
export function ensureAssistedDraftSchema(db: DatabaseSync): void {
  if (!tableHasColumn(db, "properties", "assisted_draft")) {
    db.exec(`ALTER TABLE properties ADD COLUMN assisted_draft INTEGER NOT NULL DEFAULT 0`);
  }
  if (!tableHasColumn(db, "properties", "created_by_admin_id")) {
    db.exec(`ALTER TABLE properties ADD COLUMN created_by_admin_id TEXT`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS assisted_draft_claim_tokens (
      token TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      created_by_admin_id TEXT NOT NULL,
      orphan_publisher_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      activated_at INTEGER,
      claimed_by_user_id TEXT,
      claimed_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_adct_property ON assisted_draft_claim_tokens(property_id);
    CREATE INDEX IF NOT EXISTS idx_adct_expires ON assisted_draft_claim_tokens(expires_at);
  `);
}

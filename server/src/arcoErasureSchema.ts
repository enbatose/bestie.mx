import type { DatabaseSync } from "node:sqlite";

/** Blocked ARCO cancelación log — no plaintext email/phone after the request is processed. */
export function ensureArcoErasureSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS arco_erasure_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email_hash TEXT,
      phone_hash TEXT,
      admin_user_id TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'admin',
      reason TEXT,
      counts_json TEXT NOT NULL,
      confirmation_email_sent INTEGER NOT NULL DEFAULT 0,
      confirmation_sms_sent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_arco_erasure_created ON arco_erasure_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_arco_erasure_email_hash ON arco_erasure_log(email_hash);
  `);
  const cols = db.prepare("PRAGMA table_info(arco_erasure_log)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "confirmation_sms_sent")) {
    db.exec("ALTER TABLE arco_erasure_log ADD COLUMN confirmation_sms_sent INTEGER NOT NULL DEFAULT 0");
  }
}

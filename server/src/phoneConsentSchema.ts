import type { DatabaseSync } from "node:sqlite";

function usersHasColumn(db: DatabaseSync, column: string): boolean {
  const cols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

/**
 * Profile phone marketing / transactional SMS·WhatsApp consents + one-time
 * “Completa tu perfil” dismissal.
 */
export function ensurePhoneConsentSchema(db: DatabaseSync): void {
  if (!usersHasColumn(db, "phone_notify_opt_in")) {
    db.exec("ALTER TABLE users ADD COLUMN phone_notify_opt_in INTEGER NOT NULL DEFAULT 1");
  }
  if (!usersHasColumn(db, "phone_marketing_opt_in")) {
    db.exec("ALTER TABLE users ADD COLUMN phone_marketing_opt_in INTEGER NOT NULL DEFAULT 1");
  }
  if (!usersHasColumn(db, "phone_prompt_dismissed_at")) {
    db.exec("ALTER TABLE users ADD COLUMN phone_prompt_dismissed_at TEXT");
  }
}

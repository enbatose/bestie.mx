import type { DatabaseSync } from "node:sqlite";

/** Trim, lowercase, strip invisible chars (paste / RTL markers). */
export function normalizeAuthEmailInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

/**
 * Single form we store and match on for auth: Gmail / Googlemail ignore dots in the local part,
 * so `a.b@gmail.com` and `ab@gmail.com` are the same Google account — we always use the dotless local part.
 */
export function canonicalStorageEmail(normalized: string): string {
  const at = normalized.lastIndexOf("@");
  if (at <= 0) return normalized;
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return `${local.replace(/\./g, "")}@${domain}`;
  }
  return normalized;
}

/** Normalized + provider-specific canonical form for DB storage and login lookup. */
export function authEmailForDb(raw: string): string {
  return canonicalStorageEmail(normalizeAuthEmailInput(raw));
}

/** One-time migration for existing rows (CREATE TABLE IF NOT EXISTS does not rewrite emails). */
export function migrateUserEmailsToCanonicalForm(db: DatabaseSync): void {
  const rows = db
    .prepare(
      `SELECT id, email FROM users WHERE email IS NOT NULL AND (instr(lower(email), '@gmail.com') > 0 OR instr(lower(email), '@googlemail.com') > 0)`,
    )
    .all() as { id: string; email: string }[];
  for (const r of rows) {
    const next = canonicalStorageEmail(normalizeAuthEmailInput(r.email));
    if (next === r.email) continue;
    try {
      db.prepare(`UPDATE users SET email = ? WHERE id = ?`).run(next, r.id);
    } catch (e) {
      console.warn(`[auth-email] skip migrate id=${r.id}:`, e instanceof Error ? e.message : e);
    }
  }
}

import type { DatabaseSync } from "node:sqlite";

/** Trim, lowercase, strip invisible chars (paste / RTL markers). Dots and other chars preserved. */
export function normalizeAuthEmailInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

/**
 * Display form stored in the `email` column and shown back to the user.
 * Preserves every character the user typed (including dots); only normalizes case and whitespace.
 */
export function displayStorageEmail(raw: string): string {
  return normalizeAuthEmailInput(raw);
}

/**
 * Lookup/dedup key stored in `email_canonical`.
 * Gmail / Googlemail ignore dots in the local part, so `a.b@gmail.com` and `ab@gmail.com` map to the
 * same Google account — we fold those to the dotless form for uniqueness checks and login lookup.
 * All other providers are left as-is (only whitespace + case normalized).
 */
export function canonicalLookupEmail(raw: string): string {
  const normalized = normalizeAuthEmailInput(raw);
  const at = normalized.lastIndexOf("@");
  if (at <= 0) return normalized;
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return `${local.replace(/\./g, "")}@${domain}`;
  }
  return normalized;
}

/**
 * @deprecated Historical name. Kept as an alias of `canonicalLookupEmail` so external callers
 * (and old tests) keep working. New code should use `canonicalLookupEmail` for lookups and
 * `displayStorageEmail` for the value we persist in the `email` column.
 */
export function canonicalStorageEmail(raw: string): string {
  return canonicalLookupEmail(raw);
}

/**
 * @deprecated Old name that conflated two responsibilities (display and lookup). Returns the
 * canonical lookup form for backwards compatibility with existing callers.
 */
export function authEmailForDb(raw: string): string {
  return canonicalLookupEmail(raw);
}

/**
 * Backfill the `email_canonical` column for rows that predate it.
 * Never rewrites the `email` (display) column — the user's original characters must be preserved.
 */
export function backfillUserEmailCanonical(db: DatabaseSync): void {
  const rows = db
    .prepare(
      `SELECT id, email FROM users WHERE email IS NOT NULL AND (email_canonical IS NULL OR trim(email_canonical) = '')`,
    )
    .all() as { id: string; email: string }[];
  for (const r of rows) {
    const canon = canonicalLookupEmail(r.email);
    try {
      db.prepare(`UPDATE users SET email_canonical = ? WHERE id = ?`).run(canon, r.id);
    } catch (e) {
      console.warn(`[auth-email] backfill skip id=${r.id}:`, e instanceof Error ? e.message : e);
    }
  }
}

/**
 * @deprecated Old name — now a no-op-except-backfill wrapper. Earlier versions rewrote `email`
 * to a dotless form, which silently lost characters the user typed. We now backfill only the
 * separate `email_canonical` column.
 */
export function migrateUserEmailsToCanonicalForm(db: DatabaseSync): void {
  backfillUserEmailCanonical(db);
}

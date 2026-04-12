import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

const TTL_MS = 72 * 60 * 60 * 1000;

function pepper(): string {
  return process.env.AUTH_JWT_SECRET?.trim() || "dev-insecure-auth-secret-change-me";
}

function hashToken(raw: string): string {
  return createHash("sha256").update(`${pepper()}:${raw}`).digest("hex");
}

/** Returns raw token to embed in link (shown only in non-production dev response). */
export function createEmailVerificationToken(db: DatabaseSync, userId: string): string {
  const raw = randomBytes(24).toString("hex");
  const id = randomUUID();
  const exp = Date.now() + TTL_MS;
  db.prepare(
    `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, userId, hashToken(raw), exp, Date.now());
  return raw;
}

export function verifyEmailWithToken(db: DatabaseSync, rawToken: string): { ok: true; userId: string } | { ok: false } {
  const h = hashToken(rawToken.trim());
  const row = db
    .prepare(
      `SELECT id, user_id, expires_at FROM email_verification_tokens WHERE token_hash = ?`,
    )
    .get(h) as { id: string; user_id: string; expires_at: number } | undefined;
  if (!row || row.expires_at < Date.now()) return { ok: false };
  const now = new Date().toISOString();
  db.prepare(`UPDATE users SET email_verified_at = ? WHERE id = ?`).run(now, row.user_id);
  db.prepare(`DELETE FROM email_verification_tokens WHERE id = ?`).run(row.id);
  return { ok: true, userId: row.user_id };
}

import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { canonicalLookupEmail } from "./authEmail.js";
import { isWaOnlyPasswordHash } from "./adminAuth.js";
import { buildPasswordResetEmail, passwordResetUrl } from "./emails/passwordResetEmail.js";
import { sendTransactionalEmail } from "./mailer.js";

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export type PasswordResetTokenRow = {
  token: string;
  user_id: string;
  expires_at: number;
  used_at: number | null;
  created_at: number;
};

function generateToken(): string {
  return randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 8);
}

export function purgeExpiredPasswordResetTokens(db: DatabaseSync): void {
  db.prepare("DELETE FROM password_reset_tokens WHERE expires_at < ? OR used_at IS NOT NULL").run(Date.now());
}

export function invalidatePasswordResetTokensForUser(db: DatabaseSync, userId: string): void {
  db.prepare("UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL").run(
    Date.now(),
    userId,
  );
}

export function createPasswordResetToken(db: DatabaseSync, userId: string): string {
  purgeExpiredPasswordResetTokens(db);
  invalidatePasswordResetTokensForUser(db, userId);
  const token = generateToken();
  db.prepare(
    `INSERT INTO password_reset_tokens (token, user_id, expires_at, used_at, created_at) VALUES (?, ?, ?, NULL, ?)`,
  ).run(token, userId, Date.now() + PASSWORD_RESET_TTL_MS, Date.now());
  return token;
}

export function loadPasswordResetToken(
  db: DatabaseSync,
  token: string,
): PasswordResetTokenRow | undefined {
  purgeExpiredPasswordResetTokens(db);
  return db
    .prepare(
      `SELECT token, user_id, expires_at, used_at, created_at FROM password_reset_tokens WHERE token = ?`,
    )
    .get(token) as PasswordResetTokenRow | undefined;
}

export function isPasswordResetTokenValid(row: PasswordResetTokenRow | undefined): row is PasswordResetTokenRow {
  return Boolean(row && row.used_at == null && row.expires_at >= Date.now());
}

export function markPasswordResetTokenUsed(db: DatabaseSync, token: string): void {
  db.prepare("UPDATE password_reset_tokens SET used_at = ? WHERE token = ?").run(Date.now(), token);
}

export type RequestPasswordResetResult = {
  requested: boolean;
  emailSent: boolean;
  devResetUrl?: string;
};

/** Send a password-reset email when the account exists and supports password login. */
export async function requestPasswordResetForEmail(
  db: DatabaseSync,
  rawEmail: string,
): Promise<RequestPasswordResetResult> {
  const emailCanonical = canonicalLookupEmail(rawEmail);
  const row = db
    .prepare(
      `SELECT id, email, display_name, password_hash FROM users WHERE email_canonical = ? OR email = ? LIMIT 1`,
    )
    .get(emailCanonical, rawEmail.trim()) as
    | { id: string; email: string | null; display_name: string; password_hash: string }
    | undefined;

  if (!row?.email || isWaOnlyPasswordHash(row.password_hash)) {
    return { requested: false, emailSent: false };
  }

  const token = createPasswordResetToken(db, row.id);
  const resetUrl = passwordResetUrl(token);
  const mail = buildPasswordResetEmail({ resetUrl, displayName: row.display_name });
  const emailSent = await sendTransactionalEmail({
    to: row.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });

  const devReturn =
    process.env.NODE_ENV !== "production" || process.env.PASSWORD_RESET_DEV_RETURN === "1";
  return {
    requested: true,
    emailSent,
    ...(devReturn && !emailSent ? { devResetUrl: resetUrl } : {}),
  };
}

export function passwordResetDevReturnEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.PASSWORD_RESET_DEV_RETURN === "1";
}

import { createHash, randomInt, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { authSecret } from "./authSecret.js";
import { buildEmailVerificationEmail } from "./emails/emailVerificationEmail.js";
import { sendTransactionalEmail, smtpConfigured } from "./mailer.js";

export const EMAIL_VERIFICATION_TTL_MS = 10 * 60 * 1000;
export const EMAIL_VERIFICATION_MAX_ATTEMPTS = 8;

function otpPepper(): string {
  return authSecret();
}

export function hashEmailVerificationCode(userId: string, emailCanonical: string, code: string): string {
  return createHash("sha256")
    .update(`${otpPepper()}:email:${userId}:${emailCanonical}:${code}`)
    .digest("hex");
}

function generateCode(): string {
  return String(randomInt(100_000, 1_000_000));
}

export function emailVerificationDevReturnEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.EMAIL_VERIFICATION_DEV_RETURN === "1";
}

export function purgeExpiredEmailVerificationChallenges(db: DatabaseSync): void {
  db.prepare("DELETE FROM email_verification_challenges WHERE expires_at < ?").run(Date.now());
}

export type IssueEmailVerificationResult = {
  code: string;
  emailSent: boolean;
};

/** Creates a fresh 6-digit challenge and sends the verification email. */
export async function issueEmailVerificationChallenge(
  db: DatabaseSync,
  userId: string,
  email: string,
  emailCanonical: string,
  displayName?: string,
): Promise<IssueEmailVerificationResult> {
  purgeExpiredEmailVerificationChallenges(db);
  db.prepare("DELETE FROM email_verification_challenges WHERE user_id = ?").run(userId);

  const code = generateCode();
  const id = randomUUID();
  const codeHash = hashEmailVerificationCode(userId, emailCanonical, code);
  db.prepare(
    `INSERT INTO email_verification_challenges (id, user_id, email_canonical, code_hash, expires_at, attempts, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)`,
  ).run(id, userId, emailCanonical, codeHash, Date.now() + EMAIL_VERIFICATION_TTL_MS, Date.now());

  const mail = buildEmailVerificationEmail({ code, displayName });
  const emailSent = await sendTransactionalEmail({
    to: email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    previewText: mail.previewText,
    replyTo: mail.replyTo,
    tags: mail.tags,
  });

  return { code, emailSent };
}

export type VerifyEmailCodeResult =
  | { ok: true }
  | { ok: false; error: "invalid_input" | "not_found" | "code_expired" | "too_many_attempts" | "invalid_code" };

export function verifyEmailVerificationCode(
  db: DatabaseSync,
  userId: string,
  emailCanonical: string,
  code: string,
): VerifyEmailCodeResult {
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: "invalid_input" };
  }
  purgeExpiredEmailVerificationChallenges(db);
  const row = db
    .prepare(
      `SELECT id, code_hash, expires_at, attempts FROM email_verification_challenges WHERE user_id = ? AND email_canonical = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .get(userId, emailCanonical) as
    | { id: string; code_hash: string; expires_at: number; attempts: number }
    | undefined;
  if (!row) {
    return { ok: false, error: "not_found" };
  }
  if (row.expires_at < Date.now()) {
    return { ok: false, error: "code_expired" };
  }
  if (row.attempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS) {
    return { ok: false, error: "too_many_attempts" };
  }
  const ok = hashEmailVerificationCode(userId, emailCanonical, code) === row.code_hash;
  db.prepare(`UPDATE email_verification_challenges SET attempts = attempts + 1 WHERE id = ?`).run(row.id);
  if (!ok) {
    return { ok: false, error: "invalid_code" };
  }
  db.prepare("DELETE FROM email_verification_challenges WHERE id = ?").run(row.id);
  return { ok: true };
}

export function markUserEmailVerified(db: DatabaseSync, userId: string, at: string): void {
  db.prepare("UPDATE users SET email_verified_at = ? WHERE id = ?").run(at, userId);
}

export function isUserEmailVerified(emailVerifiedAt: string | null | undefined): boolean {
  return emailVerifiedAt != null && String(emailVerifiedAt).trim() !== "";
}

export function userAccountStatus(
  email: string | null | undefined,
  emailVerifiedAt: string | null | undefined,
): "active" | "pending_validation" {
  if (email?.trim() && !isUserEmailVerified(emailVerifiedAt)) {
    return "pending_validation";
  }
  return "active";
}

export function shouldReturnDevVerificationCode(emailSent: boolean): boolean {
  return emailVerificationDevReturnEnabled() && (!emailSent || !smtpConfigured());
}

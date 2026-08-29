import { createHash, randomInt, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { authSecret } from "./authSecret.js";
import { smsMasivosConfigured, smsMasivosSendOtp, smsMasivosVerifyOtp } from "./smsMasivosOtp.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 8;

function hashLocalOtp(phone: string, code: string): string {
  return createHash("sha256").update(`${authSecret()}:phone:${phone}:${code}`).digest("hex");
}

export function shouldReturnDevPhoneOtp(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.SMSMASIVOS_DEV_RETURN === "1";
}

export type RequestPhoneOtpResult =
  | { ok: true; devCode?: string; resendAvailableIn?: number }
  | { ok: false; error: string; retryAfterSec?: number };

export async function requestPhoneOtp(
  db: DatabaseSync,
  phoneE164: string,
  opts?: { rotate?: boolean },
): Promise<RequestPhoneOtpResult> {
  if (smsMasivosConfigured()) {
    const sent = await smsMasivosSendOtp(phoneE164, { rotate: opts?.rotate });
    if (!sent.ok) {
      const retry =
        sent.httpStatus === 429 && sent.resendAvailableIn
          ? Math.ceil(sent.resendAvailableIn)
          : undefined;
      return { ok: false, error: sent.error, retryAfterSec: retry };
    }
    if (sent.sandbox && sent.code && shouldReturnDevPhoneOtp()) {
      return { ok: true, devCode: sent.code, resendAvailableIn: sent.resendAvailableIn };
    }
    return { ok: true, resendAvailableIn: sent.resendAvailableIn };
  }

  db.prepare("DELETE FROM whatsapp_otp_challenges WHERE expires_at < ?").run(Date.now());
  const code = String(randomInt(100_000, 1_000_000));
  const id = randomUUID();
  db.prepare(
    `INSERT INTO whatsapp_otp_challenges (id, phone_e164, code_hash, expires_at, attempts, created_at) VALUES (?, ?, ?, ?, 0, ?)`,
  ).run(id, phoneE164, hashLocalOtp(phoneE164, code), Date.now() + OTP_TTL_MS, Date.now());
  if (shouldReturnDevPhoneOtp()) {
    return { ok: true, devCode: code };
  }
  return { ok: false, error: "sms_not_configured" };
}

export type VerifyPhoneOtpResult = { ok: true } | { ok: false; error: string };

export async function verifyPhoneOtp(
  db: DatabaseSync,
  phoneE164: string,
  code: string,
): Promise<VerifyPhoneOtpResult> {
  if (!/^\d{4,10}$/.test(code)) {
    return { ok: false, error: "invalid_code" };
  }
  if (smsMasivosConfigured()) {
    const verified = await smsMasivosVerifyOtp(phoneE164, code);
    if (!verified.ok) {
      if (verified.httpStatus === 401) return { ok: false, error: "invalid_code" };
      if (verified.httpStatus === 410) return { ok: false, error: "code_expired" };
      if (verified.httpStatus === 429) return { ok: false, error: "too_many_attempts" };
      if (verified.httpStatus === 404) return { ok: false, error: "code_expired" };
      return { ok: false, error: verified.error };
    }
    return { ok: true };
  }

  const row = db
    .prepare(
      `SELECT id, code_hash, expires_at, attempts FROM whatsapp_otp_challenges WHERE phone_e164 = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .get(phoneE164) as { id: string; code_hash: string; expires_at: number; attempts: number } | undefined;
  if (!row || row.expires_at < Date.now()) {
    return { ok: false, error: "code_expired" };
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "too_many_attempts" };
  }
  const ok = hashLocalOtp(phoneE164, code) === row.code_hash;
  db.prepare(`UPDATE whatsapp_otp_challenges SET attempts = attempts + 1 WHERE id = ?`).run(row.id);
  if (!ok) {
    return { ok: false, error: "invalid_code" };
  }
  db.prepare("DELETE FROM whatsapp_otp_challenges WHERE id = ?").run(row.id);
  return { ok: true };
}

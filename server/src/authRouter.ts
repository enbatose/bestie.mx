import { createHash, randomInt, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import express, { type Request, type Response } from "express";
import { createSlidingWindowLimiter } from "./rateLimit.js";
import { sendWhatsAppOtpTemplate } from "./whatsappMeta.js";
import { recordWhatsAppOtpSend } from "./usageAnalytics.js";
import { hashPassword, verifyPassword } from "./password.js";
import { issueAuthCookie, clearAuthCookie, readAuthUserId } from "./jwtSession.js";
import {
  isAdminUser,
  waOnlyPasswordPlaceholder,
  isWaOnlyPasswordHash,
  isGoogleOAuthPasswordHash,
  isFacebookOAuthPasswordHash,
  isOAuthOnlyPasswordHash,
  signInMethodFromPasswordHash,
} from "./adminAuth.js";
import { createPublishHandoff } from "./handoffTokens.js";
import { getOrCreatePublisherId, readPublisherIdFromRequest, issuePublisherCookie } from "./session.js";
import { canonicalLookupEmail, displayStorageEmail } from "./authEmail.js";
import { normalizeWhatsAppDigits } from "./validation.js";
import {
  issueEmailVerificationChallenge,
  markUserEmailVerified,
  shouldReturnDevVerificationCode,
  userAccountStatus,
  verifyEmailVerificationCode,
} from "./emailVerification.js";
import {
  isPasswordResetTokenValid,
  loadPasswordResetToken,
  markPasswordResetTokenUsed,
  passwordResetDevReturnEnabled,
  requestPasswordResetForEmail,
} from "./passwordReset.js";
import { registerGoogleOAuthRoutes } from "./googleOAuth.js";
import { registerFacebookOAuthRoutes } from "./facebookOAuth.js";
import { authSecret } from "./authSecret.js";
import { requestPhoneOtp, verifyPhoneOtp } from "./phoneOtp.js";
import {
  createPhoneUser,
  findUserIdByVerifiedPhone,
  isPhoneVerifiedAt,
  parseMxAuthPhone,
  setUserPhoneVerified,
} from "./phoneAuth.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 8;

function authLimitMax(envKey: string, prodDefault: number): number {
  const raw = Number(process.env[envKey]);
  if (Number.isFinite(raw) && raw > 0) return raw;
  // Keep suites fast: unlimited-ish unless a test opts into a low ceiling via env.
  if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") return 10_000;
  return prodDefault;
}

const otpRequestLimiter = createSlidingWindowLimiter({ windowMs: 60_000, max: authLimitMax("RATE_LIMIT_OTP_REQUEST_MAX", 5) });
const otpVerifyLimiter = createSlidingWindowLimiter({ windowMs: 60_000, max: authLimitMax("RATE_LIMIT_OTP_VERIFY_MAX", 20) });
const emailVerifyResendLimiter = createSlidingWindowLimiter({
  windowMs: 60_000,
  max: authLimitMax("RATE_LIMIT_EMAIL_VERIFY_RESEND_MAX", 3),
});
const forgotPasswordLimiter = createSlidingWindowLimiter({
  windowMs: 60_000,
  max: authLimitMax("RATE_LIMIT_FORGOT_PASSWORD_MAX", 5),
});
const registerLimiter = createSlidingWindowLimiter({
  windowMs: 60_000,
  max: authLimitMax("RATE_LIMIT_REGISTER_MAX", 8),
});
const loginLimiter = createSlidingWindowLimiter({
  windowMs: 60_000,
  max: authLimitMax("RATE_LIMIT_LOGIN_MAX", 20),
});

function otpPepper(): string {
  return authSecret();
}

function authRateKey(req: Request, suffix: string): string {
  const ip = req.ip ?? "unknown";
  return `${ip}|${suffix}`;
}

function hashOtp(phone: string, code: string): string {
  return createHash("sha256").update(`${otpPepper()}:${phone}:${code}`).digest("hex");
}

function isoNow(): string {
  return new Date().toISOString();
}

function phoneE164FromDigits(d: string): string {
  if (d.startsWith("52") && d.length >= 12) return `+${d}`;
  if (d.length === 10) return `+52${d}`;
  return `+${d}`;
}

function jsonMw() {
  return express.json({ limit: "256kb" });
}

const SAFE_UPLOAD_PATH =
  /^\/api\/uploads\/[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\.(jpg|jpeg|png|webp|gif|avif|svg|bmp)$/i;

function authUserPayload(u: {
  id: string;
  email: string | null;
  phone_e164: string | null;
  phone_notify_opt_in: number;
  phone_marketing_opt_in: number;
  phone_prompt_dismissed_at: string | null;
  display_name: string;
  profile_picture_url: string | null;
  created_at: string;
  email_verified_at: string | null;
  phone_verified_at?: string | null;
  password_hash: string;
  linkedPublisherIds: string[];
  isAdmin: boolean;
}) {
  const emailVerified = u.email_verified_at != null && String(u.email_verified_at).trim() !== "";
  const phoneVerified = isPhoneVerifiedAt(u.phone_verified_at);
  return {
    id: u.id,
    email: u.email,
    phoneE164: u.phone_e164,
    phoneVerified,
    phoneNotifyOptIn: Number(u.phone_notify_opt_in) !== 0,
    phoneMarketingOptIn: Number(u.phone_marketing_opt_in) !== 0,
    phonePromptDismissedAt: u.phone_prompt_dismissed_at,
    displayName: u.display_name,
    profilePictureUrl: u.profile_picture_url,
    createdAt: u.created_at,
    linkedPublisherIds: u.linkedPublisherIds,
    isAdmin: u.isAdmin,
    emailVerified,
    accountStatus: userAccountStatus(u.email, u.email_verified_at),
    signInMethod: signInMethodFromPasswordHash(u.password_hash),
  };
}

function parseProfilePictureUrl(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return SAFE_UPLOAD_PATH.test(trimmed) ? trimmed : undefined;
}

function parseOptionalBoolean(raw: unknown): boolean | undefined {
  if (raw === true) return true;
  if (raw === false) return false;
  return undefined;
}

export function authRouter(db: DatabaseSync) {
  const r = express.Router();

  r.post("/register", jsonMw(), async (req: Request, res: Response) => {
    const body = req.body as { email?: unknown; password?: unknown; displayName?: unknown };
    const emailDisplay = typeof body.email === "string" ? displayStorageEmail(body.email) : "";
    const emailCanonical = typeof body.email === "string" ? canonicalLookupEmail(body.email) : "";
    const password = typeof body.password === "string" ? body.password : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 120) : "";
    const regLim = registerLimiter(authRateKey(req, emailCanonical || "anon"));
    if (!regLim.ok) {
      const retryAfterSec = Math.ceil(regLim.retryAfterMs / 1000);
      res.status(429).set("Retry-After", String(retryAfterSec)).json({
        error: "rate_limited",
        message: "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
        retryAfterSec,
      });
      return;
    }
    if (!emailDisplay.includes("@") || emailDisplay.length > 200) {
      res.status(400).json({ error: "invalid_email" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "password_too_short", message: "Use at least 8 characters." });
      return;
    }
    const id = randomUUID();
    const ph = hashPassword(password);
    const createdAt = isoNow();
    try {
      db.prepare(
        `INSERT INTO users (id, email, email_canonical, phone_e164, password_hash, display_name, created_at, email_verified_at) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`,
      ).run(
        id,
        emailDisplay,
        emailCanonical,
        ph,
        displayName || emailDisplay.split("@")[0]!,
        createdAt,
        null,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("UNIQUE constraint failed") && (msg.includes("email_canonical") || msg.includes("email"))) {
        res.status(409).json({ error: "email_taken" });
        return;
      }
      console.error("[auth] register insert failed:", msg);
      res.status(500).json({
        error: "register_failed",
        message: "No se pudo crear la cuenta (error del servidor). Reintenta en unos minutos o contacta soporte.",
      });
      return;
    }
    issueAuthCookie(res, id);
    const dn = displayName || emailDisplay.split("@")[0]!;
    const { code, emailSent } = await issueEmailVerificationChallenge(
      db,
      id,
      emailDisplay,
      emailCanonical,
      dn,
    );
    const responseBody: Record<string, unknown> = {
      id,
      email: emailDisplay,
      displayName: dn,
      emailVerified: false,
      accountStatus: "pending_validation",
      verificationEmailSent: emailSent,
    };
    if (shouldReturnDevVerificationCode(emailSent)) {
      responseBody.devCode = code;
      responseBody.message = "Correo no configurado; código mostrado solo en dev.";
    } else if (!emailSent) {
      console.warn(`[auth] verification email not sent for ${emailDisplay}`);
    }
    res.status(201).json(responseBody);
  });

  r.post("/login", jsonMw(), (req: Request, res: Response) => {
    const body = req.body as { email?: unknown; phone?: unknown; password?: unknown };
    const rawEmail = typeof body.email === "string" ? body.email : "";
    const rawPhone = typeof body.phone === "string" ? body.phone : "";
    const mx = parseMxAuthPhone(rawPhone) ?? (rawEmail.includes("@") ? null : parseMxAuthPhone(rawEmail));
    const emailCanonical = rawEmail && rawEmail.includes("@") ? canonicalLookupEmail(rawEmail) : "";
    const emailDisplay = rawEmail && rawEmail.includes("@") ? displayStorageEmail(rawEmail) : "";
    const password = typeof body.password === "string" ? body.password : "";
    const loginLim = loginLimiter(authRateKey(req, mx?.e164 || emailCanonical || "anon"));
    if (!loginLim.ok) {
      const retryAfterSec = Math.ceil(loginLim.retryAfterMs / 1000);
      res.status(429).set("Retry-After", String(retryAfterSec)).json({
        error: "rate_limited",
        message: "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
        retryAfterSec,
      });
      return;
    }
    const row = mx
      ? (db
          .prepare(
            `SELECT id, password_hash, phone_verified_at FROM users WHERE phone_e164 = ?`,
          )
          .get(mx.e164) as { id: string; password_hash: string; phone_verified_at: string | null } | undefined)
      : (db
          .prepare("SELECT id, password_hash, phone_verified_at FROM users WHERE email_canonical = ? OR email = ?")
          .get(emailCanonical, emailDisplay) as
            | { id: string; password_hash: string; phone_verified_at: string | null }
            | undefined);
    if (!row || (mx && !isPhoneVerifiedAt(row.phone_verified_at))) {
      res.status(401).json({ error: "user_not_found" });
      return;
    }
    if (isWaOnlyPasswordHash(row.password_hash)) {
      res.status(401).json({ error: "wa_only_account" });
      return;
    }
    if (isGoogleOAuthPasswordHash(row.password_hash)) {
      res.status(401).json({ error: "google_only_account" });
      return;
    }
    if (isFacebookOAuthPasswordHash(row.password_hash)) {
      res.status(401).json({ error: "facebook_only_account" });
      return;
    }
    if (!verifyPassword(password, row.password_hash)) {
      res.status(401).json({ error: "invalid_password" });
      return;
    }
    issueAuthCookie(res, row.id);
    res.json({ ok: true });
  });

  r.post("/logout", (_req: Request, res: Response) => {
    clearAuthCookie(res);
    res.json({ ok: true });
  });

  /** Update profile fields for the logged-in user (display name and/or email). */
  r.patch("/me", jsonMw(), async (req: Request, res: Response) => {
    const uid = readAuthUserId(req);
    if (!uid) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const row = db
      .prepare(
        "SELECT id, email, phone_e164, phone_notify_opt_in, phone_marketing_opt_in, phone_prompt_dismissed_at, password_hash, display_name, profile_picture_url FROM users WHERE id = ?",
      )
      .get(uid) as
      | {
          id: string;
          email: string | null;
          phone_e164: string | null;
          phone_notify_opt_in: number;
          phone_marketing_opt_in: number;
          phone_prompt_dismissed_at: string | null;
          password_hash: string;
          display_name: string;
          profile_picture_url: string | null;
        }
      | undefined;
    if (!row) {
      clearAuthCookie(res);
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const body = req.body as {
      displayName?: unknown;
      email?: unknown;
      currentPassword?: unknown;
      phone?: unknown;
      phoneNotifyOptIn?: unknown;
      phoneMarketingOptIn?: unknown;
      dismissPhonePrompt?: unknown;
      profilePictureUrl?: unknown;
    };

    const sets: string[] = [];
    const params: unknown[] = [];

    if (typeof body.displayName === "string") {
      const dn = body.displayName.trim().slice(0, 120);
      if (!dn) {
        res.status(400).json({ error: "invalid_display_name" });
        return;
      }
      if (dn !== row.display_name) {
        sets.push("display_name = ?");
        params.push(dn);
      }
    }

    const nextPicture = parseProfilePictureUrl(body.profilePictureUrl);
    if (body.profilePictureUrl !== undefined && nextPicture === undefined) {
      res.status(400).json({ error: "invalid_profile_picture_url" });
      return;
    }
    if (nextPicture !== undefined && nextPicture !== (row.profile_picture_url ?? null)) {
      sets.push("profile_picture_url = ?");
      params.push(nextPicture);
    }

    if (typeof body.phone === "string") {
      res.status(400).json({
        error: "phone_otp_required",
        message: "Para guardar o cambiar el teléfono de perfil debes verificarlo con un código SMS.",
      });
      return;
    }

    const nextPhoneNotifyOptIn = parseOptionalBoolean(body.phoneNotifyOptIn);
    if (nextPhoneNotifyOptIn !== undefined && Number(row.phone_notify_opt_in) !== (nextPhoneNotifyOptIn ? 1 : 0)) {
      sets.push("phone_notify_opt_in = ?");
      params.push(nextPhoneNotifyOptIn ? 1 : 0);
    }

    const nextPhoneMarketingOptIn = parseOptionalBoolean(body.phoneMarketingOptIn);
    if (
      nextPhoneMarketingOptIn !== undefined &&
      Number(row.phone_marketing_opt_in) !== (nextPhoneMarketingOptIn ? 1 : 0)
    ) {
      sets.push("phone_marketing_opt_in = ?");
      params.push(nextPhoneMarketingOptIn ? 1 : 0);
    }

    if (body.dismissPhonePrompt === true && !row.phone_prompt_dismissed_at) {
      sets.push("phone_prompt_dismissed_at = ?");
      params.push(isoNow());
    }

    let emailChanged = false;
    let nextEmail: string | null = null;
    let nextEmailCanonical: string | null = null;
    if (typeof body.email === "string") {
      const emailDisplay = displayStorageEmail(body.email);
      const emailCanonical = canonicalLookupEmail(body.email);
      if (!emailDisplay.includes("@") || emailDisplay.length > 200) {
        res.status(400).json({ error: "invalid_email" });
        return;
      }
      if (emailDisplay !== (row.email ?? "")) {
        if (
          !isWaOnlyPasswordHash(row.password_hash) &&
          !isGoogleOAuthPasswordHash(row.password_hash) &&
          !isFacebookOAuthPasswordHash(row.password_hash)
        ) {
          const cp = typeof body.currentPassword === "string" ? body.currentPassword : "";
          if (!cp || !verifyPassword(cp, row.password_hash)) {
            res.status(401).json({ error: "invalid_password" });
            return;
          }
        }
        emailChanged = true;
        nextEmail = emailDisplay;
        nextEmailCanonical = emailCanonical;
        sets.push("email = ?");
        params.push(emailDisplay);
        sets.push("email_canonical = ?");
        params.push(emailCanonical);
        sets.push("email_verified_at = ?");
        params.push(null);
      }
    }

    if (sets.length === 0) {
      res.json({ ok: true, changed: false });
      return;
    }

    params.push(uid);
    try {
      db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...(params as never[]));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        emailChanged &&
        msg.includes("UNIQUE constraint failed") &&
        (msg.includes("email_canonical") || msg.includes("email"))
      ) {
        res.status(409).json({ error: "email_taken" });
        return;
      }
      console.error("[auth] patch /me failed:", msg);
      res.status(500).json({ error: "update_failed" });
      return;
    }
    if (emailChanged && nextEmail && nextEmailCanonical) {
      await issueEmailVerificationChallenge(db, uid, nextEmail, nextEmailCanonical, row.display_name);
    }
    res.json({
      ok: true,
      changed: true,
      emailChanged,
      email: nextEmail ?? row.email,
      emailVerified: emailChanged ? false : undefined,
      accountStatus: emailChanged ? "pending_validation" : undefined,
    });
  });

  /** Change the password for the logged-in user (email accounts only). */
  r.post("/change-password", jsonMw(), (req: Request, res: Response) => {
    const uid = readAuthUserId(req);
    if (!uid) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const row = db
      .prepare("SELECT id, password_hash FROM users WHERE id = ?")
      .get(uid) as { id: string; password_hash: string } | undefined;
    if (!row) {
      clearAuthCookie(res);
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (isWaOnlyPasswordHash(row.password_hash)) {
      res.status(400).json({ error: "wa_only_account" });
      return;
    }
    if (isGoogleOAuthPasswordHash(row.password_hash)) {
      res.status(400).json({ error: "google_only_account" });
      return;
    }
    if (isFacebookOAuthPasswordHash(row.password_hash)) {
      res.status(400).json({ error: "facebook_only_account" });
      return;
    }
    const body = req.body as { currentPassword?: unknown; newPassword?: unknown };
    const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const next = typeof body.newPassword === "string" ? body.newPassword : "";
    if (next.length < 8) {
      res.status(400).json({ error: "password_too_short", message: "Use at least 8 characters." });
      return;
    }
    if (!verifyPassword(current, row.password_hash)) {
      res.status(401).json({ error: "invalid_password" });
      return;
    }
    const ph = hashPassword(next);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(ph, uid);
    res.json({ ok: true });
  });

  /** Request a password-reset link by email (always 200 — no account enumeration). */
  r.post("/forgot-password", jsonMw(), async (req: Request, res: Response) => {
    const body = req.body as { email?: unknown };
    const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
    if (!rawEmail.includes("@") || rawEmail.length > 200) {
      res.status(400).json({ error: "invalid_email" });
      return;
    }
    const lim = forgotPasswordLimiter(`${req.ip ?? "ip"}:${canonicalLookupEmail(rawEmail)}`);
    if (!lim.ok) {
      res.status(429).json({ error: "rate_limited", retryAfterMs: lim.retryAfterMs });
      return;
    }
    const result = await requestPasswordResetForEmail(db, rawEmail);
    const payload: Record<string, unknown> = {
      ok: true,
      message: "Si existe una cuenta con ese correo, enviamos un enlace para restablecer la contraseña.",
    };
    if (passwordResetDevReturnEnabled() && result.devResetUrl) {
      payload.devResetUrl = result.devResetUrl;
    }
    res.json(payload);
  });

  /** Request an SMS OTP to reset the password of a verified +52 account (always 200 — no enumeration). */
  r.post("/phone/password-reset/request", jsonMw(), async (req: Request, res: Response) => {
    const body = req.body as { phone?: unknown };
    const mx = typeof body.phone === "string" ? parseMxAuthPhone(body.phone) : null;
    const lim = forgotPasswordLimiter(`${req.ip ?? "ip"}:phone:${mx?.e164 ?? "anon"}`);
    if (!lim.ok) {
      res.status(429).json({ error: "rate_limited", retryAfterMs: lim.retryAfterMs });
      return;
    }
    const payload: Record<string, unknown> = {
      ok: true,
      message: "Si hay una cuenta con ese celular, enviamos un código SMS.",
    };
    if (!mx) {
      res.status(400).json({ error: "invalid_phone", message: "Usa un celular mexicano a 10 dígitos." });
      return;
    }
    const userId = findUserIdByVerifiedPhone(db, mx.e164);
    if (userId) {
      const user = db
        .prepare("SELECT password_hash FROM users WHERE id = ?")
        .get(userId) as { password_hash: string } | undefined;
      if (user && !isOAuthOnlyPasswordHash(user.password_hash)) {
        const sent = await requestPhoneOtp(db, mx.e164);
        if (!sent.ok) {
          const status = sent.retryAfterSec ? 429 : 400;
          res.status(status).json({
            error: sent.error,
            retryAfterSec: sent.retryAfterSec,
            message:
              sent.error === "sms_not_configured"
                ? "El envío de SMS no está configurado."
                : "No se pudo enviar el código. Inténtalo de nuevo.",
          });
          return;
        }
        if (sent.devCode) payload.devCode = sent.devCode;
        if (sent.resendAvailableIn != null) payload.resendAvailableIn = sent.resendAvailableIn;
      }
    }
    res.json(payload);
  });

  /** Verify the SMS and set a new password for that +52 account. */
  r.post("/phone/password-reset/complete", jsonMw(), async (req: Request, res: Response) => {
    const body = req.body as { phone?: unknown; code?: unknown; newPassword?: unknown };
    const mx = typeof body.phone === "string" ? parseMxAuthPhone(body.phone) : null;
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const next = typeof body.newPassword === "string" ? body.newPassword : "";
    if (!mx) {
      res.status(400).json({ error: "invalid_phone", message: "Usa un celular mexicano a 10 dígitos." });
      return;
    }
    if (next.length < 8) {
      res.status(400).json({ error: "password_too_short", message: "Usa al menos 8 caracteres." });
      return;
    }
    const verified = await verifyPhoneOtp(db, mx.e164, code);
    if (!verified.ok) {
      res.status(400).json({
        error: verified.error,
        message: verified.error === "invalid_code" ? "Código incorrecto." : "No se pudo verificar el código.",
      });
      return;
    }
    const userId = findUserIdByVerifiedPhone(db, mx.e164);
    if (!userId) {
      res.status(400).json({ error: "invalid_code", message: "Código incorrecto." });
      return;
    }
    const user = db
      .prepare("SELECT id, password_hash FROM users WHERE id = ?")
      .get(userId) as { id: string; password_hash: string } | undefined;
    if (!user) {
      res.status(400).json({ error: "invalid_code" });
      return;
    }
    if (isWaOnlyPasswordHash(user.password_hash)) {
      res.status(400).json({ error: "wa_only_account" });
      return;
    }
    if (isGoogleOAuthPasswordHash(user.password_hash)) {
      res.status(400).json({ error: "google_only_account" });
      return;
    }
    if (isFacebookOAuthPasswordHash(user.password_hash)) {
      res.status(400).json({ error: "facebook_only_account" });
      return;
    }
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(next), user.id);
    issueAuthCookie(res, user.id);
    res.json({ ok: true });
  });

  /** Validate a reset token from the email link and start a session for the account. */
  r.post("/password-reset/consume", jsonMw(), (req: Request, res: Response) => {
    const token = typeof (req.body as { token?: unknown }).token === "string"
      ? (req.body as { token: string }).token.trim()
      : "";
    if (!token || token.length > 200) {
      res.status(400).json({ error: "invalid_token" });
      return;
    }
    const row = loadPasswordResetToken(db, token);
    if (!isPasswordResetTokenValid(row)) {
      res.status(400).json({ error: "token_invalid_or_expired" });
      return;
    }
    issueAuthCookie(res, row.user_id);
    res.json({ ok: true, resetToken: token });
  });

  /** Set a new password using a valid reset token (no current password required). */
  r.post("/password-reset/complete", jsonMw(), (req: Request, res: Response) => {
    const body = req.body as { token?: unknown; newPassword?: unknown };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const next = typeof body.newPassword === "string" ? body.newPassword : "";
    if (!token || token.length > 200) {
      res.status(400).json({ error: "invalid_token" });
      return;
    }
    if (next.length < 8) {
      res.status(400).json({ error: "password_too_short", message: "Use at least 8 characters." });
      return;
    }
    const row = loadPasswordResetToken(db, token);
    if (!isPasswordResetTokenValid(row)) {
      res.status(400).json({ error: "token_invalid_or_expired" });
      return;
    }
    const uid = readAuthUserId(req);
    if (uid && uid !== row.user_id) {
      res.status(403).json({ error: "token_user_mismatch" });
      return;
    }
    const user = db
      .prepare("SELECT id, password_hash FROM users WHERE id = ?")
      .get(row.user_id) as { id: string; password_hash: string } | undefined;
    if (!user) {
      res.status(400).json({ error: "token_invalid_or_expired" });
      return;
    }
    if (isWaOnlyPasswordHash(user.password_hash)) {
      res.status(400).json({ error: "wa_only_account" });
      return;
    }
    if (isGoogleOAuthPasswordHash(user.password_hash)) {
      res.status(400).json({ error: "google_only_account" });
      return;
    }
    if (isFacebookOAuthPasswordHash(user.password_hash)) {
      res.status(400).json({ error: "facebook_only_account" });
      return;
    }
    const ph = hashPassword(next);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(ph, row.user_id);
    markPasswordResetTokenUsed(db, token);
    issueAuthCookie(res, row.user_id);
    res.json({ ok: true });
  });

  r.get("/me", (req: Request, res: Response) => {
    const uid = readAuthUserId(req);
    if (!uid) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const u = db
      .prepare(
        "SELECT id, email, phone_e164, phone_notify_opt_in, phone_marketing_opt_in, phone_prompt_dismissed_at, display_name, profile_picture_url, created_at, email_verified_at, phone_verified_at, password_hash FROM users WHERE id = ?",
      )
      .get(uid) as
      | {
          id: string;
          email: string | null;
          phone_e164: string | null;
          phone_notify_opt_in: number;
          phone_marketing_opt_in: number;
          phone_prompt_dismissed_at: string | null;
          display_name: string;
          profile_picture_url: string | null;
          created_at: string;
          email_verified_at: string | null;
          phone_verified_at: string | null;
          password_hash: string;
        }
      | undefined;
    if (!u) {
      clearAuthCookie(res);
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const pubs = db
      .prepare("SELECT publisher_id FROM user_publishers WHERE user_id = ? ORDER BY created_at ASC")
      .all(uid) as { publisher_id: string }[];
    res.json(
      authUserPayload({
        ...u,
        linkedPublisherIds: pubs.map((p) => p.publisher_id),
        isAdmin: isAdminUser(db, uid),
      }),
    );
  });

  /** Verify email with a 6-digit code from the confirmation email. */
  r.post("/email/verify", jsonMw(), (req: Request, res: Response) => {
    const lim = otpVerifyLimiter(req.ip ?? "ip");
    if (!lim.ok) {
      res.status(429).json({ error: "rate_limited", retryAfterMs: lim.retryAfterMs });
      return;
    }
    const uid = readAuthUserId(req);
    if (!uid) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const row = db
      .prepare("SELECT id, email, email_canonical, email_verified_at FROM users WHERE id = ?")
      .get(uid) as
      | { id: string; email: string | null; email_canonical: string | null; email_verified_at: string | null }
      | undefined;
    if (!row?.email?.trim() || !row.email_canonical?.trim()) {
      res.status(400).json({ error: "email_required" });
      return;
    }
    if (row.email_verified_at != null && String(row.email_verified_at).trim() !== "") {
      res.json({ ok: true, alreadyVerified: true, emailVerified: true, accountStatus: "active" });
      return;
    }
    const code = typeof (req.body as { code?: unknown }).code === "string" ? (req.body as { code: string }).code.trim() : "";
    const result = verifyEmailVerificationCode(db, uid, row.email_canonical, code);
    if (!result.ok) {
      const status =
        result.error === "too_many_attempts"
          ? 429
          : result.error === "invalid_input" || result.error === "invalid_code" || result.error === "code_expired"
            ? 400
            : 400;
      res.status(status).json({ error: result.error });
      return;
    }
    const verifiedAt = isoNow();
    markUserEmailVerified(db, uid, verifiedAt);
    res.json({ ok: true, emailVerified: true, accountStatus: "active", verifiedAt });
  });

  /** Resend the email verification code. */
  r.post("/email/resend", jsonMw(), async (req: Request, res: Response) => {
    const uid = readAuthUserId(req);
    if (!uid) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const lim = emailVerifyResendLimiter(uid);
    if (!lim.ok) {
      res.status(429).json({ error: "rate_limited", retryAfterMs: lim.retryAfterMs });
      return;
    }
    const row = db
      .prepare("SELECT id, email, email_canonical, display_name, email_verified_at FROM users WHERE id = ?")
      .get(uid) as
      | {
          id: string;
          email: string | null;
          email_canonical: string | null;
          display_name: string;
          email_verified_at: string | null;
        }
      | undefined;
    if (!row?.email?.trim() || !row.email_canonical?.trim()) {
      res.status(400).json({ error: "email_required" });
      return;
    }
    if (row.email_verified_at != null && String(row.email_verified_at).trim() !== "") {
      res.json({ ok: true, alreadyVerified: true, emailVerified: true, accountStatus: "active" });
      return;
    }
    const { code, emailSent } = await issueEmailVerificationChallenge(
      db,
      uid,
      row.email,
      row.email_canonical,
      row.display_name,
    );
    const body: Record<string, unknown> = { ok: true, emailSent };
    if (shouldReturnDevVerificationCode(emailSent)) {
      body.devCode = code;
      body.message = "Correo no configurado; código mostrado solo en dev.";
    }
    res.json(body);
  });

  /** Link current anonymous publisher cookie to the logged-in user (merge listings identity). */
  r.post("/link-publisher", (req: Request, res: Response) => {
    const uid = readAuthUserId(req);
    if (!uid) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const pub = readPublisherIdFromRequest(req) ?? getOrCreatePublisherId(req, res);
    try {
      db.prepare(`INSERT INTO user_publishers (user_id, publisher_id, created_at) VALUES (?, ?, ?)`).run(
        uid,
        pub,
        isoNow(),
      );
    } catch {
      res.status(409).json({ error: "publisher_linked_elsewhere" });
      return;
    }
    res.json({ ok: true, publisherId: pub });
  });

  r.post("/phone/otp/request", jsonMw(), async (req: Request, res: Response) => {
    const body = req.body as { phone?: unknown };
    const mx = typeof body.phone === "string" ? parseMxAuthPhone(body.phone) : null;
    const lim = otpRequestLimiter(`${req.ip ?? "ip"}:${mx?.e164 ?? "anon"}`);
    if (!lim.ok) {
      res.status(429).json({ error: "rate_limited", retryAfterMs: lim.retryAfterMs });
      return;
    }
    if (!mx) {
      res.status(400).json({ error: "invalid_phone", message: "Usa un celular mexicano a 10 dígitos." });
      return;
    }
    const uid = readAuthUserId(req);
    const taken = findUserIdByVerifiedPhone(db, mx.e164);
    if (taken && taken !== uid) {
      res.status(409).json({
        error: "phone_taken",
        message: "Ese número ya tiene una cuenta. Entra con teléfono o correo y contraseña.",
      });
      return;
    }
    const sent = await requestPhoneOtp(db, mx.e164);
    if (!sent.ok) {
      const status = sent.retryAfterSec ? 429 : 400;
      res.status(status).json({
        error: sent.error,
        retryAfterSec: sent.retryAfterSec,
        message:
          sent.error === "sms_not_configured"
            ? "El envío de SMS no está configurado."
            : "No se pudo enviar el código. Inténtalo de nuevo.",
      });
      return;
    }
    res.json({ ok: true, ...(sent.devCode ? { devCode: sent.devCode } : {}), resendAvailableIn: sent.resendAvailableIn });
  });

  r.post("/phone/register", jsonMw(), async (req: Request, res: Response) => {
    const body = req.body as {
      phone?: unknown;
      code?: unknown;
      password?: unknown;
      displayName?: unknown;
      profilePictureUrl?: unknown;
    };
    const mx = typeof body.phone === "string" ? parseMxAuthPhone(body.phone) : null;
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 120) : "";
    const picture = parseProfilePictureUrl(body.profilePictureUrl);
    if (!mx) {
      res.status(400).json({ error: "invalid_phone" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "password_too_short", message: "Usa al menos 8 caracteres." });
      return;
    }
    if (!displayName) {
      res.status(400).json({ error: "invalid_display_name" });
      return;
    }
    const existing = findUserIdByVerifiedPhone(db, mx.e164);
    if (existing) {
      res.status(409).json({
        error: "phone_taken",
        message: "Ese número ya tiene una cuenta. Entra con teléfono y contraseña.",
      });
      return;
    }
    const verified = await verifyPhoneOtp(db, mx.e164, code);
    if (!verified.ok) {
      res.status(400).json({ error: verified.error });
      return;
    }
    try {
      const id = createPhoneUser(db, {
        phoneE164: mx.e164,
        passwordHash: hashPassword(password),
        displayName,
        profilePictureUrl: picture === undefined ? null : picture,
      });
      issueAuthCookie(res, id);
      res.status(201).json({ ok: true, userId: id, phoneVerified: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("UNIQUE constraint failed")) {
        res.status(409).json({ error: "phone_taken" });
        return;
      }
      console.error("[auth] phone register failed:", msg);
      res.status(500).json({ error: "register_failed" });
    }
  });

  r.post("/phone/verify", jsonMw(), async (req: Request, res: Response) => {
    const uid = readAuthUserId(req);
    if (!uid) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const body = req.body as { phone?: unknown; code?: unknown };
    const mx = typeof body.phone === "string" ? parseMxAuthPhone(body.phone) : null;
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!mx) {
      res.status(400).json({ error: "invalid_phone" });
      return;
    }
    const me = db
      .prepare("SELECT phone_e164, phone_verified_at, email, email_verified_at FROM users WHERE id = ?")
      .get(uid) as {
      phone_e164: string | null;
      phone_verified_at: string | null;
      email: string | null;
      email_verified_at: string | null;
    } | undefined;
    if (!me) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const currentVerified = isPhoneVerifiedAt(me.phone_verified_at) ? me.phone_e164 : null;
    if (currentVerified && currentVerified !== mx.e164) {
      const emailVerified = me.email_verified_at != null && String(me.email_verified_at).trim() !== "";
      if (!me.email?.trim() || !emailVerified) {
        res.status(400).json({
          error: "verified_email_required",
          message: "Para cambiar tu teléfono de perfil primero agrega y verifica un correo.",
        });
        return;
      }
    }
    const taken = findUserIdByVerifiedPhone(db, mx.e164);
    if (taken && taken !== uid) {
      res.status(409).json({
        error: "phone_taken",
        message: "Ese número ya tiene una cuenta. Entra con esa cuenta.",
      });
      return;
    }
    const verified = await verifyPhoneOtp(db, mx.e164, code);
    if (!verified.ok) {
      res.status(400).json({ error: verified.error });
      return;
    }
    setUserPhoneVerified(db, uid, mx.e164);
    res.json({ ok: true, phoneVerified: true, phoneE164: mx.e164 });
  });

  r.post("/whatsapp/request", jsonMw(), (req: Request, res: Response) => {
    const lim = otpRequestLimiter(`${req.ip ?? "ip"}:${String((req.body as { phone?: string }).phone)}`);
    if (!lim.ok) {
      res.status(429).json({ error: "rate_limited", retryAfterMs: lim.retryAfterMs });
      return;
    }
    const body = req.body as { phone?: unknown };
    const digits = typeof body.phone === "string" ? normalizeWhatsAppDigits(body.phone) : null;
    if (!digits) {
      res.status(400).json({ error: "invalid_phone" });
      return;
    }
    const phone = phoneE164FromDigits(digits);
    db.prepare("DELETE FROM whatsapp_otp_challenges WHERE expires_at < ?").run(Date.now());
    const code = String(randomInt(100_000, 1_000_000));
    const id = randomUUID();
    const codeHash = hashOtp(phone, code);
    db.prepare(
      `INSERT INTO whatsapp_otp_challenges (id, phone_e164, code_hash, expires_at, attempts, created_at) VALUES (?, ?, ?, ?, 0, ?)`,
    ).run(id, phone, codeHash, Date.now() + OTP_TTL_MS, Date.now());

    void (async () => {
      const metaConfigured = Boolean(
        process.env.META_ACCESS_TOKEN?.trim() && process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim(),
      );
      if (!metaConfigured) {
        recordWhatsAppOtpSend("skipped");
        return;
      }
      const sent = await sendWhatsAppOtpTemplate(phone.replace("+", ""), code);
      recordWhatsAppOtpSend(sent.ok ? "ok" : "fail");
      if (!sent.ok && process.env.NODE_ENV === "production") {
        console.warn(`[whatsapp] send failed: ${sent.error}`);
      }
    })();

    const devReturn =
      process.env.NODE_ENV !== "production" || process.env.META_OTP_DEV_RETURN === "1";
    const metaConfigured = Boolean(
      process.env.META_ACCESS_TOKEN?.trim() && process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim(),
    );
    if (devReturn && !metaConfigured) {
      res.json({ ok: true, devCode: code, message: "Meta not configured; code shown for local/dev only." });
      return;
    }
    res.json({ ok: true });
  });

  r.post("/whatsapp/verify", jsonMw(), (req: Request, res: Response) => {
    const lim = otpVerifyLimiter(req.ip ?? "ip");
    if (!lim.ok) {
      res.status(429).json({ error: "rate_limited", retryAfterMs: lim.retryAfterMs });
      return;
    }
    const body = req.body as { phone?: unknown; code?: unknown };
    const digits = typeof body.phone === "string" ? normalizeWhatsAppDigits(body.phone) : null;
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!digits || !/^\d{6}$/.test(code)) {
      res.status(400).json({ error: "invalid_input" });
      return;
    }
    const phone = phoneE164FromDigits(digits);
    const row = db
      .prepare(
        `SELECT id, code_hash, expires_at, attempts FROM whatsapp_otp_challenges WHERE phone_e164 = ? ORDER BY created_at DESC LIMIT 1`,
      )
      .get(phone) as { id: string; code_hash: string; expires_at: number; attempts: number } | undefined;
    if (!row || row.expires_at < Date.now()) {
      res.status(400).json({ error: "code_expired" });
      return;
    }
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      res.status(429).json({ error: "too_many_attempts" });
      return;
    }
    const ok = hashOtp(phone, code) === row.code_hash;
    db.prepare(`UPDATE whatsapp_otp_challenges SET attempts = attempts + 1 WHERE id = ?`).run(row.id);
    if (!ok) {
      res.status(400).json({ error: "invalid_code" });
      return;
    }
    db.prepare("DELETE FROM whatsapp_otp_challenges WHERE id = ?").run(row.id);

    let userId = (db.prepare("SELECT id FROM users WHERE phone_e164 = ?").get(phone) as { id: string } | undefined)
      ?.id;
    if (!userId) {
      userId = randomUUID();
      db.prepare(
        `INSERT INTO users (id, email, phone_e164, password_hash, display_name, created_at) VALUES (?, NULL, ?, ?, ?, ?)`,
      ).run(userId, phone, waOnlyPasswordPlaceholder(), "Usuario WhatsApp", isoNow());
    }
    issueAuthCookie(res, userId);
    res.json({ ok: true, userId });
  });

  /** Create a short-lived handoff URL for Messenger → web publish flow. */
  r.post("/handoff/create", jsonMw(), (req: Request, res: Response) => {
    const pub = readPublisherIdFromRequest(req) ?? getOrCreatePublisherId(req, res);
    const body = req.body as { draftPropertyId?: unknown };
    const draftPropertyId =
      typeof body.draftPropertyId === "string" && body.draftPropertyId.length < 200 ? body.draftPropertyId : null;
    const { token, url } = createPublishHandoff(db, pub, draftPropertyId);
    res.json({ token, url });
  });

  r.post("/handoff/consume", jsonMw(), (req: Request, res: Response) => {
    const body = req.body as { token?: unknown };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token || token.length > 200) {
      res.status(400).json({ error: "invalid_token" });
      return;
    }
    const row = db
      .prepare(
        `SELECT token, publisher_id, draft_property_id, expires_at, used_at FROM messenger_handoff_tokens WHERE token = ?`,
      )
      .get(token) as
      | {
          token: string;
          publisher_id: string;
          draft_property_id: string | null;
          expires_at: number;
          used_at: number | null;
        }
      | undefined;
    if (!row || row.used_at != null || row.expires_at < Date.now()) {
      res.status(400).json({ error: "token_invalid_or_used" });
      return;
    }
    db.prepare(`UPDATE messenger_handoff_tokens SET used_at = ? WHERE token = ?`).run(Date.now(), token);
    issuePublisherCookie(res, row.publisher_id);
    res.json({ ok: true, publisherId: row.publisher_id, draftPropertyId: row.draft_property_id });
  });

  /** Intentionally no “login as user” / impersonation endpoint exists (D4). */
  r.all("/impersonate", (_req: Request, res: Response) => {
    res.status(410).json({
      error: "impersonation_disabled",
      message: "Admin impersonation is not supported by design.",
    });
  });

  registerGoogleOAuthRoutes(db, r);
  registerFacebookOAuthRoutes(db, r);

  return r;
}

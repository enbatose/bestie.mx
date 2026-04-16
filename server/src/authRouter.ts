import { createHash, randomInt, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import express, { type Request, type Response } from "express";
import { createSlidingWindowLimiter } from "./rateLimit.js";
import { sendWhatsAppOtpTemplate } from "./whatsappMeta.js";
import { hashPassword, verifyPassword } from "./password.js";
import { issueAuthCookie, clearAuthCookie, readAuthUserId } from "./jwtSession.js";
import { isAdminUser, waOnlyPasswordPlaceholder, isWaOnlyPasswordHash } from "./adminAuth.js";
import { createPublishHandoff, publicWebOrigin } from "./handoffTokens.js";
import { createEmailVerificationToken, verifyEmailWithToken } from "./emailVerification.js";
import { sendVerificationEmail } from "./mailer.js";
import { getOrCreatePublisherId, readPublisherIdFromRequest, issuePublisherCookie } from "./session.js";
import { normalizeWhatsAppDigits } from "./validation.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 8;

const otpRequestLimiter = createSlidingWindowLimiter({ windowMs: 60_000, max: 5 });
const otpVerifyLimiter = createSlidingWindowLimiter({ windowMs: 60_000, max: 20 });
const emailVerifyLimiter = createSlidingWindowLimiter({ windowMs: 60_000, max: 10 });

function otpPepper(): string {
  return process.env.AUTH_JWT_SECRET?.trim() || "dev-insecure-auth-secret-change-me";
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

export function authRouter(db: DatabaseSync) {
  const r = express.Router();

  r.get("/verify-email", (req: Request, res: Response) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) {
      res.status(400).type("text/plain").send("Missing token");
      return;
    }
    const result = verifyEmailWithToken(db, token);
    if (!result.ok) {
      res.status(400).type("text/plain").send("Invalid or expired verification link");
      return;
    }
    const base = publicWebOrigin();
    res.redirect(302, `${base}/entrar?verified=1`);
  });

  r.post("/register", jsonMw(), (req: Request, res: Response) => {
    const body = req.body as { email?: unknown; password?: unknown; displayName?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 120) : "";
    if (!email.includes("@") || email.length > 200) {
      res.status(400).json({ error: "invalid_email" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "password_too_short", message: "Use at least 8 characters." });
      return;
    }
    const id = randomUUID();
    const ph = hashPassword(password);
    try {
      db.prepare(
        `INSERT INTO users (id, email, phone_e164, password_hash, display_name, created_at) VALUES (?, ?, NULL, ?, ?, ?)`,
      ).run(id, email, ph, displayName || email.split("@")[0]!, isoNow());
    } catch {
      res.status(409).json({ error: "email_taken" });
      return;
    }
    issueAuthCookie(res, id);
    const rawVerify = createEmailVerificationToken(db, id);
    const verifyUrl = `${publicWebOrigin()}/api/auth/verify-email?token=${encodeURIComponent(rawVerify)}`;
    void sendVerificationEmail(email, verifyUrl).catch((e) => {
      console.warn(`[email] verification send failed: ${e instanceof Error ? e.message : String(e)}`);
    });
    const devVerificationUrl = process.env.NODE_ENV !== "production" ? verifyUrl : undefined;
    res.status(201).json({
      id,
      email,
      displayName: displayName || email.split("@")[0],
      ...(devVerificationUrl ? { devVerificationUrl } : {}),
    });
  });

  r.post("/resend-verification", jsonMw(), (req: Request, res: Response) => {
    const lim = emailVerifyLimiter(`${req.ip ?? "ip"}:${String((req.body as { email?: string }).email ?? "")}`);
    if (!lim.ok) {
      res.status(429).json({ error: "rate_limited", retryAfterMs: lim.retryAfterMs });
      return;
    }
    const body = req.body as { email?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email.includes("@") || email.length > 200) {
      res.status(400).json({ error: "invalid_email" });
      return;
    }
    const u = db
      .prepare("SELECT id, email_verified_at FROM users WHERE email = ?")
      .get(email) as { id: string; email_verified_at: string | null } | undefined;
    if (!u) {
      // Avoid leaking account existence too strongly in prod, but still return ok so UI can proceed.
      res.json({ ok: true });
      return;
    }
    if (u.email_verified_at != null && String(u.email_verified_at).trim() !== "") {
      res.json({ ok: true, alreadyVerified: true });
      return;
    }
    const rawVerify = createEmailVerificationToken(db, u.id);
    const verifyUrl = `${publicWebOrigin()}/api/auth/verify-email?token=${encodeURIComponent(rawVerify)}`;
    void sendVerificationEmail(email, verifyUrl).catch((e) => {
      console.warn(`[email] verification resend failed: ${e instanceof Error ? e.message : String(e)}`);
    });
    res.json({ ok: true });
  });

  r.post("/login", jsonMw(), (req: Request, res: Response) => {
    const body = req.body as { email?: unknown; password?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const row = db.prepare("SELECT id, password_hash FROM users WHERE email = ?").get(email) as
      | { id: string; password_hash: string }
      | undefined;
    if (!row) {
      res.status(401).json({ error: "user_not_found" });
      return;
    }
    if (isWaOnlyPasswordHash(row.password_hash)) {
      res.status(401).json({ error: "wa_only_account" });
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

  r.get("/me", (req: Request, res: Response) => {
    const uid = readAuthUserId(req);
    if (!uid) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const u = db
      .prepare(
        "SELECT id, email, phone_e164, display_name, created_at, email_verified_at FROM users WHERE id = ?",
      )
      .get(uid) as
      | {
          id: string;
          email: string | null;
          phone_e164: string | null;
          display_name: string;
          created_at: string;
          email_verified_at: string | null;
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
    res.json({
      id: u.id,
      email: u.email,
      phoneE164: u.phone_e164,
      displayName: u.display_name,
      createdAt: u.created_at,
      linkedPublisherIds: pubs.map((p) => p.publisher_id),
      isAdmin: isAdminUser(db, uid),
      emailVerified: u.email_verified_at != null && String(u.email_verified_at).trim() !== "",
    });
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
      const sent = await sendWhatsAppOtpTemplate(phone.replace("+", ""), code);
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

  return r;
}

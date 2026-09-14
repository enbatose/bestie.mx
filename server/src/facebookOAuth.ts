import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import express, { type Request, type Response } from "express";
import {
  facebookOAuthPasswordPlaceholder,
  isFacebookOAuthPasswordHash,
} from "./adminAuth.js";
import { classifyAdminUserRole } from "./adminUsers.js";
import { eraseUserForArco } from "./arcoErasure.js";
import { authSecret } from "./authSecret.js";
import { canonicalLookupEmail, displayStorageEmail } from "./authEmail.js";
import { issueAuthCookie } from "./jwtSession.js";
import { parseCookies, readPublisherIdFromRequest, resolveSessionCookieAttrs } from "./session.js";

const OAUTH_STATE_COOKIE = "bestie_facebook_oauth";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const FACEBOOK_PROVIDER = "facebook";
const FACEBOOK_GRAPH_VERSION = "v21.0";

type OAuthStatePayload = {
  state: string;
  returnTo: string;
  exp: number;
  /** True after we already sent Facebook `auth_type=rerequest` for email. */
  reask?: boolean;
};

type FacebookUserInfo = {
  id: string;
  email?: string;
  name?: string;
  picture?: { data?: { url?: string } };
};

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(s: string): Buffer {
  const pad = 4 - (s.length % 4);
  const norm = s.replace(/-/g, "+").replace(/_/g, "/") + (pad === 4 ? "" : "=".repeat(pad));
  return Buffer.from(norm, "base64");
}

function oauthPepper(): string {
  return authSecret();
}

function signOAuthState(payload: OAuthStatePayload): string {
  const payloadPart = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = createHmac("sha256", oauthPepper()).update(payloadPart).digest();
  return `${payloadPart}.${b64url(sig)}`;
}

function verifyOAuthState(token: string): OAuthStatePayload | null {
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return null;
  const payloadPart = token.slice(0, idx);
  const sigPart = token.slice(idx + 1);
  let sig: Buffer;
  try {
    sig = fromB64url(sigPart);
  } catch {
    return null;
  }
  const expected = createHmac("sha256", oauthPepper()).update(payloadPart).digest();
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(fromB64url(payloadPart).toString("utf8")) as OAuthStatePayload;
  } catch {
    return null;
  }
  if (typeof payload.state !== "string" || typeof payload.returnTo !== "string" || typeof payload.exp !== "number") {
    return null;
  }
  if (payload.reask != null && typeof payload.reask !== "boolean") return null;
  if (payload.exp < Date.now()) return null;
  return payload;
}

function issueOAuthStateCookie(res: Response, payload: OAuthStatePayload): void {
  const token = signOAuthState(payload);
  const opts = resolveSessionCookieAttrs();
  const maxAgeSec = Math.max(60, Math.floor((payload.exp - Date.now()) / 1000));
  const parts = [
    `${OAUTH_STATE_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/api/auth/facebook",
    "HttpOnly",
    `SameSite=${opts.sameSite}`,
    `Max-Age=${maxAgeSec}`,
  ];
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  if (opts.secure) parts.push("Secure");
  res.appendHeader("Set-Cookie", parts.join("; "));
}

function clearOAuthStateCookie(res: Response): void {
  const opts = resolveSessionCookieAttrs();
  const parts = [
    `${OAUTH_STATE_COOKIE}=`,
    "Path=/api/auth/facebook",
    "HttpOnly",
    `SameSite=${opts.sameSite}`,
    "Max-Age=0",
  ];
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  if (opts.secure) parts.push("Secure");
  res.appendHeader("Set-Cookie", parts.join("; "));
}

function readOAuthStateCookie(req: Request): OAuthStatePayload | null {
  const raw = parseCookies(req.headers.cookie)[OAUTH_STATE_COOKIE];
  if (!raw) return null;
  return verifyOAuthState(raw);
}

function webOrigin(): string {
  return process.env.PUBLIC_WEB_ORIGIN?.replace(/\/$/, "") || "https://www.bestie.mx";
}

export function facebookOAuthConfig(): {
  appId: string;
  appSecret: string;
  redirectUri: string;
} | null {
  const appId = process.env.FACEBOOK_APP_ID?.trim();
  const appSecret = process.env.FACEBOOK_APP_SECRET?.trim();
  const redirectUri =
    process.env.FACEBOOK_OAUTH_REDIRECT_URI?.trim() ||
    `${webOrigin()}/api/auth/facebook/callback`;
  if (!appId || !appSecret) return null;
  return { appId, appSecret, redirectUri };
}

export function isFacebookOAuthEnabled(): boolean {
  return facebookOAuthConfig() != null;
}

type FacebookSignedRequestPayload = {
  user_id?: string;
  algorithm?: string;
};

/** Meta `signed_request` (HMAC-SHA256 + base64url JSON). */
export function parseFacebookSignedRequest(
  signedRequest: string,
  appSecret: string,
): FacebookSignedRequestPayload | null {
  const idx = signedRequest.indexOf(".");
  if (idx <= 0) return null;
  const encodedSig = signedRequest.slice(0, idx);
  const payloadPart = signedRequest.slice(idx + 1);
  if (!encodedSig || !payloadPart) return null;
  let sig: Buffer;
  try {
    sig = fromB64url(encodedSig);
  } catch {
    return null;
  }
  const expected = createHmac("sha256", appSecret).update(payloadPart).digest();
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  let payload: FacebookSignedRequestPayload;
  try {
    payload = JSON.parse(fromB64url(payloadPart).toString("utf8")) as FacebookSignedRequestPayload;
  } catch {
    return null;
  }
  const algo = typeof payload.algorithm === "string" ? payload.algorithm.toUpperCase() : "";
  if (algo && algo !== "HMAC-SHA256") return null;
  return payload;
}

function isFacebookHostedProfileUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "facebook.com" ||
      host.endsWith(".facebook.com") ||
      host === "fbcdn.net" ||
      host.endsWith(".fbcdn.net") ||
      host === "fbsbx.com" ||
      host.endsWith(".fbsbx.com")
    );
  } catch {
    return /fbcdn\.net|facebook\.com|fbsbx\.com/i.test(url);
  }
}

export type FacebookDeletionPublicStatus = "unlinked" | "erased" | "none";

function facebookDeletionStatusUrl(code: string): string {
  return `${webOrigin()}/eliminar-facebook?code=${encodeURIComponent(code)}`;
}

function signedRequestFromBody(req: Request): string {
  const body = req.body as { signed_request?: unknown } | undefined;
  return typeof body?.signed_request === "string" ? body.signed_request.trim() : "";
}

function applyFacebookLoginDataDeletion(
  db: DatabaseSync,
  facebookUserId: string,
): FacebookDeletionPublicStatus {
  const userId = findUserIdByOAuth(db, FACEBOOK_PROVIDER, facebookUserId);
  if (!userId) return "none";

  const row = db
    .prepare("SELECT id, email, password_hash, profile_picture_url FROM users WHERE id = ?")
    .get(userId) as
    | { id: string; email: string | null; password_hash: string; profile_picture_url: string | null }
    | undefined;
  if (!row) {
    db.prepare("DELETE FROM oauth_identities WHERE provider = ? AND provider_user_id = ?").run(
      FACEBOOK_PROVIDER,
      facebookUserId,
    );
    return "none";
  }

  const role = classifyAdminUserRole(row.id, row.email);
  const facebookOnly = isFacebookOAuthPasswordHash(row.password_hash);

  db.prepare("DELETE FROM oauth_identities WHERE provider = ? AND provider_user_id = ?").run(
    FACEBOOK_PROVIDER,
    facebookUserId,
  );
  if (isFacebookHostedProfileUrl(row.profile_picture_url)) {
    db.prepare("UPDATE users SET profile_picture_url = NULL WHERE id = ?").run(row.id);
  }

  if (!facebookOnly || role !== "user") return "unlinked";

  try {
    eraseUserForArco(db, {
      userId: row.id,
      adminUserId: "facebook-data-deletion",
      emailConfirm: row.email?.trim() || row.id,
      source: "facebook",
      reason: "Meta Facebook Login data deletion callback",
    });
    return "erased";
  } catch (err) {
    console.error("[facebook-data-deletion] ARCO erase failed after unlink", err);
    return "unlinked";
  }
}

function safeReturnTo(raw: unknown): string {
  if (typeof raw !== "string") return "/mis-anuncios";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/mis-anuncios";
  if (trimmed.length > 500) return "/mis-anuncios";
  return trimmed;
}

function oauthErrorRedirect(res: Response, code: string): void {
  const origin = webOrigin();
  res.redirect(302, `${origin}/entrar?error=${encodeURIComponent(code)}`);
}

function isoNow(): string {
  return new Date().toISOString();
}

function tryLinkPublisher(db: DatabaseSync, req: Request, userId: string): void {
  const pub = readPublisherIdFromRequest(req);
  if (!pub) return;
  try {
    db.prepare(`INSERT INTO user_publishers (user_id, publisher_id, created_at) VALUES (?, ?, ?)`).run(
      userId,
      pub,
      isoNow(),
    );
  } catch {
    /* publisher already linked to another account */
  }
}

function upsertOAuthIdentity(db: DatabaseSync, provider: string, providerUserId: string, userId: string): void {
  db.prepare(
    `INSERT INTO oauth_identities (provider, provider_user_id, user_id, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(provider, provider_user_id) DO UPDATE SET user_id = excluded.user_id`,
  ).run(provider, providerUserId, userId, isoNow());
}

function findUserIdByOAuth(db: DatabaseSync, provider: string, providerUserId: string): string | null {
  const row = db
    .prepare("SELECT user_id FROM oauth_identities WHERE provider = ? AND provider_user_id = ?")
    .get(provider, providerUserId) as { user_id: string } | undefined;
  return row?.user_id ?? null;
}

function findUserByEmailCanonical(
  db: DatabaseSync,
  emailCanonical: string,
  emailDisplay: string,
): { id: string } | undefined {
  return db
    .prepare("SELECT id FROM users WHERE email_canonical = ? OR email = ?")
    .get(emailCanonical, emailDisplay) as { id: string } | undefined;
}

function createFacebookUser(
  db: DatabaseSync,
  info: FacebookUserInfo,
  emailDisplay: string,
  emailCanonical: string,
): string {
  const userId = randomUUID();
  const displayName = (info.name?.trim() || emailDisplay.split("@")[0] || "Usuario").slice(0, 120);
  const pictureUrl = info.picture?.data?.url?.trim() || null;
  db.prepare(
    `INSERT INTO users (id, email, email_canonical, phone_e164, password_hash, display_name, created_at, email_verified_at, profile_picture_url)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
  ).run(
    userId,
    emailDisplay,
    emailCanonical,
    facebookOAuthPasswordPlaceholder(),
    displayName,
    isoNow(),
    isoNow(),
    pictureUrl,
  );
  upsertOAuthIdentity(db, FACEBOOK_PROVIDER, info.id, userId);
  return userId;
}

function resolveFacebookUserId(db: DatabaseSync, info: FacebookUserInfo): string | null {
  if (!info.id) return null;
  const linked = findUserIdByOAuth(db, FACEBOOK_PROVIDER, info.id);
  if (linked) return linked;

  const rawEmail = info.email?.trim();
  if (!rawEmail?.includes("@")) return null;
  const emailDisplay = displayStorageEmail(rawEmail);
  const emailCanonical = canonicalLookupEmail(rawEmail);

  const existing = findUserByEmailCanonical(db, emailCanonical, emailDisplay);
  if (existing) {
    upsertOAuthIdentity(db, FACEBOOK_PROVIDER, info.id, existing.id);
    db.prepare("UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?").run(
      isoNow(),
      existing.id,
    );
    const pictureUrl = info.picture?.data?.url?.trim();
    if (pictureUrl) {
      db.prepare(
        "UPDATE users SET profile_picture_url = COALESCE(profile_picture_url, ?) WHERE id = ?",
      ).run(pictureUrl, existing.id);
    }
    return existing.id;
  }

  return createFacebookUser(db, info, emailDisplay, emailCanonical);
}

async function exchangeFacebookCode(
  code: string,
  config: { appId: string; appSecret: string; redirectUri: string },
): Promise<string | null> {
  const params = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: config.redirectUri,
    code,
  });
  const res = await fetch(
    `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/oauth/access_token?${params.toString()}`,
  );
  if (!res.ok) return null;
  const j = (await res.json()) as { access_token?: string };
  return typeof j.access_token === "string" ? j.access_token : null;
}

async function fetchFacebookUserInfo(accessToken: string): Promise<FacebookUserInfo | null> {
  const params = new URLSearchParams({
    fields: "id,name,email,picture.type(large)",
    access_token: accessToken,
  });
  const res = await fetch(`https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me?${params.toString()}`);
  if (!res.ok) return null;
  const j = (await res.json()) as FacebookUserInfo;
  return typeof j.id === "string" ? j : null;
}

async function facebookEmailPermissionGranted(accessToken: string): Promise<boolean | null> {
  const res = await fetch(
    `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me/permissions?access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!res.ok) return null;
  const j = (await res.json()) as { data?: Array<{ permission?: string; status?: string }> };
  const email = j.data?.find((p) => p.permission === "email");
  if (!email) return null;
  return email.status === "granted";
}

function redirectToFacebookDialog(
  res: Response,
  config: { appId: string; redirectUri: string },
  returnTo: string,
  reask: boolean,
): void {
  const state = b64url(randomBytes(24));
  issueOAuthStateCookie(res, {
    state,
    returnTo,
    reask,
    exp: Date.now() + OAUTH_STATE_TTL_MS,
  });
  const params = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "email,public_profile",
    state,
  });
  if (reask) params.set("auth_type", "rerequest");
  res.redirect(302, `https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth?${params.toString()}`);
}

export function registerFacebookOAuthRoutes(db: DatabaseSync, r: express.Router): void {
  r.get("/facebook/enabled", (_req: Request, res: Response) => {
    res.json({ enabled: isFacebookOAuthEnabled() });
  });

  r.get("/facebook", (req: Request, res: Response) => {
    const config = facebookOAuthConfig();
    if (!config) {
      oauthErrorRedirect(res, "facebook_not_configured");
      return;
    }
    redirectToFacebookDialog(res, config, safeReturnTo(req.query.returnTo), req.query.reask === "1");
  });

  r.get("/facebook/callback", async (req: Request, res: Response) => {
    clearOAuthStateCookie(res);
    const config = facebookOAuthConfig();
    if (!config) {
      oauthErrorRedirect(res, "facebook_not_configured");
      return;
    }

    const oauthError = typeof req.query.error === "string" ? req.query.error : "";
    if (oauthError) {
      oauthErrorRedirect(res, oauthError === "access_denied" ? "facebook_denied" : "facebook_oauth_failed");
      return;
    }

    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!code || !state) {
      oauthErrorRedirect(res, "facebook_oauth_failed");
      return;
    }

    const stored = readOAuthStateCookie(req);
    if (!stored || stored.state !== state) {
      oauthErrorRedirect(res, "facebook_state_mismatch");
      return;
    }

    const accessToken = await exchangeFacebookCode(code, config);
    if (!accessToken) {
      oauthErrorRedirect(res, "facebook_token_failed");
      return;
    }

    const info = await fetchFacebookUserInfo(accessToken);
    if (!info?.id) {
      oauthErrorRedirect(res, "facebook_profile_failed");
      return;
    }

    const linked = findUserIdByOAuth(db, FACEBOOK_PROVIDER, info.id);
    if (!info.email?.includes("@")) {
      if (linked) {
        issueAuthCookie(res, linked);
        tryLinkPublisher(db, req, linked);
        res.redirect(302, `${webOrigin()}${stored.returnTo}`);
        return;
      }
      if (!stored.reask) {
        redirectToFacebookDialog(res, config, stored.returnTo, true);
        return;
      }
      const granted = await facebookEmailPermissionGranted(accessToken);
      oauthErrorRedirect(res, granted === false ? "facebook_email_declined" : "facebook_email_required");
      return;
    }

    const userId = resolveFacebookUserId(db, info);
    if (!userId) {
      oauthErrorRedirect(res, "facebook_account_failed");
      return;
    }

    issueAuthCookie(res, userId);
    tryLinkPublisher(db, req, userId);

    const origin = webOrigin();
    res.redirect(302, `${origin}${stored.returnTo}`);
  });

  r.post(
    "/facebook/data-deletion",
    express.urlencoded({ extended: false, limit: "32kb" }),
    express.json({ limit: "32kb" }),
    (req: Request, res: Response) => {
      const config = facebookOAuthConfig();
      if (!config) {
        res.status(503).json({ error: "facebook_not_configured" });
        return;
      }
      const signed = signedRequestFromBody(req);
      const payload = signed ? parseFacebookSignedRequest(signed, config.appSecret) : null;
      const facebookUserId = typeof payload?.user_id === "string" ? payload.user_id.trim() : "";
      if (!facebookUserId) {
        res.status(400).json({ error: "invalid_signed_request" });
        return;
      }

      const confirmationCode = randomBytes(16).toString("hex");
      let status: FacebookDeletionPublicStatus = "none";
      try {
        status = applyFacebookLoginDataDeletion(db, facebookUserId);
      } catch (err) {
        console.error("[facebook-data-deletion] unlink failed", err);
        res.status(500).json({ error: "deletion_failed" });
        return;
      }

      db.prepare(
        `INSERT INTO facebook_data_deletion_requests (confirmation_code, facebook_user_id, status, created_at)
         VALUES (?, ?, ?, ?)`,
      ).run(confirmationCode, facebookUserId, status, isoNow());

      res.status(200).json({
        url: facebookDeletionStatusUrl(confirmationCode),
        confirmation_code: confirmationCode,
      });
    },
  );

  r.get("/facebook/deletion-status", (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code.trim() : "";
    if (!/^[a-f0-9]{32}$/i.test(code)) {
      res.status(400).json({ error: "invalid_code" });
      return;
    }
    const row = db
      .prepare("SELECT status FROM facebook_data_deletion_requests WHERE confirmation_code = ?")
      .get(code.toLowerCase()) as { status: string } | undefined;
    if (!row) {
      res.json({ ok: true, found: false });
      return;
    }
    const status: FacebookDeletionPublicStatus =
      row.status === "erased" || row.status === "unlinked" || row.status === "none"
        ? row.status
        : "none";
    res.json({ ok: true, found: true, status, confirmation_code: code.toLowerCase() });
  });
}

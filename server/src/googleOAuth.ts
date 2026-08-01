import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import express, { type Request, type Response } from "express";
import { googleOAuthPasswordPlaceholder } from "./adminAuth.js";
import { authSecret } from "./authSecret.js";
import { canonicalLookupEmail, displayStorageEmail } from "./authEmail.js";
import { issueAuthCookie } from "./jwtSession.js";
import { parseCookies, readPublisherIdFromRequest, resolveSessionCookieAttrs } from "./session.js";

const OAUTH_STATE_COOKIE = "bestie_google_oauth";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const GOOGLE_PROVIDER = "google";

type OAuthStatePayload = {
  state: string;
  codeVerifier: string;
  returnTo: string;
  exp: number;
};

type GoogleUserInfo = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
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
  if (
    typeof payload.state !== "string" ||
    typeof payload.codeVerifier !== "string" ||
    typeof payload.returnTo !== "string" ||
    typeof payload.exp !== "number"
  ) {
    return null;
  }
  if (payload.exp < Date.now()) return null;
  return payload;
}

function issueOAuthStateCookie(res: Response, payload: OAuthStatePayload): void {
  const token = signOAuthState(payload);
  const opts = resolveSessionCookieAttrs();
  const maxAgeSec = Math.max(60, Math.floor((payload.exp - Date.now()) / 1000));
  const parts = [
    `${OAUTH_STATE_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/api/auth/google",
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
    "Path=/api/auth/google",
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

function pkceChallenge(verifier: string): string {
  return b64url(createHash("sha256").update(verifier).digest());
}

function webOrigin(): string {
  return process.env.PUBLIC_WEB_ORIGIN?.replace(/\/$/, "") || "https://www.bestie.mx";
}

export function googleOAuthConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ||
    `${webOrigin()}/api/auth/google/callback`;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

export function isGoogleOAuthEnabled(): boolean {
  return googleOAuthConfig() != null;
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
): { id: string; password_hash: string } | undefined {
  return db
    .prepare("SELECT id, password_hash FROM users WHERE email_canonical = ? OR email = ?")
    .get(emailCanonical, emailDisplay) as { id: string; password_hash: string } | undefined;
}

function createGoogleUser(
  db: DatabaseSync,
  info: GoogleUserInfo,
  emailDisplay: string,
  emailCanonical: string,
): string {
  const userId = randomUUID();
  const displayName = (info.name?.trim() || emailDisplay.split("@")[0] || "Usuario").slice(0, 120);
  const verifiedAt = info.email_verified === false ? null : isoNow();
  db.prepare(
    `INSERT INTO users (id, email, email_canonical, phone_e164, password_hash, display_name, created_at, email_verified_at, profile_picture_url)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
  ).run(
    userId,
    emailDisplay,
    emailCanonical,
    googleOAuthPasswordPlaceholder(),
    displayName,
    isoNow(),
    verifiedAt,
    info.picture?.trim() || null,
  );
  upsertOAuthIdentity(db, GOOGLE_PROVIDER, info.sub, userId);
  return userId;
}

function resolveGoogleUserId(db: DatabaseSync, info: GoogleUserInfo): string | null {
  if (!info.sub) return null;
  const linked = findUserIdByOAuth(db, GOOGLE_PROVIDER, info.sub);
  if (linked) return linked;

  const rawEmail = info.email?.trim();
  if (!rawEmail?.includes("@")) return null;
  const emailDisplay = displayStorageEmail(rawEmail);
  const emailCanonical = canonicalLookupEmail(rawEmail);

  const existing = findUserByEmailCanonical(db, emailCanonical, emailDisplay);
  if (existing) {
    upsertOAuthIdentity(db, GOOGLE_PROVIDER, info.sub, existing.id);
    if (info.email_verified !== false) {
      db.prepare("UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?").run(
        isoNow(),
        existing.id,
      );
    }
    if (info.picture?.trim()) {
      db.prepare(
        "UPDATE users SET profile_picture_url = COALESCE(profile_picture_url, ?) WHERE id = ?",
      ).run(info.picture.trim(), existing.id);
    }
    return existing.id;
  }

  return createGoogleUser(db, info, emailDisplay, emailCanonical);
}

async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as GoogleUserInfo;
  return typeof j.sub === "string" ? j : null;
}

async function exchangeGoogleCode(
  code: string,
  codeVerifier: string,
  config: { clientId: string; clientSecret: string; redirectUri: string },
): Promise<string | null> {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { access_token?: string };
  return typeof j.access_token === "string" ? j.access_token : null;
}

export function registerGoogleOAuthRoutes(db: DatabaseSync, r: express.Router): void {
  r.get("/google/enabled", (_req: Request, res: Response) => {
    res.json({ enabled: isGoogleOAuthEnabled() });
  });

  r.get("/google", (req: Request, res: Response) => {
    const config = googleOAuthConfig();
    if (!config) {
      oauthErrorRedirect(res, "google_not_configured");
      return;
    }
    const state = b64url(randomBytes(24));
    const codeVerifier = b64url(randomBytes(32));
    const returnTo = safeReturnTo(req.query.returnTo);
    issueOAuthStateCookie(res, {
      state,
      codeVerifier,
      returnTo,
      exp: Date.now() + OAUTH_STATE_TTL_MS,
    });
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: pkceChallenge(codeVerifier),
      code_challenge_method: "S256",
      access_type: "online",
      prompt: "select_account",
    });
    res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  r.get("/google/callback", async (req: Request, res: Response) => {
    clearOAuthStateCookie(res);
    const config = googleOAuthConfig();
    if (!config) {
      oauthErrorRedirect(res, "google_not_configured");
      return;
    }

    const oauthError = typeof req.query.error === "string" ? req.query.error : "";
    if (oauthError) {
      oauthErrorRedirect(res, oauthError === "access_denied" ? "google_denied" : "google_oauth_failed");
      return;
    }

    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!code || !state) {
      oauthErrorRedirect(res, "google_oauth_failed");
      return;
    }

    const stored = readOAuthStateCookie(req);
    if (!stored || stored.state !== state) {
      oauthErrorRedirect(res, "google_state_mismatch");
      return;
    }

    const accessToken = await exchangeGoogleCode(code, stored.codeVerifier, config);
    if (!accessToken) {
      oauthErrorRedirect(res, "google_token_failed");
      return;
    }

    const info = await fetchGoogleUserInfo(accessToken);
    if (!info?.sub || !info.email?.includes("@")) {
      oauthErrorRedirect(res, "google_profile_failed");
      return;
    }

    const userId = resolveGoogleUserId(db, info);
    if (!userId) {
      oauthErrorRedirect(res, "google_account_failed");
      return;
    }

    issueAuthCookie(res, userId);
    tryLinkPublisher(db, req, userId);

    const origin = webOrigin();
    res.redirect(302, `${origin}${stored.returnTo}`);
  });
}

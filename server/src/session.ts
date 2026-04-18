import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";

export const PUBLISHER_COOKIE = "bestie_pub";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

export function readPublisherIdFromRequest(req: Request): string | null {
  const raw = parseCookies(req.headers.cookie)[PUBLISHER_COOKIE];
  return raw && UUID_RE.test(raw) ? raw : null;
}

/**
 * Cookie shape for `bestie_auth` and `bestie_pub` when the SPA and API are on different hosts
 * (set AUTH_CROSS_SITE_COOKIES=1 or AUTH_COOKIE_SAME_SITE=None, and optional AUTH_COOKIE_DOMAIN).
 */
export function resolveSessionCookieAttrs(): {
  sameSite: "Lax" | "None" | "Strict";
  secure: boolean;
  domain?: string;
} {
  if (process.env.TEST_DISABLE_SECURE_COOKIE === "1") {
    return { sameSite: "Lax", secure: false };
  }

  const explicit = process.env.AUTH_COOKIE_SAME_SITE?.trim().toLowerCase();
  let sameSite: "Lax" | "None" | "Strict" = "Lax";
  if (explicit === "none") sameSite = "None";
  else if (explicit === "strict") sameSite = "Strict";
  else if (explicit === "lax") sameSite = "Lax";
  else if (
    process.env.AUTH_CROSS_SITE_COOKIES === "1" ||
    /^true$/i.test(process.env.AUTH_CROSS_SITE_COOKIES ?? "")
  ) {
    sameSite = "None";
  }

  const secure = sameSite === "None" ? true : process.env.NODE_ENV === "production";
  const domain = process.env.AUTH_COOKIE_DOMAIN?.trim();
  return { sameSite, secure, ...(domain ? { domain } : {}) };
}

export function issuePublisherCookie(res: Response, publisherId: string): void {
  const opts = resolveSessionCookieAttrs();
  const parts = [
    `${PUBLISHER_COOKIE}=${encodeURIComponent(publisherId)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${opts.sameSite}`,
    "Max-Age=31536000",
  ];
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  if (opts.secure) parts.push("Secure");
  res.appendHeader("Set-Cookie", parts.join("; "));
}

export function getOrCreatePublisherId(req: Request, res: Response): string {
  const existing = readPublisherIdFromRequest(req);
  if (existing) return existing;
  const id = randomUUID();
  issuePublisherCookie(res, id);
  return id;
}

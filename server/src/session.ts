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

export function issuePublisherCookie(res: Response, publisherId: string): void {
  const secure = process.env.NODE_ENV === "production";
  const parts = [
    `${PUBLISHER_COOKIE}=${encodeURIComponent(publisherId)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=31536000",
  ];
  if (secure) parts.push("Secure");
  res.appendHeader("Set-Cookie", parts.join("; "));
}

export function getOrCreatePublisherId(req: Request, res: Response): string {
  const existing = readPublisherIdFromRequest(req);
  if (existing) return existing;
  const id = randomUUID();
  issuePublisherCookie(res, id);
  return id;
}

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { parseCookies } from "./session.js";

export const AUTH_COOKIE = "bestie_auth";

export type AuthJwtPayload = {
  sub: string;
  iat: number;
  exp: number;
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

function secret(): string {
  const s = process.env.AUTH_JWT_SECRET?.trim();
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_JWT_SECRET must be set (min 16 chars) in production");
  }
  return "dev-insecure-auth-secret-change-me";
}

export function signAuthToken(userId: string, ttlSec: number): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: AuthJwtPayload = { sub: userId, iat: now, exp: now + ttlSec };
  const payloadPart = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = createHmac("sha256", secret()).update(payloadPart).digest();
  return `${payloadPart}.${b64url(sig)}`;
}

export function verifyAuthToken(token: string): AuthJwtPayload | null {
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
  const expected = createHmac("sha256", secret()).update(payloadPart).digest();
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  let payload: AuthJwtPayload;
  try {
    payload = JSON.parse(fromB64url(payloadPart).toString("utf8")) as AuthJwtPayload;
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
  if (payload.exp < now) return null;
  return payload;
}

export function readAuthUserId(req: Request): string | null {
  const raw = parseCookies(req.headers.cookie)[AUTH_COOKIE];
  if (!raw) return null;
  const p = verifyAuthToken(raw);
  return p?.sub ?? null;
}

export function issueAuthCookie(res: Response, userId: string): void {
  const ttl = Number(process.env.AUTH_SESSION_TTL_SEC);
  const ttlSec = Number.isFinite(ttl) && ttl > 60 ? ttl : 60 * 60 * 24 * 14;
  const token = signAuthToken(userId, ttlSec);
  const secure = process.env.NODE_ENV === "production";
  const parts = [
    `${AUTH_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${ttlSec}`,
  ];
  if (secure) parts.push("Secure");
  res.appendHeader("Set-Cookie", parts.join("; "));
}

export function clearAuthCookie(res: Response): void {
  const secure = process.env.NODE_ENV === "production";
  const parts = [`${AUTH_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  res.appendHeader("Set-Cookie", parts.join("; "));
}

import type { DatabaseSync } from "node:sqlite";
import type { Request } from "express";
import { isAdminUser } from "./adminAuth.js";
import { readAuthUserId } from "./jwtSession.js";
import { readPublisherIdFromRequest } from "./session.js";

export function isAdminRequest(db: DatabaseSync, req: Request): boolean {
  const uid = readAuthUserId(req);
  return Boolean(uid && isAdminUser(db, uid));
}

/** Logged-in admin, or anonymous session with a publisher id (wizard / my-listings). */
export function hasPublisherOrAdminSession(db: DatabaseSync, req: Request): boolean {
  return readPublisherIdFromRequest(req) != null || isAdminRequest(db, req);
}

export function canWritePropertyByRequest(db: DatabaseSync, req: Request, propertyPublisherId: string): boolean {
  const pub = readPublisherIdFromRequest(req);
  if (pub != null && pub === propertyPublisherId) return true;
  return isAdminRequest(db, req);
}

/** Owner session (publisher cookie or linked account) for read-only UI hints on public pages. */
export function viewerOwnsProperty(db: DatabaseSync, req: Request, propertyPublisherId: string): boolean {
  if (canWritePropertyByRequest(db, req, propertyPublisherId)) return true;
  const userId = readAuthUserId(req);
  if (!userId) return false;
  const row = db
    .prepare(`SELECT 1 AS x FROM user_publishers WHERE user_id = ? AND publisher_id = ?`)
    .get(userId, propertyPublisherId) as { x: number } | undefined;
  return row != null;
}

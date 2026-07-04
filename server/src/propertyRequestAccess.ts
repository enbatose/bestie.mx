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
  if (isAdminRequest(db, req)) return true;
  const userId = readAuthUserId(req);
  const pub = readPublisherIdFromRequest(req);
  if (pub != null && pub === propertyPublisherId) {
    if (!userId) return true;
    const linkedUser = publisherLinkedUserId(db, pub);
    if (linkedUser == null || linkedUser === userId) return true;
  }
  if (!userId) return false;
  const row = db
    .prepare(`SELECT 1 AS x FROM user_publishers WHERE user_id = ? AND publisher_id = ?`)
    .get(userId, propertyPublisherId) as { x: number } | undefined;
  return row != null;
}

/** Owner session (publisher cookie or linked account) for read-only UI hints on public pages. */
export function viewerOwnsProperty(db: DatabaseSync, req: Request, propertyPublisherId: string): boolean {
  return canWritePropertyByRequest(db, req, propertyPublisherId);
}

function publisherLinkedUserId(db: DatabaseSync, publisherId: string): string | null {
  const row = db
    .prepare(`SELECT user_id FROM user_publishers WHERE publisher_id = ?`)
    .get(publisherId) as { user_id: string } | undefined;
  return row?.user_id ?? null;
}

/** Publisher ids whose listings belong to this browser session and/or logged-in account. */
export function publisherIdsForOwnerSession(db: DatabaseSync, req: Request): string[] {
  const cookiePub = readPublisherIdFromRequest(req);
  const userId = readAuthUserId(req);

  if (!userId) {
    return cookiePub ? [cookiePub] : [];
  }

  const ids = new Set<string>();
  const rows = db
    .prepare("SELECT publisher_id FROM user_publishers WHERE user_id = ? ORDER BY created_at ASC")
    .all(userId) as { publisher_id: string }[];
  for (const row of rows) ids.add(row.publisher_id);

  /** Ignore stale `bestie_pub` cookies already linked to a different account (shared browser / prior session). */
  if (cookiePub) {
    const linkedUser = publisherLinkedUserId(db, cookiePub);
    if (linkedUser == null || linkedUser === userId) {
      ids.add(cookiePub);
    }
  }

  return [...ids];
}

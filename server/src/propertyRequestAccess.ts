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

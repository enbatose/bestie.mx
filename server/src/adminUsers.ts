import type { DatabaseSync } from "node:sqlite";
import { isAdminEmail, parseAdminEmails } from "./adminAuth.js";
import { isUserEmailVerified, userAccountStatus } from "./emailVerification.js";
import { FEEDBACK_BOT_USER_ID, isSystemMessagingBot, SUPPORT_BOT_USER_ID } from "./messagingSchema.js";

export const ADMIN_USER_SEGMENTS = ["real", "pending", "staff", "all"] as const;
export type AdminUserSegment = (typeof ADMIN_USER_SEGMENTS)[number];
export type AdminUserRole = "user" | "admin" | "system";

export type AdminUserRow = {
  id: string;
  email: string | null;
  phoneLast4: string | null;
  displayName: string;
  createdAt: string;
  emailVerified: boolean;
  accountStatus: "active" | "pending_validation";
  role: AdminUserRole;
};

export type AdminUserCounts = {
  real: number;
  pending: number;
  staff: number;
  all: number;
};

export type AdminUsersListResult = {
  users: AdminUserRow[];
  total: number;
  limit: number;
  offset: number;
  segment: AdminUserSegment;
  counts: AdminUserCounts;
};

const SYSTEM_BOT_IDS = [SUPPORT_BOT_USER_ID, FEEDBACK_BOT_USER_ID] as const;

export function parseAdminUserSegment(raw: unknown): AdminUserSegment {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return (ADMIN_USER_SEGMENTS as readonly string[]).includes(v) ? (v as AdminUserSegment) : "real";
}

export function classifyAdminUserRole(id: string, email: string | null | undefined): AdminUserRole {
  if (isSystemMessagingBot(id)) return "system";
  if (isAdminEmail(email)) return "admin";
  return "user";
}

function placeholders(n: number): string {
  return Array.from({ length: n }, () => "?").join(",");
}

function staffPredicate(adminEmails: string[]): { sql: string; params: (string | number)[] } {
  const parts = [`id IN (${placeholders(SYSTEM_BOT_IDS.length)})`];
  const params: (string | number)[] = [...SYSTEM_BOT_IDS];
  if (adminEmails.length > 0) {
    parts.push(`lower(trim(IFNULL(email, ''))) IN (${placeholders(adminEmails.length)})`);
    params.push(...adminEmails);
  }
  return { sql: `(${parts.join(" OR ")})`, params };
}

function nonStaffPredicate(adminEmails: string[]): { sql: string; params: (string | number)[] } {
  const params: (string | number)[] = [...SYSTEM_BOT_IDS];
  let sql = `id NOT IN (${placeholders(SYSTEM_BOT_IDS.length)})`;
  if (adminEmails.length > 0) {
    sql += ` AND (email IS NULL OR trim(email) = '' OR lower(trim(email)) NOT IN (${placeholders(adminEmails.length)}))`;
    params.push(...adminEmails);
  }
  return { sql, params };
}

const PENDING_SQL = `(email IS NOT NULL AND trim(email) != '' AND (email_verified_at IS NULL OR trim(email_verified_at) = ''))`;
const ACTIVE_SQL = `(email IS NULL OR trim(email) = '' OR (email_verified_at IS NOT NULL AND trim(email_verified_at) != ''))`;

function segmentPredicate(
  segment: AdminUserSegment,
  adminEmails: string[],
): { sql: string; params: (string | number)[] } {
  if (segment === "staff") return staffPredicate(adminEmails);
  const nonStaff = nonStaffPredicate(adminEmails);
  if (segment === "all") return nonStaff;
  if (segment === "pending") {
    return { sql: `${nonStaff.sql} AND ${PENDING_SQL}`, params: nonStaff.params };
  }
  return { sql: `${nonStaff.sql} AND ${ACTIVE_SQL}`, params: nonStaff.params };
}

function countWhere(db: DatabaseSync, sql: string, params: (string | number)[]): number {
  return (db.prepare(`SELECT COUNT(*) AS c FROM users WHERE ${sql}`).get(...params) as { c: number }).c;
}

function mapUserRow(u: Record<string, unknown>): AdminUserRow {
  const id = String(u.id ?? "");
  const email = typeof u.email === "string" ? u.email : null;
  const emailVerifiedAt = typeof u.email_verified_at === "string" ? u.email_verified_at : null;
  const emailVerified = isUserEmailVerified(emailVerifiedAt);
  return {
    id,
    email,
    phoneLast4:
      typeof u.phone_e164 === "string" && u.phone_e164.length >= 4 ? u.phone_e164.slice(-4) : null,
    displayName: String(u.display_name ?? ""),
    createdAt: String(u.created_at ?? ""),
    emailVerified,
    accountStatus: userAccountStatus(email, emailVerifiedAt),
    role: classifyAdminUserRole(id, email),
  };
}

export function countAdminUsersSegment(db: DatabaseSync, segment: AdminUserSegment): number {
  const pred = segmentPredicate(segment, [...parseAdminEmails()]);
  return countWhere(db, pred.sql, pred.params);
}

export function listAdminUsers(
  db: DatabaseSync,
  opts: { segment?: unknown; limit?: unknown; offset?: unknown } = {},
): AdminUsersListResult {
  const segment = parseAdminUserSegment(opts.segment);
  const limit = Math.min(200, Math.max(1, Number(opts.limit) || 50));
  const offset = Math.max(0, Number(opts.offset) || 0);
  const adminEmails = [...parseAdminEmails()];

  const real = segmentPredicate("real", adminEmails);
  const pending = segmentPredicate("pending", adminEmails);
  const staff = segmentPredicate("staff", adminEmails);
  const all = segmentPredicate("all", adminEmails);
  const counts: AdminUserCounts = {
    real: countWhere(db, real.sql, real.params),
    pending: countWhere(db, pending.sql, pending.params),
    staff: countWhere(db, staff.sql, staff.params),
    all: countWhere(db, all.sql, all.params),
  };

  const current = segmentPredicate(segment, adminEmails);
  const rows = db
    .prepare(
      `SELECT id, email, phone_e164, display_name, created_at, email_verified_at
       FROM users WHERE ${current.sql}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...current.params, limit, offset) as Record<string, unknown>[];

  return {
    users: rows.map(mapUserRow),
    total: counts[segment],
    limit,
    offset,
    segment,
    counts,
  };
}

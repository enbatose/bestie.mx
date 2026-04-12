import type { DatabaseSync } from "node:sqlite";

const WA_ONLY_MARKER = "wa-only-no-password";

export function isWaOnlyPasswordHash(stored: string): boolean {
  return stored === WA_ONLY_MARKER;
}

export function waOnlyPasswordPlaceholder(): string {
  return WA_ONLY_MARKER;
}

export function parseAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  const set = new Set<string>();
  for (const part of raw.split(",")) {
    const e = part.trim().toLowerCase();
    if (e.includes("@")) set.add(e);
  }
  return set;
}

export function isAdminUser(db: DatabaseSync, userId: string): boolean {
  const emails = parseAdminEmails();
  if (emails.size === 0) return false;
  const row = db.prepare("SELECT email FROM users WHERE id = ?").get(userId) as { email: string | null } | undefined;
  const em = row?.email?.trim().toLowerCase();
  return Boolean(em && emails.has(em));
}

import type { DatabaseSync } from "node:sqlite";

/** Always treated as admins (plus any emails in `ADMIN_EMAILS`). Lowercased at runtime. */
const BUILTIN_ADMIN_EMAILS: readonly string[] = ["saava.iren@gmail.com", "batani.enrique@gmail.com"];

const WA_ONLY_MARKER = "wa-only-no-password";
const GOOGLE_OAUTH_MARKER = "google-oauth-no-password";
const FACEBOOK_OAUTH_MARKER = "facebook-oauth-no-password";

export function isWaOnlyPasswordHash(stored: string): boolean {
  return stored === WA_ONLY_MARKER;
}

export function waOnlyPasswordPlaceholder(): string {
  return WA_ONLY_MARKER;
}

export function isGoogleOAuthPasswordHash(stored: string): boolean {
  return stored === GOOGLE_OAUTH_MARKER;
}

export function googleOAuthPasswordPlaceholder(): string {
  return GOOGLE_OAUTH_MARKER;
}

export function isFacebookOAuthPasswordHash(stored: string): boolean {
  return stored === FACEBOOK_OAUTH_MARKER;
}

export function facebookOAuthPasswordPlaceholder(): string {
  return FACEBOOK_OAUTH_MARKER;
}

export function isOAuthOnlyPasswordHash(stored: string): boolean {
  return isWaOnlyPasswordHash(stored) || isGoogleOAuthPasswordHash(stored) || isFacebookOAuthPasswordHash(stored);
}

export type SignInMethod = "email" | "google" | "facebook" | "phone";

export function signInMethodFromPasswordHash(stored: string): SignInMethod {
  if (isGoogleOAuthPasswordHash(stored)) return "google";
  if (isFacebookOAuthPasswordHash(stored)) return "facebook";
  if (isWaOnlyPasswordHash(stored)) return "phone";
  return "email";
}

export function parseAdminEmails(): Set<string> {
  const set = new Set<string>();
  for (const builtin of BUILTIN_ADMIN_EMAILS) {
    const e = builtin.trim().toLowerCase();
    if (e.includes("@")) set.add(e);
  }
  const raw = process.env.ADMIN_EMAILS ?? "";
  for (const part of raw.split(",")) {
    const e = part.trim().toLowerCase();
    if (e.includes("@")) set.add(e);
  }
  return set;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const em = email?.trim().toLowerCase();
  return Boolean(em && parseAdminEmails().has(em));
}

export function isAdminUser(db: DatabaseSync, userId: string): boolean {
  const row = db.prepare("SELECT email FROM users WHERE id = ?").get(userId) as { email: string | null } | undefined;
  return isAdminEmail(row?.email);
}

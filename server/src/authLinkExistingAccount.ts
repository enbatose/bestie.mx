import type { DatabaseSync } from "node:sqlite";
import { canonicalLookupEmail } from "./authEmail.js";
import { isPhoneVerifiedAt } from "./phoneAuth.js";

export class OAuthProviderTakenError extends Error {
  readonly code = "oauth_provider_taken";
  constructor() {
    super("oauth_provider_taken");
    this.name = "OAuthProviderTakenError";
  }
}

function isoNow(): string {
  return new Date().toISOString();
}

export function findUserIdByEmailLookup(
  db: DatabaseSync,
  emailCanonical: string,
  emailDisplay: string,
): string | null {
  const row = db
    .prepare("SELECT id FROM users WHERE email_canonical = ? OR email = ?")
    .get(emailCanonical, emailDisplay) as { id: string } | undefined;
  return row?.id ?? null;
}

export function oauthMergeBlocked(db: DatabaseSync, stubId: string, targetId: string): boolean {
  const stubOauth = db
    .prepare("SELECT provider, provider_user_id FROM oauth_identities WHERE user_id = ?")
    .all(stubId) as Array<{ provider: string; provider_user_id: string }>;
  for (const ident of stubOauth) {
    const onTarget = oauthProviderUserId(db, ident.provider, targetId);
    if (onTarget && onTarget !== ident.provider_user_id) return true;
  }
  return false;
}

export function oauthProviderUserId(
  db: DatabaseSync,
  provider: string,
  userId: string,
): string | null {
  const row = db
    .prepare("SELECT provider_user_id FROM oauth_identities WHERE provider = ? AND user_id = ?")
    .get(provider, userId) as { provider_user_id: string } | undefined;
  return row?.provider_user_id ?? null;
}

/**
 * Facebook (or other) session with no email and no verified phone may attach to the
 * account that already owns that email or Mexican cellphone after the user proves the inbox/SIM.
 * Two established accounts (different emails, or a stub that already has a verified phone) stay separate.
 */
export function canMergeStubIntoExisting(db: DatabaseSync, stubId: string, targetId: string): boolean {
  if (!stubId || !targetId || stubId === targetId) return false;
  if (oauthMergeBlocked(db, stubId, targetId)) return false;
  const stub = db
    .prepare("SELECT email, phone_verified_at FROM users WHERE id = ?")
    .get(stubId) as { email: string | null; phone_verified_at: string | null } | undefined;
  const target = db
    .prepare("SELECT email FROM users WHERE id = ?")
    .get(targetId) as { email: string | null } | undefined;
  if (!stub || !target) return false;
  if (isPhoneVerifiedAt(stub.phone_verified_at)) return false;
  const stubEmail = stub.email?.trim();
  const targetEmail = target.email?.trim();
  if (stubEmail) {
    if (!targetEmail) return false;
    return canonicalLookupEmail(stubEmail) === canonicalLookupEmail(targetEmail);
  }
  return true;
}

/** Move a no-email stub (Facebook Login without Graph email) onto the account that owns that email. */
export function absorbStubUserInto(db: DatabaseSync, stubId: string, targetId: string): void {
  if (stubId === targetId) return;

  const stubOauth = db
    .prepare("SELECT provider, provider_user_id FROM oauth_identities WHERE user_id = ?")
    .all(stubId) as Array<{ provider: string; provider_user_id: string }>;

  for (const ident of stubOauth) {
    const onTarget = oauthProviderUserId(db, ident.provider, targetId);
    if (onTarget && onTarget !== ident.provider_user_id) {
      throw new OAuthProviderTakenError();
    }
    db.prepare(
      `INSERT INTO oauth_identities (provider, provider_user_id, user_id, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(provider, provider_user_id) DO UPDATE SET user_id = excluded.user_id`,
    ).run(ident.provider, ident.provider_user_id, targetId, isoNow());
  }
  db.prepare("DELETE FROM oauth_identities WHERE user_id = ?").run(stubId);

  const stub = db
    .prepare(
      "SELECT profile_picture_url, phone_e164, phone_verified_at FROM users WHERE id = ?",
    )
    .get(stubId) as
    | { profile_picture_url: string | null; phone_e164: string | null; phone_verified_at: string | null }
    | undefined;
  const target = db
    .prepare("SELECT profile_picture_url, phone_e164 FROM users WHERE id = ?")
    .get(targetId) as { profile_picture_url: string | null; phone_e164: string | null } | undefined;
  if (stub?.profile_picture_url && !target?.profile_picture_url) {
    db.prepare("UPDATE users SET profile_picture_url = ? WHERE id = ?").run(stub.profile_picture_url, targetId);
  }
  if (stub?.phone_e164 && stub.phone_verified_at && !target?.phone_e164) {
    db.prepare("UPDATE users SET phone_e164 = ?, phone_verified_at = ? WHERE id = ?").run(
      stub.phone_e164,
      stub.phone_verified_at,
      targetId,
    );
  }

  const pubs = db
    .prepare("SELECT publisher_id FROM user_publishers WHERE user_id = ?")
    .all(stubId) as Array<{ publisher_id: string }>;
  for (const { publisher_id } of pubs) {
    const owner = db
      .prepare("SELECT user_id FROM user_publishers WHERE publisher_id = ?")
      .get(publisher_id) as { user_id: string } | undefined;
    if (owner && owner.user_id !== stubId) {
      db.prepare("DELETE FROM user_publishers WHERE user_id = ? AND publisher_id = ?").run(stubId, publisher_id);
      continue;
    }
    try {
      db.prepare("UPDATE user_publishers SET user_id = ? WHERE user_id = ? AND publisher_id = ?").run(
        targetId,
        stubId,
        publisher_id,
      );
    } catch {
      db.prepare("DELETE FROM user_publishers WHERE user_id = ? AND publisher_id = ?").run(stubId, publisher_id);
    }
  }

  db.prepare("DELETE FROM email_verification_challenges WHERE user_id = ?").run(stubId);
  db.prepare("DELETE FROM users WHERE id = ?").run(stubId);
}

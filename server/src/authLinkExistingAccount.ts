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

export const MSG_EMAIL_TAKEN =
  "Ese correo ya tiene una cuenta Bestie. Entra con ese correo y contraseña, o con Google/Facebook si así la creaste. Si olvidaste la contraseña, usa Recuperar contraseña. No unimos dos cuentas que ya tienen correos distintos.";

export const MSG_EMAIL_OTHER_OAUTH =
  "Ese correo ya está ligado a otro Facebook o Google. Entra con esa cuenta original. No se puede pegar un segundo inicio de sesión del mismo proveedor.";

export const MSG_PHONE_TAKEN =
  "Ese celular ya tiene una cuenta Bestie. Cierra sesión y entra con ese teléfono y contraseña, o con el Google/Facebook de esa cuenta. No unimos dos cuentas que ya tienen correo o celular distintos.";

export const MSG_PHONE_REGISTER_TAKEN =
  "Ese número ya tiene una cuenta. Entra con teléfono y contraseña, o con Google/Facebook si esa cuenta ya los tiene ligados.";

export const MSG_ALREADY_SIGNED_IN_PHONE =
  "Ya tienes una sesión abierta. Confirma este celular desde tu perfil (Editar cuenta), no registres otra cuenta.";

/**
 * A session may attach to the account that already owns that email or Mexican cellphone
 * after inbox or SIM proof, when the two sides are not two fully established identities.
 * Allowed: Facebook without email; Google/Facebook with email into a phone-only account;
 * a stub that already confirmed a free phone into an email account that has no other phone.
 * Blocked: two different emails, two different verified phones, or two Facebook/Google ids.
 */
export function canMergeStubIntoExisting(db: DatabaseSync, stubId: string, targetId: string): boolean {
  if (!stubId || !targetId || stubId === targetId) return false;
  if (oauthMergeBlocked(db, stubId, targetId)) return false;
  const stub = db
    .prepare("SELECT email, phone_e164, phone_verified_at FROM users WHERE id = ?")
    .get(stubId) as {
    email: string | null;
    phone_e164: string | null;
    phone_verified_at: string | null;
  } | undefined;
  const target = db
    .prepare("SELECT email, phone_e164, phone_verified_at FROM users WHERE id = ?")
    .get(targetId) as {
    email: string | null;
    phone_e164: string | null;
    phone_verified_at: string | null;
  } | undefined;
  if (!stub || !target) return false;
  const stubPhone = isPhoneVerifiedAt(stub.phone_verified_at) ? stub.phone_e164 : null;
  const targetPhone = isPhoneVerifiedAt(target.phone_verified_at) ? target.phone_e164 : null;
  if (stubPhone && targetPhone && stubPhone !== targetPhone) return false;
  const stubEmail = stub.email?.trim();
  const targetEmail = target.email?.trim();
  if (stubEmail && targetEmail) {
    return canonicalLookupEmail(stubEmail) === canonicalLookupEmail(targetEmail);
  }
  return true;
}

function reassignOrDropUserColumn(
  db: DatabaseSync,
  table: string,
  column: string,
  fromId: string,
  toId: string,
): void {
  try {
    const rows = db.prepare(`SELECT rowid AS rid FROM ${table} WHERE ${column} = ?`).all(fromId) as Array<{
      rid: number;
    }>;
    for (const { rid } of rows) {
      try {
        db.prepare(`UPDATE ${table} SET ${column} = ? WHERE rowid = ?`).run(toId, rid);
      } catch {
        db.prepare(`DELETE FROM ${table} WHERE rowid = ?`).run(rid);
      }
    }
  } catch {
    /* table may be absent in a partial test schema */
  }
}

/** Move a stub session onto the account that owns the proven email or phone. */
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
      `SELECT profile_picture_url, phone_e164, phone_verified_at, email, email_canonical, email_verified_at
       FROM users WHERE id = ?`,
    )
    .get(stubId) as
    | {
        profile_picture_url: string | null;
        phone_e164: string | null;
        phone_verified_at: string | null;
        email: string | null;
        email_canonical: string | null;
        email_verified_at: string | null;
      }
    | undefined;
  const target = db
    .prepare("SELECT profile_picture_url, phone_e164, email FROM users WHERE id = ?")
    .get(targetId) as {
    profile_picture_url: string | null;
    phone_e164: string | null;
    email: string | null;
  } | undefined;
  if (stub?.profile_picture_url && !target?.profile_picture_url) {
    db.prepare("UPDATE users SET profile_picture_url = ? WHERE id = ?").run(stub.profile_picture_url, targetId);
  }
  const movePhone = Boolean(stub?.phone_e164 && stub.phone_verified_at && !target?.phone_e164);
  const moveEmail = Boolean(stub?.email?.trim() && !target?.email?.trim());
  if (movePhone || moveEmail) {
    db.prepare(
      "UPDATE users SET email = NULL, email_canonical = NULL, email_verified_at = NULL, phone_e164 = NULL, phone_verified_at = NULL WHERE id = ?",
    ).run(stubId);
  }
  if (movePhone) {
    db.prepare("UPDATE users SET phone_e164 = ?, phone_verified_at = ? WHERE id = ?").run(
      stub.phone_e164,
      stub.phone_verified_at,
      targetId,
    );
  }
  if (moveEmail) {
    db.prepare(
      "UPDATE users SET email = ?, email_canonical = ?, email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?",
    ).run(stub.email, stub.email_canonical, stub.email_verified_at ?? isoNow(), targetId);
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

  reassignOrDropUserColumn(db, "saved_searches", "user_id", stubId, targetId);
  reassignOrDropUserColumn(db, "notifications", "user_id", stubId, targetId);
  reassignOrDropUserColumn(db, "conversation_participants", "user_id", stubId, targetId);
  reassignOrDropUserColumn(db, "listing_contact_events", "seeker_user_id", stubId, targetId);
  reassignOrDropUserColumn(db, "messages", "sender_user_id", stubId, targetId);

  db.prepare("DELETE FROM email_verification_challenges WHERE user_id = ?").run(stubId);
  db.prepare("DELETE FROM users WHERE id = ?").run(stubId);
}

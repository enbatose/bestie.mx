import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { isAdminEmail } from "./adminAuth.js";
import { notifyUser } from "./notificationsSchema.js";
import { isDraftPlaceholderWhatsApp, normalizeWhatsAppDigits } from "./validation.js";
import { roomReferenceCode } from "./listingReference.js";
import { isSelfServeCreator, SELF_SERVE_CREATOR_ID } from "./assistedDraftMerge.js";

export type MxAuthPhone = { e164: string; national: string };

/** Auth / profile OTP is Mexico-only (+52 + 10 national digits). */
export function parseMxAuthPhone(input: string): MxAuthPhone | null {
  const d = String(input ?? "").replace(/\D/g, "");
  let national = d;
  if (d.startsWith("521") && d.length === 13) national = d.slice(3);
  else if (d.startsWith("52") && d.length === 12) national = d.slice(2);
  if (national.length !== 10) return null;
  return { e164: `+52${national}`, national };
}

export function isRealListingPhone(stored: string | null | undefined): boolean {
  const d = normalizeWhatsAppDigits(String(stored ?? ""));
  if (!d || isDraftPlaceholderWhatsApp(d)) return false;
  return true;
}

export function listingPhoneToE164(stored: string): string | null {
  const d = normalizeWhatsAppDigits(stored);
  if (!d || isDraftPlaceholderWhatsApp(d)) return null;
  if (d.startsWith("52") && d.length === 12) return `+${d}`;
  if (d.length === 10) return `+52${d}`;
  return `+${d}`;
}

export function listingPhoneIsMxAuth(stored: string): boolean {
  return parseMxAuthPhone(stored) != null && isRealListingPhone(stored);
}

export function findUserIdByVerifiedPhone(db: DatabaseSync, phoneE164: string): string | null {
  const row = db
    .prepare(
      `SELECT id FROM users WHERE phone_e164 = ? AND phone_verified_at IS NOT NULL AND trim(phone_verified_at) != ''`,
    )
    .get(phoneE164) as { id: string } | undefined;
  return row?.id ?? null;
}

export function isPhoneVerifiedAt(value: string | null | undefined): boolean {
  return value != null && String(value).trim() !== "";
}

function isoNow(): string {
  return new Date().toISOString();
}

function primaryRoomId(db: DatabaseSync, propertyId: string): string | null {
  const row = db
    .prepare(`SELECT id FROM rooms WHERE property_id = ? ORDER BY sort_order ASC, id ASC LIMIT 1`)
    .get(propertyId) as { id: string } | undefined;
  return row?.id ?? null;
}

export function notifyAllAdmins(db: DatabaseSync, text: string, link?: string): void {
  const rows = db.prepare(`SELECT id, email FROM users WHERE email IS NOT NULL`).all() as {
    id: string;
    email: string | null;
  }[];
  for (const row of rows) {
    if (!isAdminEmail(row.email)) continue;
    notifyUser(db, { userId: row.id, text, link });
  }
}

function publisherLinkedUserId(db: DatabaseSync, publisherId: string): string | null {
  const row = db
    .prepare(`SELECT user_id FROM user_publishers WHERE publisher_id = ?`)
    .get(publisherId) as { user_id: string } | undefined;
  return row?.user_id ?? null;
}

function linkPublisher(db: DatabaseSync, userId: string, publisherId: string): void {
  const existing = publisherLinkedUserId(db, publisherId);
  if (existing && existing !== userId) return;
  db.prepare(
    `INSERT OR IGNORE INTO user_publishers (user_id, publisher_id, created_at) VALUES (?, ?, ?)`,
  ).run(userId, publisherId, isoNow());
}

export type AssignOutreachResult = { assigned: number; propertyIds: string[] };

/**
 * Attach unclaimed admin-outreach listings whose stored phone matches a newly
 * verified MX number. Skips self-serve drafts and posts already owned by another user.
 */
export function assignOutreachPostsForVerifiedPhone(
  db: DatabaseSync,
  userId: string,
  phoneE164: string,
): AssignOutreachResult {
  const mx = parseMxAuthPhone(phoneE164);
  if (!mx) return { assigned: 0, propertyIds: [] };

  const rows = db
    .prepare(
      `SELECT p.id, p.title, p.publisher_id, p.contact_whatsapp, p.created_by_admin_id, p.assisted_draft
       FROM properties p
       WHERE IFNULL(p.assisted_draft, 0) = 1
         AND IFNULL(p.created_by_admin_id, '') != ?
         AND p.contact_whatsapp IS NOT NULL`,
    )
    .all(SELF_SERVE_CREATOR_ID) as {
    id: string;
    title: string;
    publisher_id: string;
    contact_whatsapp: string;
    created_by_admin_id: string | null;
    assisted_draft: number;
  }[];

  const propertyIds: string[] = [];
  for (const row of rows) {
    const listingE164 = listingPhoneToE164(String(row.contact_whatsapp ?? ""));
    if (listingE164 !== mx.e164) continue;
    const linked = publisherLinkedUserId(db, row.publisher_id);
    if (linked && linked !== userId) continue;
    const token = db
      .prepare(
        `SELECT claimed_by_user_id FROM assisted_draft_claim_tokens WHERE property_id = ? ORDER BY created_at DESC LIMIT 1`,
      )
      .get(row.id) as { claimed_by_user_id: string | null } | undefined;
    if (token?.claimed_by_user_id && token.claimed_by_user_id !== userId) continue;

    linkPublisher(db, userId, row.publisher_id);
    db.prepare(
      `UPDATE assisted_draft_claim_tokens SET claimed_by_user_id = ?, claimed_at = ? WHERE property_id = ? AND (claimed_by_user_id IS NULL OR claimed_by_user_id = ?)`,
    ).run(userId, Date.now(), row.id, userId);
    propertyIds.push(row.id);

    const roomId = primaryRoomId(db, row.id);
    const link = roomId ? `/anuncio/${roomReferenceCode(roomId)}` : "/mis-anuncios";
    const user = db.prepare(`SELECT display_name, email FROM users WHERE id = ?`).get(userId) as
      | { display_name: string; email: string | null }
      | undefined;
    const who = user?.display_name || user?.email || userId;
    notifyAllAdmins(
      db,
      `El anuncio «${(row.title || "Sin título").slice(0, 80)}» se asignó a ${who} porque el teléfono ${mx.e164} ya estaba verificado.`,
      link,
    );
  }

  return { assigned: propertyIds.length, propertyIds };
}

export function setUserPhoneVerified(db: DatabaseSync, userId: string, phoneE164: string): void {
  db.prepare(
    `UPDATE users SET phone_e164 = NULL, phone_verified_at = NULL WHERE phone_e164 = ? AND id != ? AND (phone_verified_at IS NULL OR trim(IFNULL(phone_verified_at, '')) = '')`,
  ).run(phoneE164, userId);
  db.prepare(`UPDATE users SET phone_e164 = ?, phone_verified_at = ? WHERE id = ?`).run(
    phoneE164,
    isoNow(),
    userId,
  );
  assignOutreachPostsForVerifiedPhone(db, userId, phoneE164);
}

export type OutreachClaimGate =
  | { ok: true; skipOtp: boolean; hasDraftPhone: boolean; listingE164: string | null }
  | { ok: false; error: string; message: string; status: number };

/**
 * Who may claim/edit/publish an outreach draft.
 * MX listing phones require OTP of that number (or a matching verified profile).
 * Non-MX listing phones are not OTP’d — any signed-in user with the link may claim.
 */
export function evaluateOutreachClaimGate(
  db: DatabaseSync,
  userId: string | null,
  storedListingPhone: string | null | undefined,
  opts?: { isAdmin?: boolean },
): OutreachClaimGate {
  const hasDraftPhone = isRealListingPhone(storedListingPhone);
  if (opts?.isAdmin) {
    return { ok: true, skipOtp: true, hasDraftPhone, listingE164: listingPhoneToE164(String(storedListingPhone ?? "")) };
  }
  if (!hasDraftPhone) {
    return { ok: true, skipOtp: true, hasDraftPhone: false, listingE164: null };
  }
  const listingE164 = listingPhoneToE164(String(storedListingPhone ?? ""));
  const mx = listingE164 ? parseMxAuthPhone(listingE164) : null;
  if (!mx) {
    return { ok: true, skipOtp: true, hasDraftPhone: true, listingE164 };
  }
  if (!userId) {
    return {
      ok: false,
      error: "unauthorized",
      status: 401,
      message: "Inicia sesión o crea una cuenta para editar o publicar este anuncio.",
    };
  }
  const taken = findUserIdByVerifiedPhone(db, mx.e164);
  if (taken && taken !== userId) {
    return {
      ok: false,
      error: "phone_taken",
      status: 409,
      message:
        "Este número ya está verificado en otra cuenta. Entra con ese teléfono o correo y contraseña. No enviamos un código SMS para no abrir esa cuenta.",
    };
  }
  const me = db
    .prepare(`SELECT phone_e164, phone_verified_at FROM users WHERE id = ?`)
    .get(userId) as { phone_e164: string | null; phone_verified_at: string | null } | undefined;
  const verified = isPhoneVerifiedAt(me?.phone_verified_at) ? me?.phone_e164 : null;
  if (verified && verified === mx.e164) {
    return { ok: true, skipOtp: true, hasDraftPhone: true, listingE164: mx.e164 };
  }
  if (verified && verified !== mx.e164) {
    return {
      ok: false,
      error: "phone_mismatch",
      status: 403,
      message:
        "Tu perfil tiene otro celular verificado. Pide a un admin que cambie el número del anuncio, o cambia el teléfono de tu perfil (con correo verificado y un código SMS) para que coincida con el del borrador.",
    };
  }
  return { ok: true, skipOtp: false, hasDraftPhone: true, listingE164: mx.e164 };
}

/** Admin-created outreach draft that nobody has claimed yet. */
export function isUnclaimedAdminOutreach(db: DatabaseSync, propertyId: string): boolean {
  const prop = db
    .prepare(`SELECT assisted_draft, created_by_admin_id FROM properties WHERE id = ?`)
    .get(propertyId) as { assisted_draft: number | null; created_by_admin_id: string | null } | undefined;
  if (!prop || Number(prop.assisted_draft) !== 1) return false;
  if (isSelfServeCreator(prop.created_by_admin_id)) return false;
  const tok = db
    .prepare(
      `SELECT claimed_by_user_id FROM assisted_draft_claim_tokens WHERE property_id = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .get(propertyId) as { claimed_by_user_id: string | null } | undefined;
  return Boolean(tok) && !tok?.claimed_by_user_id;
}

export function claimAssistedDraftForUser(db: DatabaseSync, userId: string, propertyId: string): void {
  const prop = db
    .prepare(`SELECT publisher_id FROM properties WHERE id = ?`)
    .get(propertyId) as { publisher_id: string } | undefined;
  if (!prop) return;
  linkPublisher(db, userId, prop.publisher_id);
  db.prepare(
    `UPDATE assisted_draft_claim_tokens SET claimed_by_user_id = ?, claimed_at = ? WHERE property_id = ? AND (claimed_by_user_id IS NULL OR claimed_by_user_id = ?)`,
  ).run(userId, Date.now(), propertyId, userId);
}

export function createPhoneUser(
  db: DatabaseSync,
  opts: { phoneE164: string; passwordHash: string; displayName: string; profilePictureUrl?: string | null },
): string {
  const existing = db
    .prepare(
      `SELECT id FROM users WHERE phone_e164 = ? AND (phone_verified_at IS NULL OR trim(IFNULL(phone_verified_at, '')) = '')`,
    )
    .get(opts.phoneE164) as { id: string } | undefined;
  if (existing) {
    db.prepare(`UPDATE users SET phone_e164 = NULL, phone_verified_at = NULL WHERE id = ?`).run(existing.id);
  }
  const id = randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, email_canonical, phone_e164, password_hash, display_name, created_at, email_verified_at, profile_picture_url, phone_verified_at)
     VALUES (?, NULL, NULL, ?, ?, ?, ?, NULL, ?, ?)`,
  ).run(
    id,
    opts.phoneE164,
    opts.passwordHash,
    opts.displayName,
    isoNow(),
    opts.profilePictureUrl ?? null,
    isoNow(),
  );
  assignOutreachPostsForVerifiedPhone(db, id, opts.phoneE164);
  return id;
}

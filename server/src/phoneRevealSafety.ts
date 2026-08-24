import type { DatabaseSync } from "node:sqlite";
import {
  isDraftPlaceholderWhatsApp,
  normalizeWhatsAppDigits,
} from "./validation.js";

/**
 * Safety notice before revealing a publisher phone on a listing.
 * Bump when PhoneRevealSafetyModal tip/legal copy changes materially.
 */
export const PHONE_REVEAL_SAFETY_NOTICE_VERSION = "2026-08-24-v1";

export type PhoneRevealSafetyRole = "seeker" | "publisher";

export function ensurePhoneRevealSafetySchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS phone_reveal_safety_acknowledgments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      notice_version TEXT NOT NULL,
      role_at_acceptance TEXT NOT NULL,
      property_id TEXT,
      accepted_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_phone_reveal_safety_user_version
      ON phone_reveal_safety_acknowledgments(user_id, notice_version);
  `);
}

export function hasAcceptedPhoneRevealSafety(
  db: DatabaseSync,
  userId: string,
  noticeVersion: string = PHONE_REVEAL_SAFETY_NOTICE_VERSION,
): boolean {
  const row = db
    .prepare(
      `SELECT 1 AS x FROM phone_reveal_safety_acknowledgments
       WHERE user_id = ? AND notice_version = ? LIMIT 1`,
    )
    .get(userId, noticeVersion) as { x: number } | undefined;
  return Boolean(row);
}

export function recordPhoneRevealSafetyAcknowledgment(
  db: DatabaseSync,
  input: {
    id: string;
    userId: string;
    noticeVersion: string;
    role: PhoneRevealSafetyRole;
    propertyId: string | null;
    acceptedAt: string;
  },
): void {
  db.prepare(
    `INSERT INTO phone_reveal_safety_acknowledgments
      (id, user_id, notice_version, role_at_acceptance, property_id, accepted_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    input.userId,
    input.noticeVersion,
    input.role,
    input.propertyId,
    input.acceptedAt,
  );
}

/** True when the property stores a real phone and the publisher opted to show it. */
export function propertyHasPublicPhone(
  showWhatsappRaw: unknown,
  contactWhatsappRaw: unknown,
): boolean {
  const show =
    showWhatsappRaw === 1 ||
    showWhatsappRaw === true ||
    showWhatsappRaw === "1";
  if (!show) return false;
  const digits = String(contactWhatsappRaw ?? "");
  if (isDraftPlaceholderWhatsApp(digits)) return false;
  return normalizeWhatsAppDigits(digits) != null;
}

export function ownerUserIdForProperty(
  db: DatabaseSync,
  propertyId: string,
): string | null {
  const row = db
    .prepare(
      `SELECT up.user_id AS uid
       FROM properties p
       LEFT JOIN user_publishers up ON up.publisher_id = p.publisher_id
       WHERE p.id = ?`,
    )
    .get(propertyId) as { uid: string | null } | undefined;
  return row?.uid && String(row.uid).trim() ? String(row.uid) : null;
}

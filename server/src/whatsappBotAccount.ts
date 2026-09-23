import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { waOnlyPasswordPlaceholder } from "./adminAuth.js";
import {
  assignOutreachPostsForVerifiedPhone,
  createPhoneUser,
  findUserIdByVerifiedPhone,
  isPhoneVerifiedAt,
  parseMxAuthPhone,
} from "./phoneAuth.js";

export type WhatsAppBotAccount = {
  userId: string;
  publisherId: string;
  phoneE164: string;
  contactStored: string;
};

function isoNow(): string {
  return new Date().toISOString();
}

function publisherForUser(db: DatabaseSync, userId: string): string | null {
  const row = db
    .prepare(`SELECT publisher_id FROM user_publishers WHERE user_id = ? ORDER BY created_at ASC LIMIT 1`)
    .get(userId) as { publisher_id: string } | undefined;
  return row?.publisher_id ?? null;
}

function linkPublisher(db: DatabaseSync, userId: string, publisherId: string): void {
  db.prepare(
    `INSERT OR IGNORE INTO user_publishers (user_id, publisher_id, created_at) VALUES (?, ?, ?)`,
  ).run(userId, publisherId, isoNow());
}

/**
 * The inbound WhatsApp number is the Bestie account (Meta already proved the SIM).
 */
export function ensureWhatsAppBotAccount(db: DatabaseSync, fromDigits: string): WhatsAppBotAccount | null {
  const mx = parseMxAuthPhone(fromDigits);
  if (!mx) return null;

  let userId = findUserIdByVerifiedPhone(db, mx.e164);
  if (!userId) {
    const existing = db
      .prepare(`SELECT id, phone_verified_at FROM users WHERE phone_e164 = ?`)
      .get(mx.e164) as { id: string; phone_verified_at: string | null } | undefined;
    if (existing) {
      if (!isPhoneVerifiedAt(existing.phone_verified_at)) {
        db.prepare(`UPDATE users SET phone_verified_at = ? WHERE id = ?`).run(isoNow(), existing.id);
        assignOutreachPostsForVerifiedPhone(db, existing.id, mx.e164);
      }
      userId = existing.id;
    } else {
      userId = createPhoneUser(db, {
        phoneE164: mx.e164,
        passwordHash: waOnlyPasswordPlaceholder(),
        displayName: "Usuario WhatsApp",
        registrationSource: "whatsapp",
      });
    }
  }

  let publisherId = publisherForUser(db, userId);
  if (!publisherId) {
    publisherId = randomUUID();
    linkPublisher(db, userId, publisherId);
  }

  return {
    userId,
    publisherId,
    phoneE164: mx.e164,
    contactStored: `52${mx.national}`,
  };
}

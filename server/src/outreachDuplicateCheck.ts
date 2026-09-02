import type { DatabaseSync } from "node:sqlite";
import { normalizeSourceFacebookUrl } from "./facebookPostUrl.js";
import { roomReferenceCode } from "./listingReference.js";
import {
  findUserIdByVerifiedPhone,
  isPhoneVerifiedAt,
  listingPhoneToE164,
  parseMxAuthPhone,
} from "./phoneAuth.js";
import { HIDDEN_CONTACT_WHATSAPP_PLACEHOLDER } from "./validation.js";

const MATCH_LIMIT = 8;

export type OutreachDuplicateListing = {
  propertyId: string;
  title: string;
  city: string;
  status: string;
  createdAt: string | null;
  listingPath: string | null;
  assistedDraft: boolean;
  claimed: boolean;
};

export type OutreachDuplicateAccount = {
  userId: string;
  displayName: string;
  email: string | null;
  phoneVerified: boolean;
};

export type OutreachDuplicateCheck = {
  facebookMatches: OutreachDuplicateListing[];
  phoneListings: OutreachDuplicateListing[];
  phoneAccount: OutreachDuplicateAccount | null;
};

type PropertyMatchRow = {
  id: string;
  title: string;
  city: string;
  status: string;
  created_at: string | null;
  assisted_draft: number | null;
  contact_whatsapp?: string | null;
  room_id: string | null;
  claimed_by_user_id: string | null;
};

function listingPathFromRoomId(roomId: string | null): string | null {
  if (!roomId) return null;
  return `/anuncio/${roomReferenceCode(roomId)}`;
}

function mapListing(row: PropertyMatchRow): OutreachDuplicateListing {
  return {
    propertyId: row.id,
    title: String(row.title ?? "").trim() || "Sin título",
    city: String(row.city ?? "").trim(),
    status: String(row.status ?? "draft"),
    createdAt: row.created_at && String(row.created_at).trim() ? String(row.created_at) : null,
    listingPath: listingPathFromRoomId(row.room_id),
    assistedDraft: Number(row.assisted_draft) === 1,
    claimed: Boolean(row.claimed_by_user_id),
  };
}

const LISTING_SELECT = `
  SELECT
    p.id AS id,
    p.title AS title,
    p.city AS city,
    p.status AS status,
    p.created_at AS created_at,
    p.assisted_draft AS assisted_draft,
    p.contact_whatsapp AS contact_whatsapp,
    (SELECT r.id FROM rooms r WHERE r.property_id = p.id ORDER BY r.sort_order ASC, r.id ASC LIMIT 1) AS room_id,
    (SELECT t.claimed_by_user_id FROM assisted_draft_claim_tokens t WHERE t.property_id = p.id ORDER BY t.created_at DESC LIMIT 1) AS claimed_by_user_id
  FROM properties p
`;

function findByFacebook(db: DatabaseSync, sourceFacebookUrl: string): OutreachDuplicateListing[] {
  const parsed = normalizeSourceFacebookUrl(sourceFacebookUrl);
  if (!parsed) return [];
  const rows = db
    .prepare(
      `${LISTING_SELECT}
       WHERE IFNULL(p.source_facebook_key, '') = ?
          OR IFNULL(p.source_facebook_url, '') = ?
       ORDER BY p.created_at DESC
       LIMIT ?`,
    )
    .all(parsed.key, parsed.url, MATCH_LIMIT) as PropertyMatchRow[];
  return rows.map(mapListing);
}

function findListingsByPhone(db: DatabaseSync, phone: string): OutreachDuplicateListing[] {
  const targetE164 = listingPhoneToE164(phone);
  if (!targetE164) return [];
  const mx = parseMxAuthPhone(phone);
  const national = mx?.national ?? targetE164.replace(/\D/g, "").slice(-10);
  const withCc = national.length === 10 ? `52${national}` : "";

  const rows = db
    .prepare(
      `${LISTING_SELECT}
       WHERE p.contact_whatsapp IS NOT NULL
         AND trim(p.contact_whatsapp) != ''
         AND p.contact_whatsapp != ?
         AND (
           p.contact_whatsapp = ?
           OR p.contact_whatsapp = ?
           OR p.contact_whatsapp LIKE '%' || ?
         )
       ORDER BY p.created_at DESC
       LIMIT 40`,
    )
    .all(HIDDEN_CONTACT_WHATSAPP_PLACEHOLDER, withCc || targetE164.replace("+", ""), national, national) as PropertyMatchRow[];

  const matches: OutreachDuplicateListing[] = [];
  for (const row of rows) {
    const listingE164 = listingPhoneToE164(String(row.contact_whatsapp ?? ""));
    if (listingE164 !== targetE164) continue;
    matches.push(mapListing(row));
    if (matches.length >= MATCH_LIMIT) break;
  }
  return matches;
}

function findAccountByPhone(db: DatabaseSync, phone: string): OutreachDuplicateAccount | null {
  const mx = parseMxAuthPhone(phone);
  if (!mx) return null;
  const verifiedId = findUserIdByVerifiedPhone(db, mx.e164);
  const row = db
    .prepare(
      `SELECT id, display_name, email, phone_e164, phone_verified_at
       FROM users
       WHERE phone_e164 = ?
       LIMIT 1`,
    )
    .get(mx.e164) as
    | {
        id: string;
        display_name: string;
        email: string | null;
        phone_e164: string | null;
        phone_verified_at: string | null;
      }
    | undefined;
  if (!row) return null;
  return {
    userId: row.id,
    displayName: String(row.display_name ?? "").trim() || "Sin nombre",
    email: row.email,
    phoneVerified: Boolean(verifiedId) || isPhoneVerifiedAt(row.phone_verified_at),
  };
}

export function checkOutreachDuplicates(
  db: DatabaseSync,
  opts: { sourceFacebookUrl?: string; phone?: string },
): OutreachDuplicateCheck {
  const facebookMatches = opts.sourceFacebookUrl?.trim()
    ? findByFacebook(db, opts.sourceFacebookUrl)
    : [];
  const phoneListings = opts.phone?.trim() ? findListingsByPhone(db, opts.phone) : [];
  const phoneAccount = opts.phone?.trim() ? findAccountByPhone(db, opts.phone) : null;
  return { facebookMatches, phoneListings, phoneAccount };
}

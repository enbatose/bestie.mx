import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { roomReferenceCode } from "./listingReference.js";
import { notifyAdmins, notifyPublisher, userIdForPublisher } from "./notificationsSchema.js";
import { joinRowToPropertyListing, ROOM_PROPERTY_JOIN_SQL } from "./listingDto.js";
import { PUBLISHED_JOIN_WHERE } from "./publishedListingsQuery.js";
import { propertyHasPublicPhone } from "./phoneRevealSafety.js";

export const LISTING_CONTACT_EVENT_TYPES = ["reveal", "call", "whatsapp"] as const;
export type ListingContactEventType = (typeof LISTING_CONTACT_EVENT_TYPES)[number];

export function isListingContactEventType(v: unknown): v is ListingContactEventType {
  return v === "reveal" || v === "call" || v === "whatsapp";
}

export function ensureListingContactEventsSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS listing_contact_events (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL,
      property_id TEXT NOT NULL,
      seeker_user_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (seeker_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (listing_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_listing_contact_events_property_type
      ON listing_contact_events(property_id, event_type);
    CREATE INDEX IF NOT EXISTS idx_listing_contact_events_unique
      ON listing_contact_events(listing_id, seeker_user_id, event_type);
  `);
}

export type ListingContactEventCounts = {
  revealUnique: number;
  revealTotal: number;
  callUnique: number;
  callTotal: number;
  whatsappUnique: number;
  whatsappTotal: number;
};

const EMPTY_COUNTS: ListingContactEventCounts = {
  revealUnique: 0,
  revealTotal: 0,
  callUnique: 0,
  callTotal: 0,
  whatsappUnique: 0,
  whatsappTotal: 0,
};

export function emptyListingContactEventCounts(): ListingContactEventCounts {
  return { ...EMPTY_COUNTS };
}

function displayNameOrFallback(raw: unknown, fallback: string): string {
  const t = String(raw ?? "").trim();
  return t || fallback;
}

export function listingContactNotifyCopy(opts: {
  eventType: ListingContactEventType;
  seekerName: string;
  listingTitle: string;
}): string {
  const seeker = displayNameOrFallback(opts.seekerName, "un usuario de Bestie");
  const title = displayNameOrFallback(opts.listingTitle, "tu anuncio");
  if (opts.eventType === "reveal") {
    return `Un usuario, ${seeker}, consultó tu número de teléfono en la publicación ${title}.`;
  }
  if (opts.eventType === "call") {
    return `Un usuario, ${seeker}, mostró interés en llamar a tu número de teléfono publicado en el anuncio ${title}.`;
  }
  return `Un usuario, ${seeker}, abrió WhatsApp para escribirte por la publicación ${title}.`;
}

/** Operator-facing copy (bell). Distinct from the publisher “tu anuncio” voice. */
export function listingContactAdminNotifyCopy(opts: {
  eventType: ListingContactEventType | "first_message";
  seekerName: string;
  listingTitle: string;
}): string {
  const seeker = displayNameOrFallback(opts.seekerName, "un usuario de Bestie");
  const title = displayNameOrFallback(opts.listingTitle, "un anuncio");
  if (opts.eventType === "reveal") {
    return `Interés: ${seeker} consultó el teléfono de ${title}.`;
  }
  if (opts.eventType === "call") {
    return `Interés: ${seeker} quiere llamar el teléfono de ${title}.`;
  }
  if (opts.eventType === "whatsapp") {
    return `Interés: ${seeker} abrió WhatsApp por ${title}.`;
  }
  return `Interés: ${seeker} envió un primer mensaje en Bestie sobre ${title}.`;
}

export function listingInterestAdminLink(listingId: string): string {
  return `/anuncio/${roomReferenceCode(listingId)}`;
}

export function notifyAdminsOfListingInterest(
  db: DatabaseSync,
  opts: {
    seekerUserId: string;
    listingId: string;
    listingTitle: string;
    eventType: ListingContactEventType | "first_message";
  },
): void {
  const seekerName = seekerDisplayName(db, opts.seekerUserId);
  notifyAdmins(db, {
    text: listingContactAdminNotifyCopy({
      eventType: opts.eventType,
      seekerName,
      listingTitle: opts.listingTitle,
    }),
    link: listingInterestAdminLink(opts.listingId),
    excludeUserIds: [opts.seekerUserId],
  });
}

function publisherUserId(db: DatabaseSync, publisherId: string): string | null {
  return userIdForPublisher(db, publisherId);
}

function seekerDisplayName(db: DatabaseSync, userId: string): string {
  const row = db.prepare(`SELECT display_name FROM users WHERE id = ?`).get(userId) as
    | { display_name: string | null }
    | undefined;
  return displayNameOrFallback(row?.display_name, "un usuario de Bestie");
}

export function listingContactPublisherDisplayName(
  db: DatabaseSync,
  publisherId: string,
): string | null {
  const uid = publisherUserId(db, publisherId);
  if (!uid) return null;
  const row = db.prepare(`SELECT display_name FROM users WHERE id = ?`).get(uid) as
    | { display_name: string | null }
    | undefined;
  const name = String(row?.display_name ?? "").trim();
  return name || null;
}

export function recordListingContactEvent(
  db: DatabaseSync,
  opts: {
    listingId: string;
    seekerUserId: string;
    eventType: ListingContactEventType;
    /** Owner of the listing — skip log + notify when the viewer is this publisher. */
    listingPublisherId: string;
    listingTitle: string;
    viewerIsOwner: boolean;
  },
): { logged: boolean; notified: boolean } {
  if (opts.viewerIsOwner) return { logged: false, notified: false };
  if (!opts.seekerUserId || !opts.listingId) return { logged: false, notified: false };

  const room = db
    .prepare(`SELECT property_id FROM rooms WHERE id = ?`)
    .get(opts.listingId) as { property_id: string } | undefined;
  const propertyId = room?.property_id?.trim();
  if (!propertyId) return { logged: false, notified: false };

  const prior = db
    .prepare(
      `SELECT COUNT(*) AS c FROM listing_contact_events
       WHERE listing_id = ? AND seeker_user_id = ? AND event_type = ?`,
    )
    .get(opts.listingId, opts.seekerUserId, opts.eventType) as { c: number };

  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO listing_contact_events
      (id, listing_id, property_id, seeker_user_id, event_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, opts.listingId, propertyId, opts.seekerUserId, opts.eventType, now);

  notifyAdminsOfListingInterest(db, {
    seekerUserId: opts.seekerUserId,
    listingId: opts.listingId,
    listingTitle: opts.listingTitle,
    eventType: opts.eventType,
  });

  const isFirst = Number(prior?.c ?? 0) === 0;
  if (!isFirst) return { logged: true, notified: false };

  const publisherUser = publisherUserId(db, opts.listingPublisherId);
  if (!publisherUser || publisherUser === opts.seekerUserId) {
    return { logged: true, notified: false };
  }

  const text = listingContactNotifyCopy({
    eventType: opts.eventType,
    seekerName: seekerDisplayName(db, opts.seekerUserId),
    listingTitle: opts.listingTitle,
  });
  notifyPublisher(db, opts.listingPublisherId, {
    text,
    link: `/anuncio/${roomReferenceCode(opts.listingId)}`,
  });
  return { logged: true, notified: true };
}

/** Published listing with a public phone, for contact-event POSTs. */
export function publishedListingPhoneContext(
  db: DatabaseSync,
  roomId: string,
): {
  listingId: string;
  propertyId: string;
  publisherId: string;
  listingTitle: string;
  publisherDisplayName: string | null;
} | null {
  const row = db
    .prepare(`${ROOM_PROPERTY_JOIN_SQL} ${PUBLISHED_JOIN_WHERE} AND r.id = ?`)
    .get(roomId) as Record<string, unknown> | undefined;
  if (!row || !propertyHasPublicPhone(row.show_whatsapp, row.contact_whatsapp)) return null;
  const listing = joinRowToPropertyListing(row);
  const publisherId = String(row.publisher_id ?? "").trim();
  if (!publisherId) return null;
  return {
    listingId: listing.id,
    propertyId: listing.propertyId,
    publisherId,
    listingTitle: listing.title,
    publisherDisplayName: listingContactPublisherDisplayName(db, publisherId),
  };
}

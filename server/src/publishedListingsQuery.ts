import type { DatabaseSync } from "node:sqlite";
import { joinRowToPropertyListing, ROOM_PROPERTY_JOIN_SQL } from "./listingDto.js";
import { redactHiddenPublicPricing } from "./listingPricing.js";
import type { PropertyListing } from "./types.js";

/** Room is searchable / contactable / sitemap-listed only when both statuses are published and not occupied. */
export const PUBLISHED_JOIN_WHERE = ` WHERE r.status = 'published' AND p.status = 'published' AND IFNULL(r.occupancy_status, 'available') != 'occupied' `;

/**
 * Direct `/anuncio/:id` (and OG for that URL) may load paused listings.
 * Archived, draft, pending-review, and occupied stay hidden even with the URL.
 */
export const DIRECT_LINK_JOIN_WHERE = ` WHERE r.status IN ('published', 'paused') AND p.status IN ('published', 'paused') AND IFNULL(r.occupancy_status, 'available') != 'occupied' `;

export function isListingJoinRowArchived(row: Record<string, unknown> | undefined): boolean {
  if (!row) return false;
  return String(row.status ?? "") === "archived" || String(row.property_status ?? "") === "archived";
}

function listingForPublic(l: PropertyListing): PropertyListing {
  const { publisherId: _p, viewsCount: _v, inquiryCount: _i, ...rest } = l;
  return redactHiddenPublicPricing(rest);
}

/** True when a room listing is publicly visible (same rules as search / OG / sitemap). */
export function isRoomListingPubliclyVisible(db: DatabaseSync, roomId: string): boolean {
  const row = db
    .prepare(`${ROOM_PROPERTY_JOIN_SQL} ${PUBLISHED_JOIN_WHERE} AND r.id = ?`)
    .get(roomId) as Record<string, unknown> | undefined;
  return Boolean(row);
}

/** All published room rows for public search (Messenger, etc.). */
export function fetchPublishedListings(db: DatabaseSync): PropertyListing[] {
  const sql = `${ROOM_PROPERTY_JOIN_SQL} ${PUBLISHED_JOIN_WHERE} ORDER BY CASE WHEN IFNULL(p.hide_pricing, 0) != 0 THEN 1 ELSE 0 END, r.rent_mxn ASC, r.id ASC`;
  const rows = db.prepare(sql).all() as Record<string, unknown>[];
  return rows.map(joinRowToPropertyListing).map(listingForPublic);
}

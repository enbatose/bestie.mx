import type { DatabaseSync } from "node:sqlite";
import { joinRowToPropertyListing, ROOM_PROPERTY_JOIN_SQL } from "./listingDto.js";
import type { PropertyListing } from "./types.js";

const PUBLISHED_JOIN_WHERE = ` WHERE r.status = 'published' AND p.status = 'published' AND IFNULL(r.occupancy_status, 'available') != 'occupied' `;

function listingForPublic(l: PropertyListing): PropertyListing {
  const { publisherId: _p, viewsCount: _v, inquiryCount: _i, ...rest } = l;
  return rest;
}

/** All published room rows for public search (Messenger, etc.). */
export function fetchPublishedListings(db: DatabaseSync): PropertyListing[] {
  const sql = `${ROOM_PROPERTY_JOIN_SQL} ${PUBLISHED_JOIN_WHERE} ORDER BY r.rent_mxn ASC, r.id ASC`;
  const rows = db.prepare(sql).all() as Record<string, unknown>[];
  return rows.map(joinRowToPropertyListing).map(listingForPublic);
}

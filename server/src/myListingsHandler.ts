import type { DatabaseSync } from "node:sqlite";
import type { Request, Response } from "express";
import { joinRowToPropertyListing, ROOM_PROPERTY_JOIN_SQL } from "./listingDto.js";
import { publisherIdsForOwnerSession } from "./propertyRequestAccess.js";
import { readAuthUserId } from "./jwtSession.js";

/** Published and paused share rank 0 so pausing does not sink items in Mis anuncios. */
const MY_LISTINGS_ORDER = `ORDER BY CASE p.status WHEN 'published' THEN 0 WHEN 'paused' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, p.title ASC, r.sort_order ASC, r.rent_mxn ASC, r.id ASC`;

export function myListingsHandler(db: DatabaseSync) {
  return (req: Request, res: Response): void => {
    const publisherIds = publisherIdsForOwnerSession(db, req);
    if (publisherIds.length === 0) {
      const loggedIn = readAuthUserId(req) != null;
      if (loggedIn) {
        res.json([]);
        return;
      }
      res.status(401).json({
        error: "publisher_session_required",
        message: "Publish at least once from this browser to see your listings here.",
      });
      return;
    }

    const placeholders = publisherIds.map(() => "?").join(", ");
    // Inject owner-only metrics before FROM (views_count + inquiry threads).
    const sql = `${ROOM_PROPERTY_JOIN_SQL.replace(
      "FROM rooms r",
      `,
  COALESCE(r.views_count, 0) AS views_count,
  (
    SELECT COUNT(*) FROM conversations c
    WHERE c.listing_room_id = r.id
      AND COALESCE(c.kind, 'listing') = 'listing'
  ) AS inquiry_count
FROM rooms r`,
    )} WHERE p.publisher_id IN (${placeholders}) ${MY_LISTINGS_ORDER}`;
    const rows = db.prepare(sql).all(...publisherIds) as Record<string, unknown>[];

    res.json(rows.map(joinRowToPropertyListing));
  };
}

import type { DatabaseSync } from "node:sqlite";
import type { Request, Response } from "express";
import { joinRowToPropertyListing, ROOM_PROPERTY_JOIN_SQL } from "./listingDto.js";
import { publisherIdsForOwnerSession } from "./propertyRequestAccess.js";
import { readAuthUserId } from "./jwtSession.js";

const MY_LISTINGS_ORDER = `ORDER BY CASE p.status WHEN 'published' THEN 0 WHEN 'paused' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END, p.title ASC, r.sort_order ASC, r.rent_mxn ASC, r.id ASC`;

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
    const rows = db
      .prepare(
        `${ROOM_PROPERTY_JOIN_SQL} WHERE p.publisher_id IN (${placeholders}) ${MY_LISTINGS_ORDER}`,
      )
      .all(...publisherIds) as Record<string, unknown>[];

    res.json(rows.map(joinRowToPropertyListing));
  };
}

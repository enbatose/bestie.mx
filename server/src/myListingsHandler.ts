import type { DatabaseSync } from "node:sqlite";
import type { Request, Response } from "express";
import { joinRowToPropertyListing, ROOM_PROPERTY_JOIN_SQL } from "./listingDto.js";
import { readPublisherIdFromRequest } from "./session.js";

export function myListingsHandler(db: DatabaseSync) {
  return (req: Request, res: Response): void => {
    const publisherId = readPublisherIdFromRequest(req);
    if (!publisherId) {
      res.status(401).json({
        error: "publisher_session_required",
        message: "Publish at least once from this browser to see your listings here.",
      });
      return;
    }

    const rows = db
      .prepare(
        `${ROOM_PROPERTY_JOIN_SQL} WHERE p.publisher_id = ? ORDER BY CASE p.status WHEN 'published' THEN 0 WHEN 'paused' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END, p.title ASC, r.sort_order ASC, r.rent_mxn ASC, r.id ASC`,
      )
      .all(publisherId) as Record<string, unknown>[];

    res.json(rows.map(joinRowToPropertyListing));
  };
}

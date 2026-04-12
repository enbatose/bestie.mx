import type { DatabaseSync } from "node:sqlite";
import type { Request, Response } from "express";
import { rowToListing } from "./db.js";
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
        "SELECT * FROM listings WHERE publisher_id = ? ORDER BY rent_mxn ASC, id ASC",
      )
      .all(publisherId) as Record<string, unknown>[];

    res.json(rows.map(rowToListing));
  };
}

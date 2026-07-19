import express, { type Request, type Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import { readAuthUserId } from "./jwtSession.js";
import type { NotificationRow } from "./notificationsSchema.js";

function jsonMw() {
  return express.json({ limit: "256kb" });
}

function isoNow(): string {
  return new Date().toISOString();
}

function toApi(row: NotificationRow) {
  return {
    id: row.id,
    text: row.text,
    link: row.link,
    createdAt: row.created_at,
    readAt: row.read_at,
    isRead: row.read_at != null,
  };
}

export function notificationsRouter(db: DatabaseSync) {
  const r = express.Router();

  r.get("/", (req: Request, res: Response) => {
    const me = readAuthUserId(req);
    if (!me) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const rows = db
      .prepare(
        `SELECT id, user_id, text, link, created_at, read_at
         FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
      )
      .all(me) as NotificationRow[];
    res.json({ notifications: rows.map(toApi) });
  });

  r.get("/unread-count", (req: Request, res: Response) => {
    const me = readAuthUserId(req);
    if (!me) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const n = (
      db
        .prepare(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL`)
        .get(me) as { n: number }
    ).n;
    res.json({ count: n });
  });

  r.post("/read-all", jsonMw(), (req: Request, res: Response) => {
    const me = readAuthUserId(req);
    if (!me) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const result = db
      .prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`)
      .run(isoNow(), me);
    res.json({ ok: true, updated: result.changes });
  });

  r.post("/:id/read", jsonMw(), (req: Request, res: Response) => {
    const me = readAuthUserId(req);
    if (!me) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const id = req.params.id;
    if (!id || id.length > 120) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const result = db
      .prepare(`UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL`)
      .run(isoNow(), id, me);
    res.json({ ok: true, updated: result.changes > 0 });
  });

  return r;
}

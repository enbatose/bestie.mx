import type { DatabaseSync } from "node:sqlite";
import express, { type Request, type Response } from "express";
import { readPublisherIdFromRequest, getOrCreatePublisherId } from "./session.js";

export function analyticsRouter(db: DatabaseSync) {
  const r = express.Router();

  r.post("/heartbeat", (req: Request, res: Response) => {
    const pub = readPublisherIdFromRequest(req) ?? getOrCreatePublisherId(req, res);
    const day = new Date().toISOString().slice(0, 10);
    db.prepare(`INSERT OR IGNORE INTO dau_publishers (day, publisher_id) VALUES (?, ?)`).run(day, pub);
    const c = (db.prepare(`SELECT COUNT(*) as c FROM dau_publishers WHERE day = ?`).get(day) as { c: number }).c;
    db.prepare(
      `INSERT INTO analytics_daily (day, metric, dimension, value) VALUES (?, 'dau_publishers', '', ?)
       ON CONFLICT(day, metric, dimension) DO UPDATE SET value = excluded.value`,
    ).run(day, c);
    res.json({ ok: true });
  });

  r.get("/featured-cities", (_req: Request, res: Response) => {
    const row = db.prepare(`SELECT value_json FROM site_settings WHERE key = 'featured_cities'`).get() as
      | { value_json: string }
      | undefined;
    let cities: string[] = [];
    if (row) {
      try {
        cities = JSON.parse(row.value_json) as string[];
        if (!Array.isArray(cities)) cities = [];
      } catch {
        cities = [];
      }
    }
    res.json({ cities });
  });

  r.get("/public-summary", (_req: Request, res: Response) => {
    const published = (db
      .prepare(`SELECT COUNT(*) as c FROM properties WHERE status = 'published'`)
      .get() as { c: number }).c;
    const day = new Date().toISOString().slice(0, 10);
    const dauRow = db
      .prepare(`SELECT value FROM analytics_daily WHERE day = ? AND metric = 'dau_publishers' AND dimension = ''`)
      .get(day) as { value: number } | undefined;
    res.json({
      publishedPropertyCount: published,
      dauPublishersApprox: dauRow?.value ?? 0,
      day,
    });
  });

  return r;
}

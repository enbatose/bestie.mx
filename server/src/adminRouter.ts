import type { DatabaseSync } from "node:sqlite";
import express, { type NextFunction, type Request, type Response } from "express";
import { readAuthUserId } from "./jwtSession.js";
import { isAdminUser } from "./adminAuth.js";
import { isSafePropertyId } from "./validation.js";

function jsonMw() {
  return express.json({ limit: "256kb" });
}

export function adminRouter(db: DatabaseSync) {
  const r = express.Router();

  function requireAdmin(req: Request, res: Response, next: NextFunction): void {
    const uid = readAuthUserId(req);
    if (!uid) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (!isAdminUser(db, uid)) {
      res.status(403).json({ error: "forbidden", message: "Admin only (set ADMIN_EMAILS)." });
      return;
    }
    next();
  }

  r.use(requireAdmin);

  r.get("/users", (req: Request, res: Response) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const rows = db
      .prepare(
        `SELECT id, email, phone_e164, display_name, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as Record<string, unknown>[];
    const redacted = rows.map((u) => ({
      id: u.id,
      email: u.email,
      phoneLast4:
        typeof u.phone_e164 === "string" && u.phone_e164.length >= 4
          ? u.phone_e164.slice(-4)
          : null,
      displayName: u.display_name,
      createdAt: u.created_at,
    }));
    const total = (db.prepare(`SELECT COUNT(*) as c FROM users`).get() as { c: number }).c;
    res.json({ users: redacted, total, limit, offset });
  });

  r.patch("/properties/:id/status", jsonMw(), (req: Request, res: Response) => {
    const id = req.params.id;
    if (!isSafePropertyId(id)) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const st = (req.body as { status?: unknown }).status;
    if (st !== "published" && st !== "paused" && st !== "archived" && st !== "draft") {
      res.status(400).json({ error: "invalid_status" });
      return;
    }
    const r0 = db.prepare(`UPDATE properties SET status = ? WHERE id = ?`).run(st, id);
    if (r0.changes === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    db.prepare(`UPDATE rooms SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE property_id = ?`).run(st, id);
    res.json({ ok: true, propertyId: id, status: st });
  });

  r.get("/settings/featured-cities", (_req: Request, res: Response) => {
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

  r.put("/settings/featured-cities", jsonMw(), (req: Request, res: Response) => {
    const body = req.body as { cities?: unknown };
    if (!Array.isArray(body.cities)) {
      res.status(400).json({ error: "cities_array_required" });
      return;
    }
    const cities = body.cities
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
    db.prepare(
      `INSERT INTO site_settings (key, value_json) VALUES ('featured_cities', ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
    ).run(JSON.stringify(cities));
    res.json({ ok: true, cities });
  });

  r.get("/analytics/summary", (_req: Request, res: Response) => {
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

  /** Explicitly forbidden: never add an impersonation route. */
  r.all("/impersonate", (_req: Request, res: Response) => {
    res.status(410).json({ error: "impersonation_disabled" });
  });

  return r;
}

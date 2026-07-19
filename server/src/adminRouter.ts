import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import express, { type NextFunction, type Request, type Response } from "express";
import { readAuthUserId } from "./jwtSession.js";
import { isAdminUser } from "./adminAuth.js";
import { SUPPORT_BOT_USER_ID } from "./messagingSchema.js";
import { createSlidingWindowLimiter } from "./rateLimit.js";
import { clampMessageAttachments, clampStr, isSafePropertyId, type MessageAttachment } from "./validation.js";
import { buildStreetViewAnalyticsResponse } from "./streetViewAnalytics.js";

function jsonMw() {
  return express.json({ limit: "256kb" });
}

const supportReplyLimiter = createSlidingWindowLimiter({ windowMs: 60_000, max: 40 });

function isoNow(): string {
  return new Date().toISOString();
}

function parseAttachmentsJson(raw: unknown): MessageAttachment[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MessageAttachment[]) : [];
  } catch {
    return [];
  }
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

  r.get("/analytics/street-view", (req: Request, res: Response) => {
    const body = buildStreetViewAnalyticsResponse(db, req.query.month);
    if (!body) {
      res.status(400).json({ error: "invalid_month" });
      return;
    }
    res.json(body);
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

  // --- Soporte al Cliente: shared admin inbox for all support conversations. ---

  r.get("/support/conversations", (_req: Request, res: Response) => {
    const rows = db
      .prepare(
        `SELECT c.id, c.context_title, c.updated_at,
                customer.id AS customer_user_id,
                customer.display_name AS customer_display_name,
                customer.email AS customer_email,
                (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_preview,
                (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_user_id != ? AND m.read_at IS NULL) AS unread_count
         FROM conversations c
         JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id != ?
         JOIN users customer ON customer.id = cp.user_id
         WHERE c.kind = 'support'
         ORDER BY c.updated_at DESC`,
      )
      .all(SUPPORT_BOT_USER_ID, SUPPORT_BOT_USER_ID) as Record<string, unknown>[];
    res.json({
      conversations: rows.map((row) => ({
        id: row.id,
        subject: row.context_title,
        updatedAt: row.updated_at,
        customerUserId: row.customer_user_id,
        customerDisplayName: row.customer_display_name,
        customerEmail: row.customer_email,
        lastPreview: row.last_preview ?? "",
        unreadCount: Number(row.unread_count) || 0,
      })),
    });
  });

  function assertSupportConversation(id: string): boolean {
    const row = db.prepare(`SELECT kind FROM conversations WHERE id = ?`).get(id) as
      | { kind: string }
      | undefined;
    return Boolean(row && row.kind === "support");
  }

  r.get("/support/conversations/:id/messages", (req: Request, res: Response) => {
    const id = req.params.id;
    if (!id || id.length > 120 || !assertSupportConversation(id)) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    db.prepare(
      `UPDATE messages SET read_at = ? WHERE conversation_id = ? AND sender_user_id != ? AND read_at IS NULL`,
    ).run(isoNow(), id, SUPPORT_BOT_USER_ID);
    const conv = db.prepare(`SELECT context_title FROM conversations WHERE id = ?`).get(id) as {
      context_title: string;
    };
    const customer = db
      .prepare(
        `SELECT u.id, u.display_name, u.email
         FROM conversation_participants cp
         JOIN users u ON u.id = cp.user_id
         WHERE cp.conversation_id = ? AND cp.user_id != ?`,
      )
      .get(id, SUPPORT_BOT_USER_ID) as { id: string; display_name: string; email: string | null } | undefined;
    const rows = db
      .prepare(
        `SELECT m.id, m.sender_user_id, u.display_name AS sender_display_name,
                m.body, m.created_at, m.attachments_json
         FROM messages m
         JOIN users u ON u.id = m.sender_user_id
         WHERE m.conversation_id = ? ORDER BY m.created_at ASC`,
      )
      .all(id) as Record<string, unknown>[];
    res.json({
      subject: conv.context_title,
      customer: customer
        ? { id: customer.id, displayName: customer.display_name, email: customer.email }
        : null,
      messages: rows.map((m) => ({
        id: m.id,
        senderUserId: m.sender_user_id,
        senderDisplayName: m.sender_display_name,
        senderIsCustomer: m.sender_user_id === customer?.id,
        body: m.body,
        createdAt: m.created_at,
        attachments: parseAttachmentsJson(m.attachments_json),
      })),
    });
  });

  r.post("/support/conversations/:id/messages", jsonMw(), (req: Request, res: Response) => {
    const adminId = readAuthUserId(req);
    if (!adminId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const id = req.params.id;
    if (!id || id.length > 120 || !assertSupportConversation(id)) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const lim = supportReplyLimiter(req.ip ?? "ip");
    if (!lim.ok) {
      res.status(429).json({ error: "rate_limited", retryAfterMs: lim.retryAfterMs });
      return;
    }
    const bodyRaw = (req.body as { body?: unknown }).body;
    const body = clampStr(typeof bodyRaw === "string" ? bodyRaw : "", 4000);
    const attachments = clampMessageAttachments((req.body as { attachments?: unknown }).attachments);
    if (!body && attachments.length === 0) {
      res.status(400).json({ error: "empty_body" });
      return;
    }
    const mid = randomUUID();
    const now = isoNow();
    db.prepare(
      `INSERT INTO messages (id, conversation_id, sender_user_id, body, created_at, read_at, attachments_json)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    ).run(mid, id, adminId, body, now, attachments.length > 0 ? JSON.stringify(attachments) : null);
    db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now, id);
    res.status(201).json({ id: mid, createdAt: now });
  });

  /** Explicitly forbidden: never add an impersonation route. */
  r.all("/impersonate", (_req: Request, res: Response) => {
    res.status(410).json({ error: "impersonation_disabled" });
  });

  return r;
}

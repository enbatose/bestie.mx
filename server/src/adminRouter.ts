import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import express, { type NextFunction, type Request, type Response } from "express";
import { readAuthUserId } from "./jwtSession.js";
import { isAdminUser } from "./adminAuth.js";
import {
  FEEDBACK_BOT_USER_ID,
  SUPPORT_BOT_USER_ID,
  isSystemMessagingBot,
  normalizeConversationKind,
} from "./messagingSchema.js";
import { createSlidingWindowLimiter } from "./rateLimit.js";
import { clampMessageAttachments, clampStr, type MessageAttachment } from "./validation.js";
import { resolveAdminPropertyIdFromParam } from "./resolveListingRouteId.js";
import { buildStreetViewAnalyticsResponse } from "./streetViewAnalytics.js";
import { buildImageUploadAnalytics } from "./imageUploadAnalytics.js";
import { buildUsageAnalyticsResponse } from "./usageAnalytics.js";
import { listAdminPosts } from "./adminPosts.js";
import { isUserEmailVerified, userAccountStatus } from "./emailVerification.js";

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

  r.get("/health", (req: Request, res: Response) => {
    const diagnostics = req.app.locals.healthDiagnostics;
    if (typeof diagnostics === "function") {
      res.json(diagnostics());
      return;
    }
    res.json({ ok: true, service: "bestie-mx-api" });
  });

  r.get("/users", (req: Request, res: Response) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const rows = db
      .prepare(
        `SELECT id, email, phone_e164, display_name, created_at, email_verified_at
         FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as Record<string, unknown>[];
    const redacted = rows.map((u) => {
      const email = typeof u.email === "string" ? u.email : null;
      const emailVerifiedAt =
        typeof u.email_verified_at === "string" ? u.email_verified_at : null;
      const emailVerified = isUserEmailVerified(emailVerifiedAt);
      return {
        id: u.id,
        email,
        phoneLast4:
          typeof u.phone_e164 === "string" && u.phone_e164.length >= 4
            ? u.phone_e164.slice(-4)
            : null,
        displayName: u.display_name,
        createdAt: u.created_at,
        emailVerified,
        accountStatus: userAccountStatus(email, emailVerifiedAt),
      };
    });
    const total = (db.prepare(`SELECT COUNT(*) as c FROM users`).get() as { c: number }).c;
    res.json({ users: redacted, total, limit, offset });
  });

  r.patch("/properties/:id/status", jsonMw(), (req: Request, res: Response) => {
    const rawId = String(req.params.id ?? "").trim();
    const propertyId = resolveAdminPropertyIdFromParam(db, rawId);
    if (!propertyId) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const st = (req.body as { status?: unknown }).status;
    if (st !== "published" && st !== "paused" && st !== "archived" && st !== "draft") {
      res.status(400).json({ error: "invalid_status" });
      return;
    }
    const cur = db.prepare(`SELECT status, published_at FROM properties WHERE id = ?`).get(propertyId) as
      | { status: string; published_at: string | null }
      | undefined;
    if (!cur) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (st === "published" && (cur.published_at == null || String(cur.published_at).trim() === "")) {
      db.prepare(`UPDATE properties SET status = ?, published_at = ? WHERE id = ?`).run(
        st,
        new Date().toISOString(),
        propertyId,
      );
    } else {
      db.prepare(`UPDATE properties SET status = ? WHERE id = ?`).run(st, propertyId);
    }
    db.prepare(`UPDATE rooms SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE property_id = ?`).run(
      st,
      propertyId,
    );
    res.json({ ok: true, propertyId, status: st });
  });

  r.get("/posts", (req: Request, res: Response) => {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
    const offset = req.query.offset != null ? Number(req.query.offset) : undefined;
    res.json(listAdminPosts(db, { q, status, limit, offset }));
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

  r.get("/analytics/usage", async (req: Request, res: Response) => {
    const body = await buildUsageAnalyticsResponse(db, req.query.month);
    if (!body) {
      res.status(400).json({ error: "invalid_month" });
      return;
    }
    res.json(body);
  });

  r.get("/analytics/image-uploads", (req: Request, res: Response) => {
    const hours = Number(req.query.hours);
    const limit = Number(req.query.limit);
    const failuresOnly = req.query.failuresOnly === "1" || req.query.failuresOnly === "true";
    res.json(
      buildImageUploadAnalytics(db, {
        hours: Number.isFinite(hours) ? hours : undefined,
        limit: Number.isFinite(limit) ? limit : undefined,
        failuresOnly,
      }),
    );
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

  // --- Soporte / Feedback: shared admin inbox for support + feedback conversations. ---

  r.get("/support/conversations", (req: Request, res: Response) => {
    const rawQ = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
    const like =
      rawQ.length > 0
        ? `%${rawQ.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`
        : null;
    const kindFilterRaw = typeof req.query.kind === "string" ? req.query.kind.trim().toLowerCase() : "all";
    const kindFilter =
      kindFilterRaw === "support" || kindFilterRaw === "feedback" ? kindFilterRaw : "all";
    const kindSql =
      kindFilter === "all" ? `c.kind IN ('support', 'feedback')` : `c.kind = '${kindFilter}'`;
    const rows = (
      like
        ? db
            .prepare(
              `SELECT c.id, c.context_title, c.kind, c.updated_at,
                      customer.id AS customer_user_id,
                      customer.display_name AS customer_display_name,
                      customer.email AS customer_email,
                      (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_preview,
                      (SELECT COUNT(*) FROM messages m
                        WHERE m.conversation_id = c.id
                          AND m.sender_user_id NOT IN (?, ?)
                          AND m.read_at IS NULL) AS unread_count
               FROM conversations c
               JOIN conversation_participants cp ON cp.conversation_id = c.id
                 AND cp.user_id NOT IN (?, ?)
               JOIN users customer ON customer.id = cp.user_id
               WHERE ${kindSql}
                 AND (
                   c.context_title LIKE ? ESCAPE '\\'
                   OR customer.display_name LIKE ? ESCAPE '\\'
                   OR IFNULL(customer.email, '') LIKE ? ESCAPE '\\'
                   OR EXISTS (
                        SELECT 1 FROM messages m
                        WHERE m.conversation_id = c.id AND m.body LIKE ? ESCAPE '\\'
                      )
                 )
               ORDER BY c.updated_at DESC`,
            )
            .all(
              SUPPORT_BOT_USER_ID,
              FEEDBACK_BOT_USER_ID,
              SUPPORT_BOT_USER_ID,
              FEEDBACK_BOT_USER_ID,
              like,
              like,
              like,
              like,
            )
        : db
            .prepare(
              `SELECT c.id, c.context_title, c.kind, c.updated_at,
                      customer.id AS customer_user_id,
                      customer.display_name AS customer_display_name,
                      customer.email AS customer_email,
                      (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_preview,
                      (SELECT COUNT(*) FROM messages m
                        WHERE m.conversation_id = c.id
                          AND m.sender_user_id NOT IN (?, ?)
                          AND m.read_at IS NULL) AS unread_count
               FROM conversations c
               JOIN conversation_participants cp ON cp.conversation_id = c.id
                 AND cp.user_id NOT IN (?, ?)
               JOIN users customer ON customer.id = cp.user_id
               WHERE ${kindSql}
               ORDER BY c.updated_at DESC`,
            )
            .all(SUPPORT_BOT_USER_ID, FEEDBACK_BOT_USER_ID, SUPPORT_BOT_USER_ID, FEEDBACK_BOT_USER_ID)
    ) as Record<string, unknown>[];
    res.json({
      conversations: rows.map((row) => ({
        id: row.id,
        subject: row.context_title,
        kind: normalizeConversationKind(typeof row.kind === "string" ? row.kind : null),
        updatedAt: row.updated_at,
        customerUserId: row.customer_user_id,
        customerDisplayName: row.customer_display_name,
        customerEmail: row.customer_email,
        lastPreview: row.last_preview ?? "",
        unreadCount: Number(row.unread_count) || 0,
      })),
    });
  });

  function assertAdminInboxConversation(id: string): "support" | "feedback" | null {
    const row = db.prepare(`SELECT kind FROM conversations WHERE id = ?`).get(id) as
      | { kind: string }
      | undefined;
    if (!row) return null;
    const kind = normalizeConversationKind(row.kind);
    return kind === "support" || kind === "feedback" ? kind : null;
  }

  r.get("/support/conversations/:id/messages", (req: Request, res: Response) => {
    const id = req.params.id;
    const kind = id && id.length <= 120 ? assertAdminInboxConversation(id) : null;
    if (!kind) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const conv = db.prepare(`SELECT context_title FROM conversations WHERE id = ?`).get(id) as {
      context_title: string;
    };
    const customer = db
      .prepare(
        `SELECT u.id, u.display_name, u.email
         FROM conversation_participants cp
         JOIN users u ON u.id = cp.user_id
         WHERE cp.conversation_id = ? AND cp.user_id NOT IN (?, ?)`,
      )
      .get(id, SUPPORT_BOT_USER_ID, FEEDBACK_BOT_USER_ID) as
      | { id: string; display_name: string; email: string | null }
      | undefined;
    // Mark only the customer's inbound messages as read for the admin inbox.
    if (customer?.id) {
      db.prepare(
        `UPDATE messages SET read_at = ? WHERE conversation_id = ? AND sender_user_id = ? AND read_at IS NULL`,
      ).run(isoNow(), id, customer.id);
    }
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
      kind,
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
    if (isSystemMessagingBot(adminId)) {
      res.status(400).json({ error: "invalid_sender" });
      return;
    }
    const id = req.params.id;
    if (!id || id.length > 120 || !assertAdminInboxConversation(id)) {
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

import type { DatabaseSync } from "node:sqlite";
import express, { type Request, type Response } from "express";
import { readAuthUserId } from "./jwtSession.js";
import { createSlidingWindowLimiter } from "./rateLimit.js";
import { clampStr } from "./validation.js";
import { resolvePropertyIdFromRouteParam, resolveRoomIdFromRouteParam } from "./resolveListingRouteId.js";
import { normalizePostReportCategories, normalizeChatReportCategories } from "./reportCategories.js";
import {
  createOrAppendChatReport,
  createOrAppendPostReport,
  joinPublisherToReportThread,
  findReportThreadForPost,
} from "./listingReports.js";

const reportLimiterIp = createSlidingWindowLimiter({ windowMs: 60_000, max: 8 });
const reportLimiterHour = createSlidingWindowLimiter({ windowMs: 3_600_000, max: 30 });

function jsonMw() {
  return express.json({ limit: "64kb" });
}

function validateReportInput(categories: unknown, detailText: unknown): {
  ok: true;
  categories: ReturnType<typeof normalizePostReportCategories>;
  detail: string | null;
} | { ok: false; error: string } {
  const cats = normalizePostReportCategories(categories);
  const detail = typeof detailText === "string" ? clampStr(detailText, 500).trim() : "";
  if (cats.length === 0 && !detail) {
    return { ok: false, error: "category_or_detail_required" };
  }
  return { ok: true, categories: cats, detail: detail || null };
}

function validateChatReportInput(categories: unknown, detailText: unknown): {
  ok: true;
  categories: ReturnType<typeof normalizeChatReportCategories>;
  detail: string | null;
} | { ok: false; error: string } {
  const cats = normalizeChatReportCategories(categories);
  const detail = typeof detailText === "string" ? clampStr(detailText, 500).trim() : "";
  if (cats.length === 0 && !detail) {
    return { ok: false, error: "category_or_detail_required" };
  }
  return { ok: true, categories: cats, detail: detail || null };
}

function rateLimitReport(req: Request, res: Response): boolean {
  const ip = req.ip ?? "ip";
  const min = reportLimiterIp(ip);
  if (!min.ok) {
    res.status(429).set("Retry-After", String(Math.ceil(min.retryAfterMs / 1000))).json({ error: "rate_limited" });
    return false;
  }
  const hour = reportLimiterHour(`hour:${ip}`);
  if (!hour.ok) {
    res.status(429).set("Retry-After", String(Math.ceil(hour.retryAfterMs / 1000))).json({ error: "rate_limited" });
    return false;
  }
  return true;
}

export function reportsRouter(db: DatabaseSync) {
  const r = express.Router();

  r.post("/listings/:id", jsonMw(), (req: Request, res: Response) => {
    if (!rateLimitReport(req, res)) return;
    const raw = String(req.params.id ?? "").trim();
    const roomId = resolveRoomIdFromRouteParam(db, raw);
    if (!roomId) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const room = db
      .prepare(`SELECT r.id, r.property_id FROM rooms r WHERE r.id = ?`)
      .get(roomId) as { id: string; property_id: string } | undefined;
    if (!room) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const body = req.body as { categories?: unknown; detailText?: unknown; photoUrl?: unknown; photoIndex?: unknown };
    const validated = validateReportInput(body.categories, body.detailText);
    if (!validated.ok) {
      res.status(400).json({ error: validated.error });
      return;
    }
    const reporterUserId = readAuthUserId(req);
    const photoUrl = typeof body.photoUrl === "string" ? clampStr(body.photoUrl, 500) : null;
    const photoIndex =
      typeof body.photoIndex === "number" && Number.isFinite(body.photoIndex) ? Math.floor(body.photoIndex) : null;

    const result = createOrAppendPostReport(db, {
      reporterUserId,
      targetType: "room",
      roomId: room.id,
      propertyId: room.property_id,
      categories: validated.categories,
      detailText: validated.detail,
      photoUrl: photoUrl || null,
      photoIndex,
    });
    res.json({ ok: true, ...result });
  });

  r.post("/properties/:id", jsonMw(), (req: Request, res: Response) => {
    if (!rateLimitReport(req, res)) return;
    const raw = String(req.params.id ?? "").trim();
    const propertyId = resolvePropertyIdFromRouteParam(db, raw);
    if (!propertyId) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const body = req.body as { categories?: unknown; detailText?: unknown; photoUrl?: unknown; photoIndex?: unknown };
    const validated = validateReportInput(body.categories, body.detailText);
    if (!validated.ok) {
      res.status(400).json({ error: validated.error });
      return;
    }
    const reporterUserId = readAuthUserId(req);
    const photoUrl = typeof body.photoUrl === "string" ? clampStr(body.photoUrl, 500) : null;
    const photoIndex =
      typeof body.photoIndex === "number" && Number.isFinite(body.photoIndex) ? Math.floor(body.photoIndex) : null;

    const result = createOrAppendPostReport(db, {
      reporterUserId,
      targetType: "property",
      propertyId,
      categories: validated.categories,
      detailText: validated.detail,
      photoUrl: photoUrl || null,
      photoIndex,
    });
    res.json({ ok: true, ...result });
  });

  r.post("/conversations/:id", jsonMw(), (req: Request, res: Response) => {
    const uid = readAuthUserId(req);
    if (!uid) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (!rateLimitReport(req, res)) return;
    const conversationId = String(req.params.id ?? "").trim();
    const member = db
      .prepare(`SELECT 1 AS x FROM conversation_participants WHERE conversation_id = ? AND user_id = ?`)
      .get(conversationId, uid) as { x: number } | undefined;
    if (!member) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const conv = db.prepare(`SELECT kind FROM conversations WHERE id = ?`).get(conversationId) as
      | { kind: string }
      | undefined;
    if (!conv || conv.kind !== "listing") {
      res.status(400).json({ error: "not_listing_chat" });
      return;
    }
    const body = req.body as { categories?: unknown; detailText?: unknown };
    const validated = validateChatReportInput(body.categories, body.detailText);
    if (!validated.ok) {
      res.status(400).json({ error: validated.error });
      return;
    }
    const result = createOrAppendChatReport(db, {
      reporterUserId: uid,
      chatConversationId: conversationId,
      categories: validated.categories,
      detailText: validated.detail,
    });
    res.json({ ok: true, ...result });
  });

  r.post("/join-publisher", jsonMw(), (req: Request, res: Response) => {
    const uid = readAuthUserId(req);
    if (!uid) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const body = req.body as { propertyId?: unknown; roomId?: unknown; targetType?: unknown };
    const propertyId = typeof body.propertyId === "string" ? body.propertyId.trim() : "";
    const roomId = typeof body.roomId === "string" ? body.roomId.trim() : null;
    const targetType = body.targetType === "room" ? "room" : "property";
    if (!propertyId) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const pub = db
      .prepare(
        `SELECT p.id FROM properties p
         INNER JOIN user_publishers up ON up.publisher_id = p.publisher_id
         WHERE p.id = ? AND up.user_id = ?`,
      )
      .get(propertyId, uid) as { id: string } | undefined;
    if (!pub) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const report = findReportThreadForPost(db, { targetType, roomId, propertyId });
    if (!report) {
      res.status(404).json({ error: "no_report_thread" });
      return;
    }
    const conversationId = joinPublisherToReportThread(db, report.id, uid);
    res.json({ ok: true, conversationId, postReportId: report.id });
  });

  r.get("/thread", (req: Request, res: Response) => {
    const propertyId = typeof req.query.propertyId === "string" ? req.query.propertyId.trim() : "";
    const roomId = typeof req.query.roomId === "string" ? req.query.roomId.trim() : null;
    const targetType = req.query.targetType === "room" ? "room" : "property";
    if (!propertyId) {
      res.status(400).json({ error: "invalid_query" });
      return;
    }
    const report = findReportThreadForPost(db, { targetType, roomId, propertyId });
    if (!report) {
      res.json({ thread: null });
      return;
    }
    res.json({
      thread: {
        conversationId: report.conversationId,
        postReportId: report.id,
        reportCount: report.reportCount,
        reviewedAt: report.reviewedAt,
      },
    });
  });

  return r;
}

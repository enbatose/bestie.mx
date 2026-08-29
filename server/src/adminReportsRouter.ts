import type { DatabaseSync } from "node:sqlite";
import express, { type NextFunction, type Request, type Response } from "express";
import { readAuthUserId } from "./jwtSession.js";
import { isAdminUser } from "./adminAuth.js";
import {
  adminPauseProperty,
  adminUnpauseProperty,
  approvePendingReviewProperty,
  blockPublisher,
  createPublisherBlockReportThread,
  flagReportAbuse,
  loadPostReportByConversationId,
  loadReportEvents,
  loadReportStats,
  markReportReviewed,
  notifyPublisherInReportThread,
  unblockPublisher,
} from "./listingReports.js";
import { startAdminSupportConversation } from "./adminSupportStart.js";
import { propertyReferenceCode, PUBLISH_PREVIEW_EDITOR_QUERY, roomReferenceCode } from "./listingReference.js";
import { publicBaseUrl } from "./publicBaseUrl.js";

function jsonMw() {
  return express.json({ limit: "64kb" });
}

export function adminReportsRouter(db: DatabaseSync) {
  const r = express.Router();

  function requireAdmin(req: Request, res: Response, next: NextFunction): void {
    const uid = readAuthUserId(req);
    if (!uid) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (!isAdminUser(db, uid)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  }

  r.use(requireAdmin);

  function loadReportContext(conversationId: string) {
    const report = loadPostReportByConversationId(db, conversationId);
    if (!report) return null;
    const events = loadReportEvents(db, report.id);
    const latestReporterId =
      events.length > 0 ? events[events.length - 1]!.reporter_user_id : null;
    const stats = loadReportStats(db, {
      postReportId: report.id,
      publisherUserId: report.publisherUserId,
      reporterUserId: latestReporterId,
    });
    let postUrl: string | null = null;
    let editPath: string | null = null;
    if (report.targetType === "room" && report.targetRoomId) {
      postUrl = `${publicBaseUrl()}/anuncio/${roomReferenceCode(report.targetRoomId)}`;
    } else if (report.targetPropertyId) {
      postUrl = `${publicBaseUrl()}/propiedad/${propertyReferenceCode(report.targetPropertyId)}`;
      editPath = `/publicar?edit=${encodeURIComponent(propertyReferenceCode(report.targetPropertyId))}&${PUBLISH_PREVIEW_EDITOR_QUERY}=1`;
    }
    let propertyStatus: string | null = null;
    let pausedBy: string | null = null;
    if (report.targetPropertyId) {
      const prop = db
        .prepare(`SELECT status, paused_by FROM properties WHERE id = ?`)
        .get(report.targetPropertyId) as { status: string; paused_by: string | null } | undefined;
      propertyStatus = prop?.status ?? null;
      pausedBy = prop?.paused_by ?? null;
    }
    return { report, events, stats, postUrl, editPath, propertyStatus, pausedBy, latestReporterId };
  }

  r.get("/conversations/:id/context", (req: Request, res: Response) => {
    const id = String(req.params.id ?? "").trim();
    const ctx = loadReportContext(id);
    if (!ctx) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const { report, events, stats, postUrl, editPath, propertyStatus, pausedBy, latestReporterId } = ctx;

    let chatHistory: { id: string; senderUserId: string; body: string; createdAt: string }[] = [];
    if (report.targetType === "chat" && report.targetChatConversationId) {
      const daysRaw = Number(req.query.historyDays);
      const historyDays = Number.isFinite(daysRaw) && daysRaw > 0 ? daysRaw : null;
      const cutoff = historyDays
        ? new Date(Date.now() - historyDays * 86_400_000).toISOString()
        : null;
      chatHistory = db
        .prepare(
          `SELECT id, sender_user_id, body, created_at FROM messages
           WHERE conversation_id = ?
           ${cutoff ? "AND created_at >= ?" : ""}
           ORDER BY created_at ASC`,
        )
        .all(
          ...(cutoff
            ? [report.targetChatConversationId, cutoff]
            : [report.targetChatConversationId]),
        )
        .map((m: Record<string, unknown>) => ({
          id: String(m.id),
          senderUserId: String(m.sender_user_id),
          body: String(m.body ?? ""),
          createdAt: String(m.created_at),
        }));
    }

    const reporters = events.map((e) => ({
      eventId: e.id,
      reporterUserId: e.reporter_user_id,
      categories: JSON.parse(e.categories_json) as string[],
      detailText: e.detail_text,
      photoUrl: e.photo_url,
      photoIndex: e.photo_index,
      createdAt: e.created_at,
    }));

    res.json({
      report: {
        id: report.id,
        conversationId: report.conversationId,
        targetType: report.targetType,
        targetRoomId: report.targetRoomId,
        targetPropertyId: report.targetPropertyId,
        targetChatConversationId: report.targetChatConversationId,
        publisherUserId: report.publisherUserId,
        reportCount: report.reportCount,
        reviewedAt: report.reviewedAt,
      },
      stats,
      postUrl,
      editPath,
      propertyStatus,
      pausedBy,
      latestReporterId,
      reporters,
      chatHistory,
    });
  });

  r.post("/conversations/:id/mark-reviewed", jsonMw(), (req: Request, res: Response) => {
    const adminId = readAuthUserId(req)!;
    const id = String(req.params.id ?? "").trim();
    const report = loadPostReportByConversationId(db, id);
    if (!report) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    markReportReviewed(db, report.id, adminId);
    res.json({ ok: true });
  });

  r.post("/conversations/:id/pause-post", jsonMw(), (req: Request, res: Response) => {
    const id = String(req.params.id ?? "").trim();
    const report = loadPostReportByConversationId(db, id);
    if (!report?.targetPropertyId) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    adminPauseProperty(db, report.targetPropertyId);
    notifyPublisherInReportThread(
      db,
      id,
      "Tu anuncio fue pausado por Bestie. Puedes editarlo y enviarlo a revisión, o escribir aquí si tienes preguntas.",
    );
    res.json({ ok: true });
  });

  r.post("/conversations/:id/resume-post", jsonMw(), (req: Request, res: Response) => {
    const id = String(req.params.id ?? "").trim();
    const report = loadPostReportByConversationId(db, id);
    if (!report?.targetPropertyId) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    adminUnpauseProperty(db, report.targetPropertyId);
    notifyPublisherInReportThread(db, id, "Tu anuncio fue reactivado por Bestie.");
    res.json({ ok: true });
  });

  r.post("/conversations/:id/approve-changes", jsonMw(), (req: Request, res: Response) => {
    const id = String(req.params.id ?? "").trim();
    const report = loadPostReportByConversationId(db, id);
    if (!report?.targetPropertyId) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    approvePendingReviewProperty(db, report.targetPropertyId);
    notifyPublisherInReportThread(db, id, "Tus cambios fueron aprobados. Tu anuncio ya está publicado de nuevo.");
    const pub = report.publisherUserId;
    if (pub) {
      void import("./notificationsSchema.js").then(({ notifyUser }) => {
        notifyUser(db, {
          userId: pub,
          text: "Tus cambios fueron aprobados y tu anuncio ya está publicado.",
          link: "/mis-anuncios",
        });
      });
    }
    res.json({ ok: true });
  });

  r.post("/conversations/:id/block-publisher", jsonMw(), (req: Request, res: Response) => {
    const adminId = readAuthUserId(req)!;
    const id = String(req.params.id ?? "").trim();
    const report = loadPostReportByConversationId(db, id);
    if (!report?.publisherUserId) {
      res.status(404).json({ error: "no_publisher" });
      return;
    }
    blockPublisher(db, report.publisherUserId, adminId);
    createPublisherBlockReportThread(db, report.publisherUserId);
    res.json({ ok: true });
  });

  r.post("/conversations/:id/unblock-publisher", jsonMw(), (req: Request, res: Response) => {
    const id = String(req.params.id ?? "").trim();
    const report = loadPostReportByConversationId(db, id);
    if (!report?.publisherUserId) {
      res.status(404).json({ error: "no_publisher" });
      return;
    }
    unblockPublisher(db, report.publisherUserId);
    res.json({ ok: true });
  });

  r.post("/conversations/:id/contact-reporter", jsonMw(), (req: Request, res: Response) => {
    const id = String(req.params.id ?? "").trim();
    const ctx = loadReportContext(id);
    if (!ctx?.latestReporterId) {
      res.status(400).json({ error: "anonymous_reporter" });
      return;
    }
    const result = startAdminSupportConversation(db, {
      userId: ctx.latestReporterId,
      subject: "Sobre tu reporte en Bestie",
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ conversationId: result.conversationId, created: result.created });
  });

  r.post("/conversations/:id/contact-publisher", jsonMw(), (req: Request, res: Response) => {
    const id = String(req.params.id ?? "").trim();
    const report = loadPostReportByConversationId(db, id);
    if (!report?.publisherUserId) {
      res.status(404).json({ error: "no_publisher" });
      return;
    }
    const result = startAdminSupportConversation(db, {
      userId: report.publisherUserId,
      subject: "Sobre tu anuncio reportado",
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ conversationId: result.conversationId, created: result.created });
  });

  r.post("/conversations/:id/flag-abuse", jsonMw(), (req: Request, res: Response) => {
    const adminId = readAuthUserId(req)!;
    const id = String(req.params.id ?? "").trim();
    const body = req.body as { reportEventId?: unknown };
    const eventId = typeof body.reportEventId === "string" ? body.reportEventId.trim() : "";
    if (!eventId) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const report = loadPostReportByConversationId(db, id);
    if (!report) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const event = db
      .prepare(`SELECT id, reporter_user_id FROM post_report_events WHERE id = ? AND post_report_id = ?`)
      .get(eventId, report.id) as { id: string; reporter_user_id: string | null } | undefined;
    if (!event?.reporter_user_id) {
      res.status(400).json({ error: "anonymous_reporter" });
      return;
    }
    flagReportAbuse(db, {
      postReportId: report.id,
      reportEventId: event.id,
      reporterUserId: event.reporter_user_id,
      adminId,
    });
    res.json({ ok: true });
  });

  r.post("/users/:userId/block-publisher", jsonMw(), (req: Request, res: Response) => {
    const adminId = readAuthUserId(req)!;
    const userId = String(req.params.userId ?? "").trim();
    blockPublisher(db, userId, adminId);
    createPublisherBlockReportThread(db, userId);
    res.json({ ok: true });
  });

  r.post("/users/:userId/unblock-publisher", jsonMw(), (req: Request, res: Response) => {
    const userId = String(req.params.userId ?? "").trim();
    unblockPublisher(db, userId);
    res.json({ ok: true });
  });

  return r;
}

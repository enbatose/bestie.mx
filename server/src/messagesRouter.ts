import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import express, { type Request, type Response } from "express";
import { readAuthUserId } from "./jwtSession.js";
import { isAdminUser } from "./adminAuth.js";
import {
  DELETED_USER_ID,
  FEEDBACK_BOT_USER_ID,
  SUPPORT_BOT_USER_ID,
  isSystemMessagingBot,
  normalizeConversationKind,
  type MessagingConversationKind,
} from "./messagingSchema.js";
import { createSlidingWindowLimiter } from "./rateLimit.js";
import {
  parsePropertyReferenceSuffix,
  parseRoomReferenceSuffix,
} from "./listingReference.js";
import {
  clampMessageAttachments,
  clampStr,
  isSafePropertyId,
  isSafeRoomOrListingId,
  type MessageAttachment,
} from "./validation.js";
import { attachPublishFeedbackToProperty } from "./adminPosts.js";
import { isRoomListingPubliclyVisible } from "./publishedListingsQuery.js";
import { isUserPublisherBlocked, loadPostReportByConversationId, REPORT_BOT_USER_ID } from "./listingReports.js";
import { resolveRoomIdFromRouteParam } from "./resolveListingRouteId.js";
import { notifyAdminsOfListingInterest } from "./listingContactEvents.js";
import {
  hasAcceptedMessagingSafety,
  isMessagingSafetyExemptPeer,
  MESSAGING_SAFETY_NOTICE_VERSION,
  MESSAGING_SAFETY_PREVIEW_PLACEHOLDER,
  recordMessagingSafetyAcknowledgment,
  resolveMessagingSafetyRole,
  type MessagingSafetyRole,
} from "./messagingSafety.js";

const postMsgLimiter = createSlidingWindowLimiter({ windowMs: 60_000, max: 40 });
const startConvLimiter = createSlidingWindowLimiter({ windowMs: 60_000, max: 15 });
const safetyAckLimiter = createSlidingWindowLimiter({ windowMs: 60_000, max: 20 });

const SUPPORT_SUBJECT_MAX_LEN = 200;
const SUPPORT_BODY_MAX_LEN = 4000;
const FEEDBACK_SUBJECT_MAX_LEN = 200;
const FEEDBACK_BODY_MAX_LEN = 4000;
const FEEDBACK_RATING_MIN = 1;
const FEEDBACK_RATING_MAX = 5;

function jsonMw() {
  return express.json({ limit: "256kb" });
}

function isoNow(): string {
  return new Date().toISOString();
}

function listingContextTitle(db: DatabaseSync, roomId: string): string {
  const row = db
    .prepare(
      `SELECT r.title AS rt, p.title AS pt, p.city AS city
       FROM rooms r INNER JOIN properties p ON p.id = r.property_id WHERE r.id = ?`,
    )
    .get(roomId) as { rt: string; pt: string; city: string } | undefined;
  if (!row) return "Anuncio";
  const a = row.pt?.trim() || "";
  const b = row.rt?.trim() || "";
  const c = row.city?.trim() || "";
  if (a && b) return `${a} · ${b}${c ? ` (${c})` : ""}`;
  return (b || a || "Anuncio") + (c ? ` — ${c}` : "");
}

/** Returns user id of Bestie account linked to listing owner publisher, if any. */
export function ownerUserIdForRoomListing(db: DatabaseSync, roomListingId: string): string | null {
  const row = db
    .prepare(
      `SELECT up.user_id AS uid
       FROM rooms r
       INNER JOIN properties p ON p.id = r.property_id
       LEFT JOIN user_publishers up ON up.publisher_id = p.publisher_id
       WHERE r.id = ?`,
    )
    .get(roomListingId) as { uid: string | null } | undefined;
  return row?.uid && String(row.uid).trim() ? String(row.uid) : null;
}

function assertMember(db: DatabaseSync, conversationId: string, userId: string): boolean {
  const r = db
    .prepare(`SELECT 1 as x FROM conversation_participants WHERE conversation_id = ? AND user_id = ?`)
    .get(conversationId, userId) as { x: number } | undefined;
  return Boolean(r);
}

function conversationHasDeletedPeer(db: DatabaseSync, conversationId: string): boolean {
  const r = db
    .prepare(`SELECT 1 AS x FROM conversation_participants WHERE conversation_id = ? AND user_id = ?`)
    .get(conversationId, DELETED_USER_ID) as { x: number } | undefined;
  return Boolean(r);
}

function conversationKind(db: DatabaseSync, conversationId: string): MessagingConversationKind | null {
  const row = db.prepare(`SELECT kind FROM conversations WHERE id = ?`).get(conversationId) as
    | { kind: string }
    | undefined;
  if (!row) return null;
  return normalizeConversationKind(row.kind);
}

function findExistingConversation(
  db: DatabaseSync,
  a: string,
  b: string,
  listingRoomId: string | null,
): string | null {
  const key = listingRoomId ?? "";
  const row = db
    .prepare(
      `SELECT c.id
       FROM conversations c
       JOIN conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = ?
       JOIN conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = ?
       WHERE COALESCE(c.listing_room_id, '') = ?`,
    )
    .get(a, b, key) as { id: string } | undefined;
  return row?.id ?? null;
}

function createConversation(
  db: DatabaseSync,
  userA: string,
  userB: string,
  listingRoomId: string | null,
  contextTitle: string,
  kind: MessagingConversationKind = "listing",
): string {
  const id = randomUUID();
  const now = isoNow();
  db.prepare(
    `INSERT INTO conversations (id, listing_room_id, context_title, kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, listingRoomId, contextTitle.slice(0, 500), kind, now, now);
  db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`).run(id, userA);
  db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`).run(id, userB);
  return id;
}

function insertMessage(
  db: DatabaseSync,
  conversationId: string,
  senderUserId: string,
  body: string,
  attachments: MessageAttachment[],
): { id: string; createdAt: string } {
  const mid = randomUUID();
  const now = isoNow();
  db.prepare(
    `INSERT INTO messages (id, conversation_id, sender_user_id, body, created_at, read_at, attachments_json)
     VALUES (?, ?, ?, ?, ?, NULL, ?)`,
  ).run(mid, conversationId, senderUserId, body, now, attachments.length > 0 ? JSON.stringify(attachments) : null);
  db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now, conversationId);
  return { id: mid, createdAt: now };
}

function maybeNotifyAdminsFirstListingMessage(
  db: DatabaseSync,
  opts: { conversationId: string; messageId: string; senderUserId: string },
): void {
  const conv = db
    .prepare(`SELECT listing_room_id, context_title FROM conversations WHERE id = ?`)
    .get(opts.conversationId) as { listing_room_id: string | null; context_title: string | null } | undefined;
  const listingRoomId = conv?.listing_room_id?.trim();
  if (!listingRoomId) return;
  const owner = ownerUserIdForRoomListing(db, listingRoomId);
  if (!owner || owner === opts.senderUserId) return;
  const prior = db
    .prepare(
      `SELECT COUNT(*) AS c FROM messages
       WHERE conversation_id = ? AND sender_user_id = ? AND id != ?`,
    )
    .get(opts.conversationId, opts.senderUserId, opts.messageId) as { c: number };
  if (Number(prior?.c ?? 0) > 0) return;
  notifyAdminsOfListingInterest(db, {
    seekerUserId: opts.senderUserId,
    listingId: listingRoomId,
    listingTitle: String(conv?.context_title ?? "").trim() || listingContextTitle(db, listingRoomId),
    eventType: "first_message",
  });
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

function markThreadRead(db: DatabaseSync, conversationId: string, readerUserId: string): void {
  const now = isoNow();
  // Delivery first so ticks can show “received” before “read” when the inbox is polled without opening.
  db.prepare(
    `UPDATE messages SET delivered_at = ? WHERE conversation_id = ? AND sender_user_id != ? AND delivered_at IS NULL`,
  ).run(now, conversationId, readerUserId);
  db.prepare(
    `UPDATE messages SET read_at = ? WHERE conversation_id = ? AND sender_user_id != ? AND read_at IS NULL`,
  ).run(now, conversationId, readerUserId);
}

/** Inbox poll: peer has “received” messages without necessarily opening the thread (read). */
function markInboxDelivered(db: DatabaseSync, userId: string): void {
  db.prepare(
    `UPDATE messages SET delivered_at = ?
     WHERE delivered_at IS NULL
       AND sender_user_id != ?
       AND conversation_id IN (
         SELECT conversation_id FROM conversation_participants WHERE user_id = ?
       )`,
  ).run(isoNow(), userId, userId);
}

function countUnreadForUser(db: DatabaseSync, userId: string): number {
  return (
    db
      .prepare(
        `SELECT COUNT(*) as n FROM messages m
         JOIN conversation_participants p ON p.conversation_id = m.conversation_id AND p.user_id = ?
         WHERE m.sender_user_id != ? AND m.read_at IS NULL`,
      )
      .get(userId, userId) as { n: number }
  ).n;
}

export function messagesRouter(db: DatabaseSync) {
  const r = express.Router();

  r.get("/unread-count", (req: Request, res: Response) => {
    const me = readAuthUserId(req);
    if (!me) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const c = (
      db
        .prepare(
          `SELECT COUNT(*) as n FROM messages m
           JOIN conversation_participants p ON p.conversation_id = m.conversation_id AND p.user_id = ?
           WHERE m.sender_user_id != ? AND m.read_at IS NULL`,
        )
        .get(me, me) as { n: number }
    ).n;
    res.json({ count: c });
  });

  r.get("/conversations", (req: Request, res: Response) => {
    const me = readAuthUserId(req);
    if (!me) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    // Multi-keyword AND: every whitespace-separated token must match somewhere
    // (title, counterpart name, body, room/property GUID, or public ref like A550E8400 / PC2193A56).
    const rawQ = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 240) : "";
    const tokens =
      rawQ.length > 0
        ? rawQ
            .split(/\s+/)
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 12)
        : [];
    const listingRoomId =
      typeof req.query.listing === "string" ? req.query.listing.trim() : "";
    const propertyId =
      typeof req.query.property === "string" ? req.query.property.trim() : "";
    if (listingRoomId && !isSafeRoomOrListingId(listingRoomId)) {
      res.status(400).json({ error: "invalid_listing_room_id" });
      return;
    }
    if (propertyId && !isSafePropertyId(propertyId)) {
      res.status(400).json({ error: "invalid_property_id" });
      return;
    }

    const conditions: string[] = [];
    const params: string[] = [
      me,
      me,
      me,
      me,
      SUPPORT_BOT_USER_ID,
      FEEDBACK_BOT_USER_ID,
      "blog-bestie",
      REPORT_BOT_USER_ID,
    ];
    for (const token of tokens) {
      const like = `%${token.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
      // Title / counterpart / message body always participate.
      // GUID / property_id substring matches only for longer tokens — short scraps
      // like "A2" or "en" otherwise false-positive against UUID hex (broke CI AND search).
      const parts = [
        `c.context_title LIKE ? ESCAPE '\\'`,
        `other.display_name LIKE ? ESCAPE '\\'`,
        `EXISTS (
             SELECT 1 FROM messages searched
             WHERE searched.conversation_id = c.id AND searched.body LIKE ? ESCAPE '\\'
           )`,
      ];
      params.push(like, like, like);

      if (token.length >= 8) {
        parts.push(
          `IFNULL(c.listing_room_id, '') LIKE ? ESCAPE '\\'`,
          `EXISTS (
             SELECT 1 FROM rooms filtered_room
             WHERE filtered_room.id = c.listing_room_id
               AND filtered_room.property_id LIKE ? ESCAPE '\\'
           )`,
        );
        params.push(like, like);
      }

      const roomRefSuffix = parseRoomReferenceSuffix(token);
      if (roomRefSuffix) {
        parts.push(
          `UPPER(REPLACE(IFNULL(c.listing_room_id, ''), '-', '')) LIKE ? ESCAPE '\\'`,
        );
        params.push(`${roomRefSuffix}%`);
      }
      const propertyRefSuffix = parsePropertyReferenceSuffix(token);
      if (propertyRefSuffix) {
        parts.push(
          `EXISTS (
             SELECT 1 FROM rooms ref_room
             WHERE ref_room.id = c.listing_room_id
               AND UPPER(REPLACE(REPLACE(ref_room.property_id, 'prp__', ''), '-', '')) LIKE ? ESCAPE '\\'
           )`,
        );
        params.push(`${propertyRefSuffix}%`);
      }

      conditions.push(`(${parts.join("\n          OR ")})`);
    }
    if (listingRoomId) {
      conditions.push("c.listing_room_id = ?");
      params.push(listingRoomId);
    }
    if (propertyId) {
      conditions.push(
        `EXISTS (
           SELECT 1 FROM rooms filtered_room
           WHERE filtered_room.id = c.listing_room_id AND filtered_room.property_id = ?
         )`,
      );
      params.push(propertyId);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = db
      .prepare(
        `SELECT c.id, c.context_title, c.listing_room_id, c.kind, c.updated_at,
                other.id AS other_user_id,
                other.display_name AS other_display_name,
                other.profile_picture_url AS other_profile_picture_url,
                other.email AS other_email,
                (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_preview,
                (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_user_id != ? AND m.read_at IS NULL) AS unread_count,
                EXISTS (
                  SELECT 1 FROM rooms owner_room
                  INNER JOIN properties owner_prop ON owner_prop.id = owner_room.property_id
                  INNER JOIN user_publishers owner_up ON owner_up.publisher_id = owner_prop.publisher_id
                  WHERE owner_room.id = c.listing_room_id AND owner_up.user_id = ?
                ) AS viewer_is_listing_owner
         FROM conversations c
         JOIN conversation_participants me ON me.conversation_id = c.id AND me.user_id = ?
         JOIN conversation_participants om ON om.conversation_id = c.id AND om.user_id != ?
           AND (
             CASE
               WHEN c.kind IN ('support', 'feedback', 'blog', 'report') THEN om.user_id IN (?, ?, ?, ?)
               ELSE 1
             END
           )
         JOIN users other ON other.id = om.user_id
         ${where}
         ORDER BY c.updated_at DESC`,
      )
      .all(...params) as Record<string, unknown>[];
    markInboxDelivered(db, me);
    const safetyAccepted = hasAcceptedMessagingSafety(db, me);
    res.json({
      conversations: rows.map((row) => {
        const kind = normalizeConversationKind(typeof row.kind === "string" ? row.kind : null);
        const otherUserId = String(row.other_user_id);
        const listingRoomId =
          typeof row.listing_room_id === "string" && row.listing_room_id.trim()
            ? row.listing_room_id
            : null;
        const otherEmail = typeof row.other_email === "string" ? row.other_email : null;
        const messagingGateExempt = isMessagingSafetyExemptPeer(kind, otherUserId, otherEmail);
        const rawPreview = typeof row.last_preview === "string" ? row.last_preview : "";
        const lastPreview =
          !safetyAccepted && !messagingGateExempt && rawPreview
            ? MESSAGING_SAFETY_PREVIEW_PLACEHOLDER
            : rawPreview;
        return {
          id: row.id,
          contextTitle: row.context_title,
          listingRoomId,
          kind,
          updatedAt: row.updated_at,
          otherUserId,
          otherDisplayName: row.other_display_name,
          otherProfilePictureUrl:
            typeof row.other_profile_picture_url === "string" ? row.other_profile_picture_url : null,
          lastPreview,
          unreadCount: Number(row.unread_count) || 0,
          messagingGateExempt,
          viewerIsListingOwner: Boolean(row.viewer_is_listing_owner),
        };
      }),
    });
  });

  r.get("/safety-acknowledgment", (req: Request, res: Response) => {
    const me = readAuthUserId(req);
    if (!me) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    res.json({
      noticeVersion: MESSAGING_SAFETY_NOTICE_VERSION,
      accepted: hasAcceptedMessagingSafety(db, me),
    });
  });

  r.post("/safety-acknowledgment", jsonMw(), (req: Request, res: Response) => {
    const me = readAuthUserId(req);
    if (!me) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const lim = safetyAckLimiter(req.ip ?? "ip");
    if (!lim.ok) {
      res.status(429).json({ error: "rate_limited", retryAfterMs: lim.retryAfterMs });
      return;
    }
    if (hasAcceptedMessagingSafety(db, me)) {
      res.json({
        noticeVersion: MESSAGING_SAFETY_NOTICE_VERSION,
        accepted: true,
        alreadyAccepted: true,
      });
      return;
    }
    const body = req.body as { conversationId?: unknown; role?: unknown };
    const conversationId =
      typeof body.conversationId === "string" && body.conversationId.trim().length > 0
        ? body.conversationId.trim().slice(0, 120)
        : null;
    if (conversationId && !assertMember(db, conversationId, me)) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    let role: MessagingSafetyRole =
      body.role === "publisher" || body.role === "seeker" ? body.role : "seeker";
    if (conversationId) {
      const conv = db
        .prepare(`SELECT listing_room_id FROM conversations WHERE id = ?`)
        .get(conversationId) as { listing_room_id: string | null } | undefined;
      role = resolveMessagingSafetyRole(db, me, conv?.listing_room_id ?? null);
    }
    const acceptedAt = isoNow();
    recordMessagingSafetyAcknowledgment(db, {
      id: randomUUID(),
      userId: me,
      noticeVersion: MESSAGING_SAFETY_NOTICE_VERSION,
      role,
      conversationId,
      acceptedAt,
    });
    res.status(201).json({
      noticeVersion: MESSAGING_SAFETY_NOTICE_VERSION,
      accepted: true,
      role,
      acceptedAt,
    });
  });

  r.post("/conversations/from-listing", jsonMw(), (req: Request, res: Response) => {
    const me = readAuthUserId(req);
    if (!me) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const lim = startConvLimiter(req.ip ?? "ip");
    if (!lim.ok) {
      res.status(429).json({ error: "rate_limited", retryAfterMs: lim.retryAfterMs });
      return;
    }
    const listingRoomIdRaw = (req.body as { listingRoomId?: unknown }).listingRoomId;
    if (typeof listingRoomIdRaw !== "string" || !listingRoomIdRaw.trim()) {
      res.status(400).json({ error: "invalid_listing_room_id" });
      return;
    }
    // Accept UUID or public short code (`A550E8400`) — same as GET /api/listings/:id.
    const listingRoomId = resolveRoomIdFromRouteParam(db, listingRoomIdRaw);
    if (!listingRoomId) {
      res.status(400).json({ error: "invalid_listing_room_id" });
      return;
    }
    // Drafts / paused / occupied must not be contactable via API (UI already blocks contact).
    if (!isRoomListingPubliclyVisible(db, listingRoomId)) {
      res.status(404).json({
        error: "not_found",
        message: "Este anuncio no está disponible para mensajes por ahora.",
      });
      return;
    }
    const owner = ownerUserIdForRoomListing(db, listingRoomId);
    if (!owner) {
      res.status(409).json({
        error: "owner_not_reachable",
        message: "El anunciante no tiene una cuenta vinculada para mensajes en la app.",
      });
      return;
    }
    if (owner === me) {
      res.status(400).json({
        error: "cannot_message_self",
        message: "El usuario anunciante no puede abrir una conversación consigo mismo.",
      });
      return;
    }
    if (isUserPublisherBlocked(db, owner)) {
      res.status(403).json({
        error: "publisher_blocked",
        message: "Este anunciante no puede recibir mensajes por ahora.",
      });
      return;
    }
    if (isUserPublisherBlocked(db, me)) {
      res.status(403).json({
        error: "publisher_blocked",
        message: "Tu cuenta no puede contactar a otros usuarios por ahora.",
      });
      return;
    }
    const title = listingContextTitle(db, listingRoomId);
    const existing = findExistingConversation(db, me, owner, listingRoomId);
    if (existing) {
      res.json({ conversationId: existing, created: false });
      return;
    }
    const id = createConversation(db, me, owner, listingRoomId, title, "listing");
    res.status(201).json({ conversationId: id, created: true });
  });

  /** Creates a brand-new support "ticket" conversation with the Soporte de Bestie account. */
  r.post("/conversations/from-support", jsonMw(), (req: Request, res: Response) => {
    const me = readAuthUserId(req);
    if (!me) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (isSystemMessagingBot(me)) {
      res.status(400).json({ error: "invalid_sender" });
      return;
    }
    const lim = startConvLimiter(req.ip ?? "ip");
    if (!lim.ok) {
      res.status(429).json({ error: "rate_limited", retryAfterMs: lim.retryAfterMs });
      return;
    }
    const body = req.body as { subject?: unknown; body?: unknown; attachments?: unknown };
    const subject = clampStr(typeof body.subject === "string" ? body.subject : "", SUPPORT_SUBJECT_MAX_LEN);
    const messageBody = clampStr(typeof body.body === "string" ? body.body : "", SUPPORT_BODY_MAX_LEN);
    const attachments = clampMessageAttachments(body.attachments);
    if (!subject) {
      res.status(400).json({ error: "subject_required" });
      return;
    }
    if (!messageBody && attachments.length === 0) {
      res.status(400).json({ error: "empty_body" });
      return;
    }
    const conversationId = createConversation(db, me, SUPPORT_BOT_USER_ID, null, subject, "support");
    const message = insertMessage(db, conversationId, me, messageBody, attachments);
    res.status(201).json({ conversationId, messageId: message.id, createdAt: message.createdAt });
  });

  /** Creates a brand-new feedback conversation with the Feedback de Bestie account. */
  r.post("/conversations/from-feedback", jsonMw(), (req: Request, res: Response) => {
    const me = readAuthUserId(req);
    if (!me) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (isSystemMessagingBot(me)) {
      res.status(400).json({ error: "invalid_sender" });
      return;
    }
    const lim = startConvLimiter(req.ip ?? "ip");
    if (!lim.ok) {
      res.status(429).json({ error: "rate_limited", retryAfterMs: lim.retryAfterMs });
      return;
    }
    const body = req.body as {
      subject?: unknown;
      body?: unknown;
      rating?: unknown;
      source?: unknown;
      listingRoomId?: unknown;
      comment?: unknown;
    };
    const ratingRaw = typeof body.rating === "number" ? body.rating : Number(body.rating);
    const rating = Number.isInteger(ratingRaw) ? ratingRaw : NaN;
    if (!Number.isFinite(rating) || rating < FEEDBACK_RATING_MIN || rating > FEEDBACK_RATING_MAX) {
      res.status(400).json({ error: "rating_required" });
      return;
    }
    const subject =
      clampStr(typeof body.subject === "string" ? body.subject : "", FEEDBACK_SUBJECT_MAX_LEN) ||
      "Feedback";
    const messageBody = clampStr(typeof body.body === "string" ? body.body : "", FEEDBACK_BODY_MAX_LEN);
    if (!messageBody) {
      res.status(400).json({ error: "empty_body" });
      return;
    }
    const source = typeof body.source === "string" ? body.source.slice(0, 40) : null;
    const listingRoomId =
      typeof body.listingRoomId === "string" ? body.listingRoomId.trim().slice(0, 120) : "";
    const comment =
      typeof body.comment === "string"
        ? clampStr(body.comment, FEEDBACK_BODY_MAX_LEN)
        : "";
    const conversationId = createConversation(
      db,
      me,
      FEEDBACK_BOT_USER_ID,
      listingRoomId || null,
      subject,
      "feedback",
    );
    const message = insertMessage(db, conversationId, me, messageBody, []);
    if (source === "publish" && listingRoomId) {
      const attached = attachPublishFeedbackToProperty(db, {
        listingRoomId,
        rating,
        comment,
      });
      if (!attached) {
        console.warn(
          "[messages] publish feedback conversation created but property attach failed",
          { conversationId, listingRoomId, rating },
        );
      }
    }
    res.status(201).json({
      conversationId,
      messageId: message.id,
      createdAt: message.createdAt,
      rating,
      source,
    });
  });

  r.get("/conversations/:id/messages", (req: Request, res: Response) => {
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
    if (!assertMember(db, id, me)) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    markThreadRead(db, id, me);
    const unreadCount = countUnreadForUser(db, me);
    const kind = conversationKind(db, id);
    let publisherOnlyView = false;
    if (kind === "report") {
      const report = loadPostReportByConversationId(db, id);
      publisherOnlyView = Boolean(report?.publisherUserId && report.publisherUserId === me);
    }
    const rows = db
      .prepare(
        `SELECT m.id, m.sender_user_id, m.body, m.created_at, m.delivered_at, m.read_at, m.attachments_json
         FROM messages m WHERE m.conversation_id = ? ORDER BY m.created_at ASC`,
      )
      .all(id) as Record<string, unknown>[];
    res.json({
      unreadCount,
      messages: rows
        .filter((m) => {
          if (!publisherOnlyView) return true;
          const sender = String(m.sender_user_id);
          return sender === me || sender === REPORT_BOT_USER_ID || isAdminUser(db, sender);
        })
        .map((m) => {
        const rawSenderId = String(m.sender_user_id);
        // Never reveal which real admin replied — customers only see the system bot identity.
        let senderUserId = rawSenderId;
        if (rawSenderId !== me && isAdminUser(db, rawSenderId)) {
          if (kind === "support") senderUserId = SUPPORT_BOT_USER_ID;
          else if (kind === "feedback") senderUserId = FEEDBACK_BOT_USER_ID;
          else if (kind === "report") senderUserId = REPORT_BOT_USER_ID;
        }
        return {
          id: m.id,
          senderUserId,
          body: m.body,
          createdAt: m.created_at,
          deliveredAt: typeof m.delivered_at === "string" ? m.delivered_at : null,
          readAt: typeof m.read_at === "string" ? m.read_at : null,
          attachments: parseAttachmentsJson(m.attachments_json),
        };
      }),
    });
  });

  r.post("/conversations/:id/messages", jsonMw(), (req: Request, res: Response) => {
    const me = readAuthUserId(req);
    if (!me) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const lim = postMsgLimiter(req.ip ?? "ip");
    if (!lim.ok) {
      res.status(429).json({ error: "rate_limited", retryAfterMs: lim.retryAfterMs });
      return;
    }
    const id = req.params.id;
    if (!id || id.length > 120) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    if (!assertMember(db, id, me)) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (conversationHasDeletedPeer(db, id)) {
      res.status(410).json({
        error: "peer_deleted",
        message: "Esta conversación ya no está disponible.",
      });
      return;
    }
    const kind = conversationKind(db, id);
    if (kind === "listing") {
      if (isUserPublisherBlocked(db, me)) {
        res.status(403).json({ error: "publisher_blocked" });
        return;
      }
      const conv = db
        .prepare(`SELECT listing_room_id FROM conversations WHERE id = ?`)
        .get(id) as { listing_room_id: string | null } | undefined;
      if (conv?.listing_room_id) {
        const owner = ownerUserIdForRoomListing(db, conv.listing_room_id);
        if (owner && isUserPublisherBlocked(db, owner)) {
          res.status(403).json({ error: "publisher_blocked" });
          return;
        }
      }
    }
    const bodyRaw = (req.body as { body?: unknown }).body;
    const body = typeof bodyRaw === "string" ? bodyRaw.trim().slice(0, 4000) : "";
    const attachments = clampMessageAttachments((req.body as { attachments?: unknown }).attachments);
    if (!body && attachments.length === 0) {
      res.status(400).json({ error: "empty_body" });
      return;
    }
    const message = insertMessage(db, id, me, body, attachments);
    if (kind === "listing") {
      maybeNotifyAdminsFirstListingMessage(db, {
        conversationId: id,
        messageId: message.id,
        senderUserId: me,
      });
    }
    res.status(201).json({ id: message.id, createdAt: message.createdAt });
  });

  return r;
}

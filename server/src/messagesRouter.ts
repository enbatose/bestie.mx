import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import express, { type Request, type Response } from "express";
import { readAuthUserId } from "./jwtSession.js";
import { createSlidingWindowLimiter } from "./rateLimit.js";
import { isSafeRoomOrListingId } from "./validation.js";

const postMsgLimiter = createSlidingWindowLimiter({ windowMs: 60_000, max: 40 });
const startConvLimiter = createSlidingWindowLimiter({ windowMs: 60_000, max: 15 });

function jsonMw() {
  return express.json({ limit: "128kb" });
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
): string {
  const id = randomUUID();
  const now = isoNow();
  db.prepare(
    `INSERT INTO conversations (id, listing_room_id, context_title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, listingRoomId, contextTitle.slice(0, 500), now, now);
  db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`).run(id, userA);
  db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`).run(id, userB);
  return id;
}

function markThreadRead(db: DatabaseSync, conversationId: string, readerUserId: string): void {
  db.prepare(
    `UPDATE messages SET read_at = ? WHERE conversation_id = ? AND sender_user_id != ? AND read_at IS NULL`,
  ).run(isoNow(), conversationId, readerUserId);
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
    const rows = db
      .prepare(
        `SELECT c.id, c.context_title, c.listing_room_id, c.updated_at,
                other.id AS other_user_id,
                other.display_name AS other_display_name,
                (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_preview,
                (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_user_id != ? AND m.read_at IS NULL) AS unread_count
         FROM conversations c
         JOIN conversation_participants me ON me.conversation_id = c.id AND me.user_id = ?
         JOIN conversation_participants om ON om.conversation_id = c.id AND om.user_id != ?
         JOIN users other ON other.id = om.user_id
         ORDER BY c.updated_at DESC`,
      )
      .all(me, me, me) as Record<string, unknown>[];
    res.json({
      conversations: rows.map((row) => ({
        id: row.id,
        contextTitle: row.context_title,
        listingRoomId: row.listing_room_id,
        updatedAt: row.updated_at,
        otherUserId: row.other_user_id,
        otherDisplayName: row.other_display_name,
        lastPreview: row.last_preview ?? "",
        unreadCount: Number(row.unread_count) || 0,
      })),
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
    const listingRoomId = (req.body as { listingRoomId?: unknown }).listingRoomId;
    if (typeof listingRoomId !== "string" || !isSafeRoomOrListingId(listingRoomId)) {
      res.status(400).json({ error: "invalid_listing_room_id" });
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
      res.status(400).json({ error: "cannot_message_self" });
      return;
    }
    const title = listingContextTitle(db, listingRoomId);
    const existing = findExistingConversation(db, me, owner, listingRoomId);
    if (existing) {
      res.json({ conversationId: existing, created: false });
      return;
    }
    const id = createConversation(db, me, owner, listingRoomId, title);
    res.status(201).json({ conversationId: id, created: true });
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
    const rows = db
      .prepare(
        `SELECT m.id, m.sender_user_id, m.body, m.created_at, m.read_at
         FROM messages m WHERE m.conversation_id = ? ORDER BY m.created_at ASC`,
      )
      .all(id) as Record<string, unknown>[];
    res.json({
      messages: rows.map((m) => ({
        id: m.id,
        senderUserId: m.sender_user_id,
        body: m.body,
        createdAt: m.created_at,
        readAt: m.read_at,
      })),
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
    const bodyRaw = (req.body as { body?: unknown }).body;
    const body = typeof bodyRaw === "string" ? bodyRaw.trim().slice(0, 4000) : "";
    if (!body) {
      res.status(400).json({ error: "empty_body" });
      return;
    }
    const mid = randomUUID();
    const now = isoNow();
    db.prepare(
      `INSERT INTO messages (id, conversation_id, sender_user_id, body, created_at, read_at) VALUES (?, ?, ?, ?, ?, NULL)`,
    ).run(mid, id, me, body, now);
    db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now, id);
    res.status(201).json({ id: mid, createdAt: now });
  });

  return r;
}

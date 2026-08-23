import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { propertyReferenceCode, roomReferenceCode } from "./listingReference.js";
import { publicBaseUrl } from "./publicBaseUrl.js";
import {
  categoryLabels,
  CHAT_REPORT_CATEGORIES,
  POST_REPORT_CATEGORIES,
  type ChatReportCategoryId,
  type PostReportCategoryId,
} from "./reportCategories.js";
import { scheduleNotifyPostReported } from "./postReportNotify.js";
import type { ReportTargetType } from "./reportsSchema.js";

export const REPORT_BOT_USER_ID = "report-bestie";
export const REPORT_BOT_DISPLAY_NAME = "Reporte de Bestie";
const REPORT_BOT_EMAIL = "reporte-sistema@bestie.mx";
const SYSTEM_BOT_PASSWORD_MARKER = "system-support-account-no-login";

export type PostReportRow = {
  id: string;
  conversationId: string;
  targetType: ReportTargetType;
  targetRoomId: string | null;
  targetPropertyId: string | null;
  targetChatConversationId: string | null;
  publisherUserId: string | null;
  reportCount: number;
  reviewedAt: string | null;
  reviewedByAdminId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function ensureReportBotUser(db: DatabaseSync): void {
  const row = db.prepare(`SELECT 1 AS x FROM users WHERE id = ?`).get(REPORT_BOT_USER_ID) as
    | { x: number }
    | undefined;
  if (row) return;
  db.prepare(
    `INSERT INTO users (id, email, email_canonical, phone_e164, password_hash, display_name, created_at, email_verified_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`,
  ).run(
    REPORT_BOT_USER_ID,
    REPORT_BOT_EMAIL,
    REPORT_BOT_EMAIL,
    SYSTEM_BOT_PASSWORD_MARKER,
    REPORT_BOT_DISPLAY_NAME,
    new Date().toISOString(),
    null,
  );
}

function isoNow(): string {
  return new Date().toISOString();
}

function loadPublisherUserId(db: DatabaseSync, propertyId: string): string | null {
  const row = db
    .prepare(
      `SELECT up.user_id AS uid
       FROM properties p
       LEFT JOIN user_publishers up ON up.publisher_id = p.publisher_id
       WHERE p.id = ?`,
    )
    .get(propertyId) as { uid: string | null } | undefined;
  return row?.uid && String(row.uid).trim() ? String(row.uid) : null;
}

function findPostReportByTarget(
  db: DatabaseSync,
  target: { type: ReportTargetType; roomId?: string | null; propertyId?: string | null; chatConversationId?: string | null },
): PostReportRow | null {
  let row: Record<string, unknown> | undefined;
  if (target.type === "room" && target.roomId) {
    row = db
      .prepare(`SELECT * FROM post_reports WHERE target_type = 'room' AND target_room_id = ?`)
      .get(target.roomId) as Record<string, unknown> | undefined;
  } else if (target.type === "property" && target.propertyId) {
    row = db
      .prepare(`SELECT * FROM post_reports WHERE target_type = 'property' AND target_property_id = ?`)
      .get(target.propertyId) as Record<string, unknown> | undefined;
  } else if (target.type === "chat" && target.chatConversationId) {
    row = db
      .prepare(
        `SELECT * FROM post_reports WHERE target_type = 'chat' AND target_chat_conversation_id = ?`,
      )
      .get(target.chatConversationId) as Record<string, unknown> | undefined;
  }
  return row ? mapPostReportRow(row) : null;
}

function mapPostReportRow(row: Record<string, unknown>): PostReportRow {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    targetType: String(row.target_type) as ReportTargetType,
    targetRoomId: row.target_room_id != null ? String(row.target_room_id) : null,
    targetPropertyId: row.target_property_id != null ? String(row.target_property_id) : null,
    targetChatConversationId:
      row.target_chat_conversation_id != null ? String(row.target_chat_conversation_id) : null,
    publisherUserId: row.publisher_user_id != null ? String(row.publisher_user_id) : null,
    reportCount: Number(row.report_count ?? 1),
    reviewedAt: row.reviewed_at != null ? String(row.reviewed_at) : null,
    reviewedByAdminId: row.reviewed_by_admin_id != null ? String(row.reviewed_by_admin_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function formatCategoryBlock(categories: readonly string[], detail: string | null, isChat: boolean): string {
  const labels = categoryLabels(categories, isChat ? CHAT_REPORT_CATEGORIES : POST_REPORT_CATEGORIES);
  const lines = [`Motivos: ${labels.length ? labels.join(", ") : "—"}`];
  if (detail?.trim()) lines.push(`Detalle: ${detail.trim()}`);
  return lines.join("\n");
}

function buildPostReportContext(db: DatabaseSync, opts: {
  targetType: "room" | "property";
  roomId?: string | null;
  propertyId: string;
  photoUrl?: string | null;
  photoIndex?: number | null;
}): { contextTitle: string; bodyPrefix: string; viewPath: string; shortId: string } {
  const prop = db.prepare(`SELECT title, city, post_mode FROM properties WHERE id = ?`).get(opts.propertyId) as
    | { title: string; city: string; post_mode: string }
    | undefined;
  const title = prop?.title?.trim() || "Anuncio";
  const city = prop?.city?.trim() || "";

  if (opts.targetType === "room" && opts.roomId) {
    const shortId = roomReferenceCode(opts.roomId);
    const viewPath = `/anuncio/${shortId}`;
    const room = db.prepare(`SELECT title FROM rooms WHERE id = ?`).get(opts.roomId) as { title: string } | undefined;
    const roomTitle = room?.title?.trim() || "Recámara";
    const contextTitle = `Reporte · ${shortId} · ${roomTitle}`.slice(0, 120);
    let bodyPrefix =
      `Reporte de anuncio (recámara)\n` +
      `Código: ${shortId}\n` +
      `URL: ${viewPath}\n` +
      `Propiedad: ${title}${city ? ` (${city})` : ""}\n` +
      `Recámara: ${roomTitle}\n`;
    if (opts.photoUrl) {
      bodyPrefix += `Foto reportada: #${(opts.photoIndex ?? 0) + 1}\nURL foto: ${opts.photoUrl}\n`;
    }
    return { contextTitle, bodyPrefix, viewPath, shortId };
  }

  const shortId = propertyReferenceCode(opts.propertyId);
  const viewPath = `/propiedad/${shortId}`;
  const contextTitle = `Reporte · ${shortId} · ${title}`.slice(0, 120);
  let bodyPrefix =
    `Reporte de anuncio (propiedad)\n` +
    `Código: ${shortId}\n` +
    `URL: ${viewPath}\n` +
    `Propiedad: ${title}${city ? ` (${city})` : ""}\n`;
  if (opts.photoUrl) {
    bodyPrefix += `Foto reportada: #${(opts.photoIndex ?? 0) + 1}\nURL foto: ${opts.photoUrl}\n`;
  }
  return { contextTitle, bodyPrefix, viewPath, shortId };
}

function buildChatReportContext(db: DatabaseSync, chatConversationId: string): {
  contextTitle: string;
  bodyPrefix: string;
} {
  const conv = db
    .prepare(`SELECT context_title, listing_room_id FROM conversations WHERE id = ?`)
    .get(chatConversationId) as { context_title: string; listing_room_id: string | null } | undefined;
  const contextTitle = `Reporte · Chat · ${(conv?.context_title ?? "Conversación").slice(0, 80)}`.slice(0, 120);
  const bodyPrefix =
    `Reporte de conversación privada\n` +
    `Conversación id: ${chatConversationId}\n` +
    (conv?.listing_room_id ? `Anuncio vinculado (room id): ${conv.listing_room_id}\n` : "");
  return { contextTitle, bodyPrefix };
}

function appendReportMessage(
  db: DatabaseSync,
  conversationId: string,
  senderUserId: string,
  body: string,
): void {
  const messageId = randomUUID();
  const now = isoNow();
  db.prepare(
    `INSERT INTO messages (id, conversation_id, sender_user_id, body, created_at, read_at, delivered_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?)`,
  ).run(messageId, conversationId, senderUserId, body, now, now);
  db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now, conversationId);
}

function reporterLabel(db: DatabaseSync, reporterUserId: string | null): string {
  if (!reporterUserId) return "Reportador desconocido";
  const row = db
    .prepare(`SELECT display_name, email FROM users WHERE id = ?`)
    .get(reporterUserId) as { display_name: string; email: string | null } | undefined;
  const name = row?.display_name?.trim() || "Usuario";
  const email = row?.email?.trim();
  return email ? `${name} (${email})` : name;
}

export function createOrAppendPostReport(
  db: DatabaseSync,
  opts: {
    reporterUserId: string | null;
    targetType: "room" | "property";
    roomId?: string | null;
    propertyId: string;
    categories: PostReportCategoryId[];
    detailText?: string | null;
    photoUrl?: string | null;
    photoIndex?: number | null;
  },
): { conversationId: string; postReportId: string; reportCount: number; created: boolean } {
  ensureReportBotUser(db);
  const now = isoNow();
  const detail = opts.detailText?.trim() || null;
  const existing = findPostReportByTarget(db, {
    type: opts.targetType,
    roomId: opts.roomId,
    propertyId: opts.propertyId,
  });

  const ctx = buildPostReportContext(db, opts);
  const reporterLine = reporterLabel(db, opts.reporterUserId);
  const eventBody =
    `${formatCategoryBlock(opts.categories, detail, false)}\n` +
    `————————————\n` +
    `${ctx.bodyPrefix}` +
    `Reportador: ${reporterLine}\n` +
    `— Reporte #${(existing?.reportCount ?? 0) + 1}`;

  if (existing) {
    db.prepare(
      `INSERT INTO post_report_events (id, post_report_id, reporter_user_id, categories_json, detail_text, photo_url, photo_index, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      randomUUID(),
      existing.id,
      opts.reporterUserId,
      JSON.stringify(opts.categories),
      detail,
      opts.photoUrl ?? null,
      opts.photoIndex ?? null,
      now,
    );
    const newCount = existing.reportCount + 1;
    db.prepare(
      `UPDATE post_reports SET report_count = ?, updated_at = ?, reviewed_at = NULL, reviewed_by_admin_id = NULL WHERE id = ?`,
    ).run(newCount, now, existing.id);
    appendReportMessage(
      db,
      existing.conversationId,
      opts.reporterUserId || REPORT_BOT_USER_ID,
      eventBody,
    );
    if (opts.reporterUserId) {
      db.prepare(
        `INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`,
      ).run(existing.conversationId, opts.reporterUserId);
    }
    scheduleNotifyPostReported(db, {
      postReportId: existing.id,
      conversationId: existing.conversationId,
      reportCount: newCount,
      targetType: opts.targetType,
      viewPath: ctx.viewPath,
      shortId: ctx.shortId,
      categories: opts.categories,
      detailText: detail,
      reporterLabel: reporterLine,
    });
    return {
      conversationId: existing.conversationId,
      postReportId: existing.id,
      reportCount: newCount,
      created: false,
    };
  }

  const postReportId = randomUUID();
  const conversationId = randomUUID();
  const publisherUserId = loadPublisherUserId(db, opts.propertyId);

  db.prepare(
    `INSERT INTO post_reports (
      id, conversation_id, target_type, target_room_id, target_property_id,
      target_chat_conversation_id, publisher_user_id, report_count, reviewed_at, reviewed_by_admin_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, 1, NULL, NULL, ?, ?)`,
  ).run(
    postReportId,
    conversationId,
    opts.targetType,
    opts.targetType === "room" ? opts.roomId ?? null : null,
    opts.propertyId,
    publisherUserId,
    now,
    now,
  );

  db.prepare(
    `INSERT INTO conversations (id, listing_room_id, context_title, kind, created_at, updated_at)
     VALUES (?, ?, ?, 'report', ?, ?)`,
  ).run(
    conversationId,
    opts.targetType === "room" ? opts.roomId ?? null : null,
    ctx.contextTitle,
    now,
    now,
  );

  db.prepare(
    `INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`,
  ).run(conversationId, REPORT_BOT_USER_ID);

  if (opts.reporterUserId) {
    db.prepare(
      `INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`,
    ).run(conversationId, opts.reporterUserId);
  }

  db.prepare(
    `INSERT INTO post_report_events (id, post_report_id, reporter_user_id, categories_json, detail_text, photo_url, photo_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    postReportId,
    opts.reporterUserId,
    JSON.stringify(opts.categories),
    detail,
    opts.photoUrl ?? null,
    opts.photoIndex ?? null,
    now,
  );

  appendReportMessage(db, conversationId, opts.reporterUserId || REPORT_BOT_USER_ID, eventBody);

  scheduleNotifyPostReported(db, {
    postReportId,
    conversationId,
    reportCount: 1,
    targetType: opts.targetType,
    viewPath: ctx.viewPath,
    shortId: ctx.shortId,
    categories: opts.categories,
    detailText: detail,
    reporterLabel: reporterLine,
  });

  return { conversationId, postReportId, reportCount: 1, created: true };
}

export function createOrAppendChatReport(
  db: DatabaseSync,
  opts: {
    reporterUserId: string;
    chatConversationId: string;
    categories: ChatReportCategoryId[];
    detailText?: string | null;
  },
): { conversationId: string; postReportId: string; reportCount: number; created: boolean } {
  ensureReportBotUser(db);
  const now = isoNow();
  const detail = opts.detailText?.trim() || null;
  const existing = findPostReportByTarget(db, {
    type: "chat",
    chatConversationId: opts.chatConversationId,
  });

  const ctx = buildChatReportContext(db, opts.chatConversationId);
  const reporterLine = reporterLabel(db, opts.reporterUserId);
  const eventBody =
    `${formatCategoryBlock(opts.categories, detail, true)}\n` +
    `————————————\n` +
    `${ctx.bodyPrefix}` +
    `Reportador: ${reporterLine}\n` +
    `— Reporte #${(existing?.reportCount ?? 0) + 1}`;

  if (existing) {
    db.prepare(
      `INSERT INTO post_report_events (id, post_report_id, reporter_user_id, categories_json, detail_text, photo_url, photo_index, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)`,
    ).run(randomUUID(), existing.id, opts.reporterUserId, JSON.stringify(opts.categories), detail, now);
    const newCount = existing.reportCount + 1;
    db.prepare(
      `UPDATE post_reports SET report_count = ?, updated_at = ?, reviewed_at = NULL, reviewed_by_admin_id = NULL WHERE id = ?`,
    ).run(newCount, now, existing.id);
    appendReportMessage(db, existing.conversationId, opts.reporterUserId, eventBody);
    scheduleNotifyPostReported(db, {
      postReportId: existing.id,
      conversationId: existing.conversationId,
      reportCount: newCount,
      targetType: "chat",
      viewPath: null,
      shortId: null,
      categories: opts.categories,
      detailText: detail,
      reporterLabel: reporterLine,
    });
    return {
      conversationId: existing.conversationId,
      postReportId: existing.id,
      reportCount: newCount,
      created: false,
    };
  }

  const postReportId = randomUUID();
  const conversationId = randomUUID();
  const listingRow = db
    .prepare(`SELECT listing_room_id FROM conversations WHERE id = ?`)
    .get(opts.chatConversationId) as { listing_room_id: string | null } | undefined;
  let publisherUserId: string | null = null;
  if (listingRow?.listing_room_id) {
    const propRow = db
      .prepare(
        `SELECT p.id FROM rooms r INNER JOIN properties p ON p.id = r.property_id WHERE r.id = ?`,
      )
      .get(listingRow.listing_room_id) as { id: string } | undefined;
    if (propRow) publisherUserId = loadPublisherUserId(db, propRow.id);
  }

  db.prepare(
    `INSERT INTO post_reports (
      id, conversation_id, target_type, target_room_id, target_property_id,
      target_chat_conversation_id, publisher_user_id, report_count, reviewed_at, reviewed_by_admin_id, created_at, updated_at
    ) VALUES (?, ?, 'chat', NULL, NULL, ?, ?, 1, NULL, NULL, ?, ?)`,
  ).run(postReportId, conversationId, opts.chatConversationId, publisherUserId, now, now);

  db.prepare(
    `INSERT INTO conversations (id, listing_room_id, context_title, kind, created_at, updated_at)
     VALUES (?, ?, ?, 'report', ?, ?)`,
  ).run(conversationId, listingRow?.listing_room_id ?? null, ctx.contextTitle, now, now);

  db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`).run(
    conversationId,
    REPORT_BOT_USER_ID,
  );
  db.prepare(
    `INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`,
  ).run(conversationId, opts.reporterUserId);

  db.prepare(
    `INSERT INTO post_report_events (id, post_report_id, reporter_user_id, categories_json, detail_text, photo_url, photo_index, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)`,
  ).run(randomUUID(), postReportId, opts.reporterUserId, JSON.stringify(opts.categories), detail, now);

  appendReportMessage(db, conversationId, opts.reporterUserId, eventBody);

  scheduleNotifyPostReported(db, {
    postReportId,
    conversationId,
    reportCount: 1,
    targetType: "chat",
    viewPath: null,
    shortId: null,
    categories: opts.categories,
    detailText: detail,
    reporterLabel: reporterLine,
  });

  return { conversationId, postReportId, reportCount: 1, created: true };
}

export function createPublisherBlockReportThread(
  db: DatabaseSync,
  publisherUserId: string,
): string {
  ensureReportBotUser(db);
  const now = isoNow();
  const conversationId = randomUUID();
  const postReportId = randomUUID();
  const user = db
    .prepare(`SELECT display_name, email FROM users WHERE id = ?`)
    .get(publisherUserId) as { display_name: string; email: string | null } | undefined;
  const label = user?.display_name?.trim() || "Usuario";

  db.prepare(
    `INSERT INTO post_reports (
      id, conversation_id, target_type, target_room_id, target_property_id,
      target_chat_conversation_id, publisher_user_id, report_count, reviewed_at, reviewed_by_admin_id, created_at, updated_at
    ) VALUES (?, ?, 'publisher_block', NULL, NULL, NULL, ?, 0, NULL, NULL, ?, ?)`,
  ).run(postReportId, conversationId, publisherUserId, now, now);

  db.prepare(
    `INSERT INTO conversations (id, listing_room_id, context_title, kind, created_at, updated_at)
     VALUES (?, NULL, ?, 'report', ?, ?)`,
  ).run(conversationId, `Bloqueo de publicación · ${label}`.slice(0, 120), now, now);

  db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`).run(
    conversationId,
    REPORT_BOT_USER_ID,
  );
  db.prepare(
    `INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`,
  ).run(conversationId, publisherUserId);

  appendReportMessage(
    db,
    conversationId,
    REPORT_BOT_USER_ID,
    `Tu cuenta fue bloqueada para publicar y contactar a otros usuarios por decisión del equipo de Bestie.\n` +
      `Si tienes preguntas, escribe aquí y un administrador te responderá.`,
  );

  return conversationId;
}

export function findReportThreadForPost(
  db: DatabaseSync,
  opts: { targetType: "room" | "property"; roomId?: string | null; propertyId: string },
): PostReportRow | null {
  return findPostReportByTarget(db, {
    type: opts.targetType,
    roomId: opts.roomId,
    propertyId: opts.propertyId,
  });
}

export function joinPublisherToReportThread(db: DatabaseSync, postReportId: string, publisherUserId: string): string {
  const row = db.prepare(`SELECT conversation_id FROM post_reports WHERE id = ?`).get(postReportId) as
    | { conversation_id: string }
    | undefined;
  if (!row) throw new Error("report_not_found");
  db.prepare(
    `INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`,
  ).run(row.conversation_id, publisherUserId);
  return row.conversation_id;
}

export function isUserPublisherBlocked(db: DatabaseSync, userId: string): boolean {
  const row = db
    .prepare(`SELECT publisher_blocked_at FROM users WHERE id = ?`)
    .get(userId) as { publisher_blocked_at: string | null } | undefined;
  return row?.publisher_blocked_at != null && String(row.publisher_blocked_at).trim() !== "";
}

export function blockPublisher(db: DatabaseSync, userId: string, adminId: string): void {
  const now = isoNow();
  db.prepare(
    `UPDATE users SET publisher_blocked_at = ?, publisher_blocked_by_admin_id = ? WHERE id = ?`,
  ).run(now, adminId, userId);

  const pub = db
    .prepare(`SELECT publisher_id FROM user_publishers WHERE user_id = ?`)
    .get(userId) as { publisher_id: string } | undefined;
  if (pub?.publisher_id) {
    db.prepare(
      `UPDATE properties SET status = 'paused', paused_by = 'admin' WHERE publisher_id = ? AND status != 'archived'`,
    ).run(pub.publisher_id);
    db.prepare(
      `UPDATE rooms SET status = 'paused', paused_by = 'admin', updated_at = CURRENT_TIMESTAMP
       WHERE property_id IN (SELECT id FROM properties WHERE publisher_id = ?) AND status != 'archived'`,
    ).run(pub.publisher_id);
  }
}

export function unblockPublisher(db: DatabaseSync, userId: string): void {
  db.prepare(
    `UPDATE users SET publisher_blocked_at = NULL, publisher_blocked_by_admin_id = NULL WHERE id = ?`,
  ).run(userId);
}

export function adminPauseProperty(db: DatabaseSync, propertyId: string): void {
  db.prepare(`UPDATE properties SET status = 'paused', paused_by = 'admin' WHERE id = ?`).run(propertyId);
  db.prepare(
    `UPDATE rooms SET status = 'paused', paused_by = 'admin', updated_at = CURRENT_TIMESTAMP WHERE property_id = ? AND status != 'archived'`,
  ).run(propertyId);
}

export function adminUnpauseProperty(db: DatabaseSync, propertyId: string): void {
  const now = isoNow();
  db.prepare(
    `UPDATE properties SET status = 'published', paused_by = NULL, published_at = COALESCE(published_at, ?) WHERE id = ?`,
  ).run(now, propertyId);
  db.prepare(
    `UPDATE rooms SET status = 'published', paused_by = NULL, updated_at = CURRENT_TIMESTAMP WHERE property_id = ? AND status = 'paused' AND paused_by = 'admin'`,
  ).run(propertyId);
}

export function approvePendingReviewProperty(db: DatabaseSync, propertyId: string): void {
  adminUnpauseProperty(db, propertyId);
}

export function submitPropertyForReview(db: DatabaseSync, propertyId: string): void {
  db.prepare(`UPDATE properties SET status = 'pending_review' WHERE id = ?`).run(propertyId);
  db.prepare(
    `UPDATE rooms SET status = 'pending_review', updated_at = CURRENT_TIMESTAMP WHERE property_id = ? AND status IN ('paused', 'pending_review')`,
  ).run(propertyId);
}

export function markReportReviewed(db: DatabaseSync, postReportId: string, adminId: string): void {
  const now = isoNow();
  db.prepare(
    `UPDATE post_reports SET reviewed_at = ?, reviewed_by_admin_id = ? WHERE id = ?`,
  ).run(now, adminId, postReportId);
}

export function flagReportAbuse(
  db: DatabaseSync,
  opts: { postReportId: string; reportEventId: string; reporterUserId: string; adminId: string },
): void {
  db.prepare(
    `INSERT INTO report_abuse_flags (id, post_report_id, report_event_id, reporter_user_id, flagged_by_admin_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), opts.postReportId, opts.reportEventId, opts.reporterUserId, opts.adminId, isoNow());
}

export type ReportStats = {
  reportsAgainstPost: number;
  reportsAgainstPublisherPosts: number;
  postsReportedForPublisher: number;
  reportsFiledByUser: number;
  abuseFlagsForReporter: number;
};

export function loadReportStats(db: DatabaseSync, opts: {
  postReportId?: string;
  publisherUserId?: string | null;
  reporterUserId?: string | null;
}): ReportStats {
  let reportsAgainstPost = 0;
  if (opts.postReportId) {
    const row = db
      .prepare(`SELECT report_count FROM post_reports WHERE id = ?`)
      .get(opts.postReportId) as { report_count: number } | undefined;
    reportsAgainstPost = row?.report_count ?? 0;
  }

  let reportsAgainstPublisherPosts = 0;
  let postsReportedForPublisher = 0;
  if (opts.publisherUserId) {
    const agg = db
      .prepare(
        `SELECT COALESCE(SUM(report_count), 0) AS total, COUNT(*) AS posts
         FROM post_reports
         WHERE publisher_user_id = ? AND target_type IN ('room', 'property')`,
      )
      .get(opts.publisherUserId) as { total: number; posts: number };
    reportsAgainstPublisherPosts = Number(agg?.total ?? 0);
    postsReportedForPublisher = Number(agg?.posts ?? 0);
  }

  let reportsFiledByUser = 0;
  let abuseFlagsForReporter = 0;
  if (opts.reporterUserId) {
    reportsFiledByUser = (
      db
        .prepare(`SELECT COUNT(*) AS c FROM post_report_events WHERE reporter_user_id = ?`)
        .get(opts.reporterUserId) as { c: number }
    ).c;
    abuseFlagsForReporter = (
      db
        .prepare(`SELECT COUNT(*) AS c FROM report_abuse_flags WHERE reporter_user_id = ?`)
        .get(opts.reporterUserId) as { c: number }
    ).c;
  }

  return {
    reportsAgainstPost,
    reportsAgainstPublisherPosts,
    postsReportedForPublisher,
    reportsFiledByUser,
    abuseFlagsForReporter,
  };
}

export function countUnreviewedReportedPosts(db: DatabaseSync): number {
  return (
    db
      .prepare(
        `SELECT COUNT(DISTINCT COALESCE(target_property_id, target_room_id)) AS c
         FROM post_reports
         WHERE target_type IN ('room', 'property')
           AND reviewed_at IS NULL`,
      )
      .get() as { c: number }
  ).c;
}

export function loadPostReportByConversationId(db: DatabaseSync, conversationId: string): PostReportRow | null {
  const row = db
    .prepare(`SELECT * FROM post_reports WHERE conversation_id = ?`)
    .get(conversationId) as Record<string, unknown> | undefined;
  return row ? mapPostReportRow(row) : null;
}

export function loadReportEvents(db: DatabaseSync, postReportId: string) {
  return db
    .prepare(
      `SELECT id, reporter_user_id, categories_json, detail_text, photo_url, photo_index, created_at
       FROM post_report_events WHERE post_report_id = ? ORDER BY created_at ASC`,
    )
    .all(postReportId) as {
    id: string;
    reporter_user_id: string | null;
    categories_json: string;
    detail_text: string | null;
    photo_url: string | null;
    photo_index: number | null;
    created_at: string;
  }[];
}

export function adminReportThreadUrl(conversationId: string): string {
  return `${publicBaseUrl()}/admin/soporte?c=${encodeURIComponent(conversationId)}`;
}

export function notifyPublisherInReportThread(
  db: DatabaseSync,
  conversationId: string,
  body: string,
): void {
  appendReportMessage(db, conversationId, REPORT_BOT_USER_ID, body);
}

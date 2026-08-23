import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

/** Fixed system account for blog comment report threads in admin Soporte. */
export const BLOG_BOT_USER_ID = "blog-bestie";
export const BLOG_BOT_DISPLAY_NAME = "Blog de Bestie";
const BLOG_BOT_EMAIL = "blog-sistema@bestie.mx";
const SYSTEM_BOT_PASSWORD_MARKER = "system-support-account-no-login";

export function ensureBlogBotUser(db: DatabaseSync): void {
  const row = db.prepare(`SELECT 1 AS x FROM users WHERE id = ?`).get(BLOG_BOT_USER_ID) as
    | { x: number }
    | undefined;
  if (row) return;
  db.prepare(
    `INSERT INTO users (id, email, email_canonical, phone_e164, password_hash, display_name, created_at, email_verified_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`,
  ).run(
    BLOG_BOT_USER_ID,
    BLOG_BOT_EMAIL,
    BLOG_BOT_EMAIL,
    SYSTEM_BOT_PASSWORD_MARKER,
    BLOG_BOT_DISPLAY_NAME,
    new Date().toISOString(),
    null,
  );
}

export function ensureBlogBotParticipant(_db: DatabaseSync): void {
  /* reserved */
}

export function createBlogCommentReportConversation(
  db: DatabaseSync,
  opts: {
    reporterUserId: string | null;
    comment: {
      id: string;
      article_id: string;
      user_id: string;
      body: string;
      display_name: string | null;
      email: string | null;
      article_title: string;
      slug: string;
      city_code: string | null;
    };
    reason: string;
  },
): string {
  ensureBlogBotUser(db);
  const conversationId = randomUUID();
  const now = new Date().toISOString();
  const path =
    opts.comment.city_code === "gdl"
      ? `/blog/gdl/${opts.comment.slug}`
      : `/blog/${opts.comment.slug}`;

  db.prepare(
    `INSERT INTO conversations (id, listing_room_id, context_title, kind, created_at, updated_at)
     VALUES (?, NULL, ?, 'blog', ?, ?)`,
  ).run(conversationId, `Blog · ${opts.comment.article_title}`.slice(0, 120), now, now);

  db.prepare(
    `INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`,
  ).run(conversationId, BLOG_BOT_USER_ID);

  if (opts.reporterUserId) {
    db.prepare(
      `INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`,
    ).run(conversationId, opts.reporterUserId);
  }

  const body =
    `Reporte de comentario en el blog\n` +
    `Artículo: ${opts.comment.article_title}\n` +
    `URL: ${path}\n` +
    `Comentario id: ${opts.comment.id}\n` +
    `Autor: ${opts.comment.display_name || "Usuario"} (${opts.comment.email || opts.comment.user_id})\n` +
    `Texto: ${opts.comment.body}\n` +
    `Motivo: ${opts.reason}`;

  db.prepare(
    `INSERT INTO messages (id, conversation_id, sender_user_id, body, created_at, read_at, delivered_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?)`,
  ).run(
    randomUUID(),
    conversationId,
    opts.reporterUserId || BLOG_BOT_USER_ID,
    body,
    now,
    now,
  );

  return conversationId;
}

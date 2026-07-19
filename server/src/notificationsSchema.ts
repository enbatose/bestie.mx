import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

function tableHasColumn(db: DatabaseSync, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

/** In-app notifications (bell) + columns used by message digest emails. */
export function ensureNotificationsSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      link TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      read_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at);
  `);

  if (!tableHasColumn(db, "users", "last_message_digest_at")) {
    db.exec(`ALTER TABLE users ADD COLUMN last_message_digest_at TEXT`);
  }
}

export type NotificationRow = {
  id: string;
  user_id: string;
  text: string;
  link: string;
  created_at: string;
  read_at: string | null;
};

export function createNotification(
  db: DatabaseSync,
  input: { userId: string; text: string; link?: string; id?: string },
): NotificationRow {
  const id = input.id ?? randomUUID();
  const now = new Date().toISOString();
  const link = (input.link ?? "").trim().slice(0, 500);
  const text = input.text.trim().slice(0, 500);
  db.prepare(
    `INSERT INTO notifications (id, user_id, text, link, created_at, read_at) VALUES (?, ?, ?, ?, ?, NULL)`,
  ).run(id, input.userId, text, link, now);
  return {
    id,
    user_id: input.userId,
    text,
    link,
    created_at: now,
    read_at: null,
  };
}

export function userIdForPublisher(db: DatabaseSync, publisherId: string): string | null {
  const row = db
    .prepare(`SELECT user_id FROM user_publishers WHERE publisher_id = ? LIMIT 1`)
    .get(publisherId) as { user_id: string } | undefined;
  return row?.user_id ?? null;
}

export function notifyUser(
  db: DatabaseSync,
  input: { userId: string; text: string; link?: string },
): void {
  if (!input.userId || !input.text.trim()) return;
  try {
    createNotification(db, input);
  } catch (e) {
    console.error("[notifications] create failed:", e instanceof Error ? e.message : e);
  }
}

export function notifyPublisher(
  db: DatabaseSync,
  publisherId: string,
  input: { text: string; link?: string },
): void {
  const userId = userIdForPublisher(db, publisherId);
  if (!userId) return;
  notifyUser(db, { userId, ...input });
}

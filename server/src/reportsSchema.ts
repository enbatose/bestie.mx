import type { DatabaseSync } from "node:sqlite";
import { ensureReportBotUser } from "./listingReports.js";

function tableHasColumn(db: DatabaseSync, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

export type ReportTargetType = "room" | "property" | "chat" | "publisher_block";

/** Reports, events, abuse flags, pause/block columns. */
export function ensureReportsSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS post_reports (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL UNIQUE,
      target_type TEXT NOT NULL,
      target_room_id TEXT,
      target_property_id TEXT,
      target_chat_conversation_id TEXT,
      publisher_user_id TEXT,
      report_count INTEGER NOT NULL DEFAULT 1,
      reviewed_at TEXT,
      reviewed_by_admin_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_post_reports_room ON post_reports(target_room_id) WHERE target_room_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_post_reports_property ON post_reports(target_property_id) WHERE target_property_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_post_reports_chat ON post_reports(target_chat_conversation_id) WHERE target_chat_conversation_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_post_reports_reviewed ON post_reports(reviewed_at);

    CREATE TABLE IF NOT EXISTS post_report_events (
      id TEXT PRIMARY KEY,
      post_report_id TEXT NOT NULL,
      reporter_user_id TEXT,
      categories_json TEXT NOT NULL,
      detail_text TEXT,
      photo_url TEXT,
      photo_index INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (post_report_id) REFERENCES post_reports(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_post_report_events_report ON post_report_events(post_report_id);
    CREATE INDEX IF NOT EXISTS idx_post_report_events_reporter ON post_report_events(reporter_user_id);

    CREATE TABLE IF NOT EXISTS report_abuse_flags (
      id TEXT PRIMARY KEY,
      post_report_id TEXT NOT NULL,
      report_event_id TEXT NOT NULL,
      reporter_user_id TEXT NOT NULL,
      flagged_by_admin_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (post_report_id) REFERENCES post_reports(id) ON DELETE CASCADE,
      FOREIGN KEY (report_event_id) REFERENCES post_report_events(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_report_abuse_reporter ON report_abuse_flags(reporter_user_id);
  `);

  if (!tableHasColumn(db, "properties", "paused_by")) {
    db.exec(`ALTER TABLE properties ADD COLUMN paused_by TEXT`);
  }
  if (!tableHasColumn(db, "rooms", "paused_by")) {
    db.exec(`ALTER TABLE rooms ADD COLUMN paused_by TEXT`);
  }
  if (!tableHasColumn(db, "users", "publisher_blocked_at")) {
    db.exec(`ALTER TABLE users ADD COLUMN publisher_blocked_at TEXT`);
  }
  if (!tableHasColumn(db, "users", "publisher_blocked_by_admin_id")) {
    db.exec(`ALTER TABLE users ADD COLUMN publisher_blocked_by_admin_id TEXT`);
  }

  ensureReportBotUser(db);
}

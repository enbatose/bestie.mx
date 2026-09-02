import type { DatabaseSync } from "node:sqlite";
import { countAdminUsersSegment } from "./adminUsers.js";
import { FEEDBACK_BOT_USER_ID, SUPPORT_BOT_USER_ID, DELETED_USER_ID } from "./messagingSchema.js";
import { BLOG_BOT_USER_ID } from "./blogReports.js";
import { REPORT_BOT_USER_ID } from "./listingReports.js";

import { countUnreviewedReportedPosts } from "./listingReports.js";

export type AdminNavCounts = {
  verifiedUsers: number;
  publishedPosts: number;
  unreadSupportMessages: number;
  unreviewedReportedPosts: number;
};

function countPublishedPosts(db: DatabaseSync): number {
  return (db.prepare(`SELECT COUNT(*) AS c FROM properties WHERE status = 'published'`).get() as { c: number }).c;
}

/** Unread inbound customer messages in support + feedback threads. */
function countUnreadSupportMessages(db: DatabaseSync): number {
  return (
    db
      .prepare(
        `SELECT COUNT(*) AS c
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         JOIN conversation_participants cp ON cp.conversation_id = c.id
           AND cp.user_id NOT IN (?, ?, ?, ?, ?)
         WHERE c.kind IN ('support', 'feedback', 'blog', 'report')
           AND m.sender_user_id = cp.user_id
           AND m.read_at IS NULL`,
      )
      .get(SUPPORT_BOT_USER_ID, FEEDBACK_BOT_USER_ID, BLOG_BOT_USER_ID, REPORT_BOT_USER_ID, DELETED_USER_ID) as { c: number }
  ).c;
}

export function getAdminNavCounts(db: DatabaseSync): AdminNavCounts {
  return {
    verifiedUsers: countAdminUsersSegment(db, "real"),
    publishedPosts: countPublishedPosts(db),
    unreadSupportMessages: countUnreadSupportMessages(db),
    unreviewedReportedPosts: countUnreviewedReportedPosts(db),
  };
}

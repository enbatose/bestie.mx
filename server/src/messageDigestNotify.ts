import type { DatabaseSync } from "node:sqlite";
import {
  formatFriendlyEmailDateTime,
  mexicoCityTimeZone,
  resolveTimeZoneForConversation,
  resolveTimeZoneForListingCity,
} from "./emails/emailDateTime.js";
import { buildMessageDigestEmail } from "./emails/messageDigestEmail.js";
import { isUserEmailVerified } from "./emailVerification.js";
import { sendTransactionalEmail } from "./mailer.js";
import { SUPPORT_BOT_USER_ID } from "./messagingSchema.js";

/** Minimum interval between message digest emails (aggregates activity in this window). */
export const MESSAGE_DIGEST_DEBOUNCE_MS = 3 * 60 * 60 * 1000;

function isoNow(): string {
  return new Date().toISOString();
}

function loadUserForDigest(
  db: DatabaseSync,
  userId: string,
): { email: string; displayName: string; lastDigestAt: string | null } | null {
  const row = db
    .prepare(
      `SELECT email, email_verified_at, display_name, last_message_digest_at FROM users WHERE id = ?`,
    )
    .get(userId) as
    | {
        email: string | null;
        email_verified_at: string | null;
        display_name: string;
        last_message_digest_at: string | null;
      }
    | undefined;
  const email = row?.email?.trim();
  if (!email || !isUserEmailVerified(row?.email_verified_at)) return null;
  return {
    email,
    displayName: row?.display_name ?? "",
    lastDigestAt: row?.last_message_digest_at ?? null,
  };
}

function unreadMessageCount(db: DatabaseSync, userId: string): number {
  return (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM messages m
         JOIN conversation_participants p ON p.conversation_id = m.conversation_id AND p.user_id = ?
         WHERE m.sender_user_id != ? AND m.read_at IS NULL`,
      )
      .get(userId, userId) as { n: number }
  ).n;
}

type UnreadMessageRow = {
  created_at: string;
  kind: string | null;
  context_title: string | null;
  city: string | null;
};

function unreadMessagesForDigest(db: DatabaseSync, userId: string): UnreadMessageRow[] {
  return db
    .prepare(
      `SELECT m.created_at AS created_at,
              c.kind AS kind,
              c.context_title AS context_title,
              p.city AS city
       FROM messages m
       JOIN conversation_participants part
         ON part.conversation_id = m.conversation_id AND part.user_id = ?
       JOIN conversations c ON c.id = m.conversation_id
       LEFT JOIN rooms r ON r.id = c.listing_room_id
       LEFT JOIN properties p ON p.id = r.property_id
       WHERE m.sender_user_id != ? AND m.read_at IS NULL
       ORDER BY m.created_at DESC
       LIMIT 12`,
    )
    .all(userId, userId) as UnreadMessageRow[];
}

type NotificationRow = { text: string; link: string; created_at: string };

function notificationsSince(db: DatabaseSync, userId: string, sinceIso: string | null): NotificationRow[] {
  if (sinceIso) {
    return db
      .prepare(
        `SELECT text, link, created_at FROM notifications
         WHERE user_id = ? AND created_at > ?
         ORDER BY created_at DESC LIMIT 10`,
      )
      .all(userId, sinceIso) as NotificationRow[];
  }
  return db
    .prepare(
      `SELECT text, link, created_at FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 10`,
    )
    .all(userId) as NotificationRow[];
}

function cityForRoomId(db: DatabaseSync, roomId: string): string | null {
  const row = db
    .prepare(
      `SELECT p.city AS city
       FROM rooms r INNER JOIN properties p ON p.id = r.property_id
       WHERE r.id = ?`,
    )
    .get(roomId) as { city: string } | undefined;
  return row?.city?.trim() || null;
}

/** Best-effort city for a notification link that points at a listing/room. */
function cityForNotificationLink(db: DatabaseSync, link: string): string | null {
  const raw = (link || "").trim();
  if (!raw) return null;
  let path = raw;
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      path = new URL(raw).pathname;
    }
  } catch {
    path = raw;
  }
  const m = path.match(/\/(?:anuncio|propiedad)\/([^/?#]+)/i);
  if (!m?.[1]) return null;
  const id = decodeURIComponent(m[1]);
  const fromRoom = cityForRoomId(db, id);
  if (fromRoom) return fromRoom;
  const prop = db
    .prepare(`SELECT city FROM properties WHERE id = ?`)
    .get(id) as { city: string } | undefined;
  return prop?.city?.trim() || null;
}

function candidateUserIds(db: DatabaseSync): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT p.user_id AS user_id
       FROM conversation_participants p
       JOIN messages m ON m.conversation_id = p.conversation_id
       WHERE m.sender_user_id != p.user_id
         AND m.read_at IS NULL
         AND p.user_id != ?`,
    )
    .all(SUPPORT_BOT_USER_ID) as { user_id: string }[];
  return rows.map((r) => r.user_id);
}

function canSendDigest(lastDigestAt: string | null, nowMs: number): boolean {
  if (!lastDigestAt) return true;
  const last = Date.parse(lastDigestAt);
  if (!Number.isFinite(last)) return true;
  return nowMs - last >= MESSAGE_DIGEST_DEBOUNCE_MS;
}

export async function sendMessageDigestForUser(db: DatabaseSync, userId: string): Promise<boolean> {
  if (userId === SUPPORT_BOT_USER_ID) return false;
  const user = loadUserForDigest(db, userId);
  if (!user) return false;

  const nowMs = Date.now();
  if (!canSendDigest(user.lastDigestAt, nowMs)) return false;

  const unread = unreadMessageCount(db, userId);
  if (unread <= 0) return false;

  const now = new Date(nowMs);
  const messageRows = unreadMessagesForDigest(db, userId).map((row) => {
    const tz = resolveTimeZoneForConversation({ kind: row.kind, city: row.city });
    const title = (row.context_title || "").trim() || (row.kind === "support" ? "Soporte Bestie" : "Mensaje");
    return {
      contextTitle: title,
      whenLabel: formatFriendlyEmailDateTime(row.created_at, tz, now),
    };
  });

  const notifications = notificationsSince(db, userId, user.lastDigestAt).map((n) => {
    const city = cityForNotificationLink(db, n.link);
    const tz = city ? resolveTimeZoneForListingCity(city) : mexicoCityTimeZone();
    return {
      text: n.text,
      link: n.link,
      whenLabel: formatFriendlyEmailDateTime(n.created_at, tz, now),
    };
  });

  const built = buildMessageDigestEmail({
    displayName: user.displayName,
    unreadMessageCount: unread,
    messages: messageRows,
    notifications,
  });

  const sent = await sendTransactionalEmail({
    to: user.email,
    subject: built.subject,
    html: built.html,
    text: built.text,
    previewText: built.previewText,
    replyTo: built.replyTo,
    tags: built.tags,
  });
  if (!sent) return false;

  db.prepare(`UPDATE users SET last_message_digest_at = ? WHERE id = ?`).run(isoNow(), userId);
  return true;
}

/** Poll users with unread inbound messages and send throttled digests. */
export async function pollMessageDigests(db: DatabaseSync): Promise<void> {
  for (const userId of candidateUserIds(db)) {
    try {
      await sendMessageDigestForUser(db, userId);
    } catch (e) {
      console.error(
        `[message-digest] failed user=${userId}:`,
        e instanceof Error ? e.message : e,
      );
    }
  }
}

export function startMessageDigestPollWorker(db: DatabaseSync): () => void {
  const raw = Number(process.env.MESSAGE_DIGEST_POLL_MS);
  const ms = Number.isFinite(raw) && raw >= 30_000 ? raw : 5 * 60 * 1000;
  // Kick once shortly after boot so first unread messages are not stuck until the next interval.
  const kick = setTimeout(() => {
    void pollMessageDigests(db);
  }, 15_000);
  const t = setInterval(() => {
    void pollMessageDigests(db);
  }, ms);
  return () => {
    clearTimeout(kick);
    clearInterval(t);
  };
}

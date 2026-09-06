import type { DatabaseSync } from "node:sqlite";
import {
  formatFriendlyEmailDateTime,
  MEXICO_CITY_TZ,
  mexicoCityTimeZone,
  resolveTimeZoneForConversation,
  resolveTimeZoneForListingCity,
} from "./emails/emailDateTime.js";
import { buildMessageDigestEmail } from "./emails/messageDigestEmail.js";
import { isUserEmailVerified } from "./emailVerification.js";
import {
  bundlePendingFirstSeekerNotifies,
  bundledUnsentFirstSeekerNotifies,
  publisherIdsWithFirstSeekerSmsRetry,
  sendBundledFirstSeekerSms,
  unbundledFirstSeekerNotifies,
} from "./listingFirstSeekerNotify.js";
import { sendTransactionalEmail } from "./mailer.js";
import { FEEDBACK_BOT_USER_ID, SUPPORT_BOT_USER_ID, isSystemMessagingBot } from "./messagingSchema.js";
import { isNotifyQuietHours } from "./notifyQuietHours.js";

/** Minimum interval between message digest emails (aggregates activity in this window). */
export const MESSAGE_DIGEST_DEBOUNCE_MS = 3 * 60 * 60 * 1000;

function isoFromMs(ms: number): string {
  return new Date(ms).toISOString();
}

function loadUserForNotify(
  db: DatabaseSync,
  userId: string,
): { email: string | null; emailVerified: boolean; displayName: string; lastDigestAt: string | null } | null {
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
  if (!row) return null;
  const email = row.email?.trim() || null;
  return {
    email,
    emailVerified: Boolean(email) && isUserEmailVerified(row.email_verified_at),
    displayName: row.display_name ?? "",
    lastDigestAt: row.last_message_digest_at ?? null,
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
  const prop = db.prepare(`SELECT city FROM properties WHERE id = ?`).get(id) as { city: string } | undefined;
  return prop?.city?.trim() || null;
}

function candidateUserIds(db: DatabaseSync): string[] {
  const unread = db
    .prepare(
      `SELECT DISTINCT p.user_id AS user_id
       FROM conversation_participants p
       JOIN messages m ON m.conversation_id = p.conversation_id
       WHERE m.sender_user_id != p.user_id
         AND m.read_at IS NULL
         AND p.user_id NOT IN (?, ?)`,
    )
    .all(SUPPORT_BOT_USER_ID, FEEDBACK_BOT_USER_ID) as { user_id: string }[];
  const ids = new Set(unread.map((r) => r.user_id));
  for (const id of publisherIdsWithFirstSeekerSmsRetry(db)) ids.add(id);
  return [...ids];
}

export function canSendDigest(lastDigestAt: string | null, nowMs: number): boolean {
  if (!lastDigestAt) return true;
  const last = Date.parse(lastDigestAt);
  if (!Number.isFinite(last)) return true;
  return nowMs - last >= MESSAGE_DIGEST_DEBOUNCE_MS;
}

/** Listing city of the newest unread inbound message; else Mexico City. */
export function resolveNotifyTimeZone(db: DatabaseSync, userId: string): string {
  const row = unreadMessagesForDigest(db, userId).find((m) => (m.city || "").trim());
  if (row?.city?.trim()) return resolveTimeZoneForListingCity(row.city).timeZone;
  return MEXICO_CITY_TZ;
}

async function sendDigestEmail(
  db: DatabaseSync,
  userId: string,
  user: { email: string; displayName: string; lastDigestAt: string | null },
  unread: number,
  now: Date,
): Promise<boolean> {
  const messageRows = unreadMessagesForDigest(db, userId).map((row) => {
    const tz = resolveTimeZoneForConversation({ kind: row.kind, city: row.city });
    const title =
      (row.context_title || "").trim() ||
      (row.kind === "support" ? "Soporte Bestie" : row.kind === "feedback" ? "Feedback Bestie" : "Mensaje");
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

  return sendTransactionalEmail({
    to: user.email,
    subject: built.subject,
    html: built.html,
    text: built.text,
    previewText: built.previewText,
    replyTo: built.replyTo,
    tags: built.tags,
  });
}

/**
 * Email digest (3h) + first-seeker SMS, respecting listing-local quiet hours.
 * In-app bells are not gated here.
 */
export async function sendMessageDigestForUser(
  db: DatabaseSync,
  userId: string,
  now: Date = new Date(),
): Promise<boolean> {
  if (isSystemMessagingBot(userId)) return false;
  const user = loadUserForNotify(db, userId);
  if (!user) return false;

  const tz = resolveNotifyTimeZone(db, userId);
  if (isNotifyQuietHours(now, tz)) return false;

  const nowMs = now.getTime();
  const unread = unreadMessageCount(db, userId);
  const canDigest = unread > 0 && canSendDigest(user.lastDigestAt, nowMs);
  const nowIso = isoFromMs(nowMs);

  if (canDigest) {
    let emailed = false;
    if (user.emailVerified && user.email) {
      emailed = await sendDigestEmail(
        db,
        userId,
        { email: user.email, displayName: user.displayName, lastDigestAt: user.lastDigestAt },
        unread,
        now,
      );
      if (!emailed) return false;
    }
    const pendingSms =
      unbundledFirstSeekerNotifies(db, userId).length > 0 ||
      bundledUnsentFirstSeekerNotifies(db, userId).length > 0;
    if (!emailed && !pendingSms) return false;

    db.prepare(`UPDATE users SET last_message_digest_at = ? WHERE id = ?`).run(nowIso, userId);
    bundlePendingFirstSeekerNotifies(db, userId, nowIso);
    const smsed = await sendBundledFirstSeekerSms(db, userId, nowIso);
    return emailed || smsed;
  }

  return sendBundledFirstSeekerSms(db, userId, nowIso);
}

/** Poll users with unread inbound messages and send throttled digests. */
export async function pollMessageDigests(db: DatabaseSync, now: Date = new Date()): Promise<void> {
  for (const userId of candidateUserIds(db)) {
    try {
      await sendMessageDigestForUser(db, userId, now);
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

import type { DatabaseSync } from "node:sqlite";
import { listingFirstMessagePublisherCopy } from "./listingContactEvents.js";
import {
  buildListingFirstSeekerSms,
  listingFirstSeekerSmsEnabled,
} from "./listingFirstSeekerSms.js";
import { notifyUser } from "./notificationsSchema.js";
import { isPhoneVerifiedAt } from "./phoneAuth.js";
import { smsMasivosConfigured, smsMasivosSendSms } from "./smsMasivosOtp.js";

export function ensureListingFirstSeekerNotifySchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS listing_first_seeker_notifies (
      publisher_user_id TEXT NOT NULL,
      seeker_user_id TEXT NOT NULL,
      listing_title TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      bundled_at TEXT,
      sms_sent_at TEXT,
      PRIMARY KEY (publisher_user_id, seeker_user_id),
      FOREIGN KEY (publisher_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (seeker_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_first_seeker_sms_retry
      ON listing_first_seeker_notifies(publisher_user_id, bundled_at, sms_sent_at);
  `);
}

function seekerDisplayName(db: DatabaseSync, userId: string): string {
  const row = db.prepare(`SELECT display_name FROM users WHERE id = ?`).get(userId) as
    | { display_name: string | null }
    | undefined;
  const t = String(row?.display_name ?? "").trim();
  return t || "un usuario de Bestie";
}

function priorListingMessagesToPublisher(
  db: DatabaseSync,
  opts: { publisherUserId: string; seekerUserId: string; excludeMessageId: string },
): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       JOIN conversation_participants pub
         ON pub.conversation_id = c.id AND pub.user_id = ?
       WHERE COALESCE(c.kind, 'listing') = 'listing'
         AND m.sender_user_id = ?
         AND m.id != ?`,
    )
    .get(opts.publisherUserId, opts.seekerUserId, opts.excludeMessageId) as { c: number };
  return Number(row?.c ?? 0);
}

export type RecordFirstSeekerResult = {
  isFirst: boolean;
  publisherUserId: string;
};

/** First listing chat from this seeker to this publisher: in-app bell + pending SMS row. */
export function recordFirstSeekerListingMessage(
  db: DatabaseSync,
  opts: {
    publisherUserId: string;
    seekerUserId: string;
    listingTitle: string;
    excludeMessageId: string;
  },
): RecordFirstSeekerResult {
  const publisherUserId = opts.publisherUserId.trim();
  const seekerUserId = opts.seekerUserId.trim();
  if (!publisherUserId || !seekerUserId || publisherUserId === seekerUserId) {
    return { isFirst: false, publisherUserId };
  }
  const prior = priorListingMessagesToPublisher(db, {
    publisherUserId,
    seekerUserId,
    excludeMessageId: opts.excludeMessageId,
  });
  if (prior > 0) return { isFirst: false, publisherUserId };

  const now = new Date().toISOString();
  const title = String(opts.listingTitle ?? "").trim().slice(0, 500);
  const info = db
    .prepare(
      `INSERT OR IGNORE INTO listing_first_seeker_notifies
        (publisher_user_id, seeker_user_id, listing_title, created_at, bundled_at, sms_sent_at)
       VALUES (?, ?, ?, ?, NULL, ?)`,
    )
    .run(
      publisherUserId,
      seekerUserId,
      title,
      now,
      listingFirstSeekerSmsEnabled() && smsMasivosConfigured() ? null : now,
    );
  if (Number(info.changes) <= 0) return { isFirst: false, publisherUserId };

  notifyUser(db, {
    userId: publisherUserId,
    text: listingFirstMessagePublisherCopy({
      seekerName: seekerDisplayName(db, seekerUserId),
      listingTitle: title || "tu anuncio",
    }),
    link: "/mensajes",
  });
  return { isFirst: true, publisherUserId };
}

export type PendingFirstSeekerRow = {
  seekerUserId: string;
  seekerName: string;
  listingTitle: string;
  createdAt: string;
};

export function unbundledFirstSeekerNotifies(
  db: DatabaseSync,
  publisherUserId: string,
): PendingFirstSeekerRow[] {
  return db
    .prepare(
      `SELECT n.seeker_user_id AS seekerUserId,
              n.listing_title AS listingTitle,
              n.created_at AS createdAt,
              u.display_name AS seekerName
       FROM listing_first_seeker_notifies n
       JOIN users u ON u.id = n.seeker_user_id
       WHERE n.publisher_user_id = ?
         AND n.sms_sent_at IS NULL
         AND n.bundled_at IS NULL
       ORDER BY n.created_at ASC`,
    )
    .all(publisherUserId) as PendingFirstSeekerRow[];
}

export function bundledUnsentFirstSeekerNotifies(
  db: DatabaseSync,
  publisherUserId: string,
): PendingFirstSeekerRow[] {
  return db
    .prepare(
      `SELECT n.seeker_user_id AS seekerUserId,
              n.listing_title AS listingTitle,
              n.created_at AS createdAt,
              u.display_name AS seekerName
       FROM listing_first_seeker_notifies n
       JOIN users u ON u.id = n.seeker_user_id
       WHERE n.publisher_user_id = ?
         AND n.sms_sent_at IS NULL
         AND n.bundled_at IS NOT NULL
       ORDER BY n.created_at ASC`,
    )
    .all(publisherUserId) as PendingFirstSeekerRow[];
}

export function bundlePendingFirstSeekerNotifies(
  db: DatabaseSync,
  publisherUserId: string,
  bundledAtIso: string,
): void {
  db.prepare(
    `UPDATE listing_first_seeker_notifies
     SET bundled_at = ?
     WHERE publisher_user_id = ? AND sms_sent_at IS NULL AND bundled_at IS NULL`,
  ).run(bundledAtIso, publisherUserId);
}

export function markFirstSeekerSmsSent(
  db: DatabaseSync,
  publisherUserId: string,
  sentAtIso: string,
): void {
  db.prepare(
    `UPDATE listing_first_seeker_notifies
     SET sms_sent_at = ?
     WHERE publisher_user_id = ? AND sms_sent_at IS NULL AND bundled_at IS NOT NULL`,
  ).run(sentAtIso, publisherUserId);
}

export function publisherIdsWithFirstSeekerSmsRetry(db: DatabaseSync): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT publisher_user_id AS user_id
       FROM listing_first_seeker_notifies
       WHERE bundled_at IS NOT NULL AND sms_sent_at IS NULL`,
    )
    .all() as { user_id: string }[];
  return rows.map((r) => r.user_id);
}

function publisherCanReceiveNotifySms(
  db: DatabaseSync,
  publisherUserId: string,
): { phoneE164: string } | null {
  const row = db
    .prepare(
      `SELECT phone_e164, phone_verified_at, phone_notify_opt_in FROM users WHERE id = ?`,
    )
    .get(publisherUserId) as
    | { phone_e164: string | null; phone_verified_at: string | null; phone_notify_opt_in: number | null }
    | undefined;
  if (!row) return null;
  if (Number(row.phone_notify_opt_in ?? 1) === 0) return null;
  if (!isPhoneVerifiedAt(row.phone_verified_at)) return null;
  const phone = String(row.phone_e164 ?? "").trim();
  if (!phone) return null;
  return { phoneE164: phone };
}

/** Send SMS for seekers already bundled with a digest. Marks sent on success or when undeliverable. */
export async function sendBundledFirstSeekerSms(
  db: DatabaseSync,
  publisherUserId: string,
  nowIso: string,
): Promise<boolean> {
  const pending = bundledUnsentFirstSeekerNotifies(db, publisherUserId);
  if (pending.length === 0) return false;

  if (!listingFirstSeekerSmsEnabled() || !smsMasivosConfigured()) {
    markFirstSeekerSmsSent(db, publisherUserId, nowIso);
    return false;
  }

  const dest = publisherCanReceiveNotifySms(db, publisherUserId);
  if (!dest) {
    markFirstSeekerSmsSent(db, publisherUserId, nowIso);
    return false;
  }

  const body = buildListingFirstSeekerSms(
    pending.map((p) => ({
      seekerName: p.seekerName,
      listingTitle: p.listingTitle,
    })),
  );
  if (!body) {
    markFirstSeekerSmsSent(db, publisherUserId, nowIso);
    return false;
  }

  const sent = await smsMasivosSendSms(dest.phoneE164, body);
  if (!sent.ok) {
    console.error(
      `[listing-first-seeker-sms] failed user=${publisherUserId}:`,
      sent.error,
    );
    return false;
  }
  markFirstSeekerSmsSent(db, publisherUserId, nowIso);
  return true;
}

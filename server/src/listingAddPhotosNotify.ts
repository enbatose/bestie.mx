/**
 * After a listing is published with an empty photo gallery, nudge the publisher
 * (in-app always; email/SMS when contact allows, respecting quiet hours).
 */
import type { DatabaseSync } from "node:sqlite";
import type { Express, Request, Response } from "express";
import { buildAddPhotosEmail } from "./emails/addPhotosEmail.js";
import { resolveTimeZoneForListingCity } from "./emails/emailDateTime.js";
import { publicWebOrigin } from "./handoffTokens.js";
import { buildAddPhotosSms } from "./listingAddPhotosSms.js";
import { propertyReferenceCode, roomReferenceCode } from "./listingReference.js";
import { sendTransactionalEmail } from "./mailer.js";
import { notifyPublisher } from "./notificationsSchema.js";
import { isNotifyQuietHours, nextNotifyQuietHoursResumeAt } from "./notifyQuietHours.js";
import { isPhoneVerifiedAt } from "./phoneAuth.js";
import { resolveRoomIdFromRouteParam } from "./resolveListingRouteId.js";
import { smsMasivosConfigured, smsMasivosSendSms } from "./smsMasivosOtp.js";
import { clampListingImageUrls } from "./validation.js";

function tableHasColumn(db: DatabaseSync, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

export function ensureAddPhotosNudgeSchema(db: DatabaseSync): void {
  if (!tableHasColumn(db, "rooms", "add_photos_nudge_due_at")) {
    db.exec(`ALTER TABLE rooms ADD COLUMN add_photos_nudge_due_at TEXT`);
  }
  if (!tableHasColumn(db, "rooms", "add_photos_nudge_sent_at")) {
    db.exec(`ALTER TABLE rooms ADD COLUMN add_photos_nudge_sent_at TEXT`);
  }
}

function parseImageUrls(raw: unknown): string[] {
  try {
    return clampListingImageUrls(JSON.parse(String(raw ?? "[]")));
  } catch {
    return [];
  }
}

export function roomGalleryIsEmpty(db: DatabaseSync, roomId: string): boolean {
  const row = db.prepare(`SELECT image_urls_json FROM rooms WHERE id = ?`).get(roomId) as
    | { image_urls_json: string | null }
    | undefined;
  if (!row) return false;
  return parseImageUrls(row.image_urls_json).length === 0;
}

function loadPublisherContact(
  db: DatabaseSync,
  publisherId: string,
): {
  email: string | null;
  phoneE164: string | null;
  phoneNotifyOptIn: boolean;
  displayName: string | null;
} {
  const link = db
    .prepare(`SELECT user_id FROM user_publishers WHERE publisher_id = ? LIMIT 1`)
    .get(publisherId) as { user_id: string } | undefined;
  if (!link?.user_id) {
    return { email: null, phoneE164: null, phoneNotifyOptIn: false, displayName: null };
  }
  const user = db
    .prepare(
      `SELECT email, display_name, phone_e164, phone_verified_at, phone_notify_opt_in
       FROM users WHERE id = ?`,
    )
    .get(link.user_id) as
    | {
        email: string | null;
        display_name: string | null;
        phone_e164: string | null;
        phone_verified_at: string | null;
        phone_notify_opt_in: number | null;
      }
    | undefined;
  if (!user) {
    return { email: null, phoneE164: null, phoneNotifyOptIn: false, displayName: null };
  }
  const phoneOk = isPhoneVerifiedAt(user.phone_verified_at) && Boolean(user.phone_e164?.trim());
  return {
    email: user.email?.trim() || null,
    phoneE164: phoneOk ? user.phone_e164!.trim() : null,
    phoneNotifyOptIn: Number(user.phone_notify_opt_in ?? 1) === 1,
    displayName: user.display_name?.trim() || null,
  };
}

/** `/publicar?edit=P…&vista=1&room=A…&fotos=1` — opens the photo editor. */
export function addPhotosEditPath(propertyId: string, roomId: string): string {
  const params = new URLSearchParams();
  params.set("edit", propertyReferenceCode(propertyId));
  params.set("vista", "1");
  params.set("room", roomReferenceCode(roomId));
  params.set("fotos", "1");
  return `/publicar?${params.toString()}`;
}

/** Short SMS deep link → same editor (server redirects `/f/A…`). */
export function addPhotosShortPath(roomId: string): string {
  return `/f/${encodeURIComponent(roomReferenceCode(roomId))}`;
}

type RoomNudgeRow = {
  id: string;
  property_id: string;
  title: string;
  image_urls_json: string | null;
  publisher_id: string;
  city: string | null;
  property_title: string | null;
};

function loadRoomForNudge(db: DatabaseSync, roomId: string): RoomNudgeRow | null {
  return (
    (db
      .prepare(
        `SELECT r.id, r.property_id, r.title, r.image_urls_json,
                p.publisher_id, p.city, p.title AS property_title
         FROM rooms r
         JOIN properties p ON p.id = r.property_id
         WHERE r.id = ?`,
      )
      .get(roomId) as RoomNudgeRow | undefined) ?? null
  );
}

async function sendChannelNudge(
  db: DatabaseSync,
  room: RoomNudgeRow,
  now: Date,
): Promise<void> {
  if (parseImageUrls(room.image_urls_json).length > 0) {
    db.prepare(`UPDATE rooms SET add_photos_nudge_due_at = NULL WHERE id = ?`).run(room.id);
    return;
  }

  const contact = loadPublisherContact(db, room.publisher_id);
  const base = publicWebOrigin();
  const editPath = addPhotosEditPath(room.property_id, room.id);
  const editUrl = `${base}${editPath}`;
  const shortUrl = `${base}${addPhotosShortPath(room.id)}`;
  const listingUrl = `${base}/anuncio/${encodeURIComponent(roomReferenceCode(room.id))}`;
  const title = (room.title || room.property_title || "tu anuncio").trim();

  if (contact.email) {
    const built = buildAddPhotosEmail({
      publisherName: contact.displayName,
      title,
      editPhotosUrl: editUrl,
      listingUrl,
    });
    const ok = await sendTransactionalEmail({
      to: contact.email,
      subject: built.subject,
      html: built.html,
      text: built.text,
      tags: [{ name: "kind", value: "add-photos-nudge" }],
    });
    if (!ok) {
      console.warn("[add-photos-nudge] email failed");
    }
  }

  if (contact.phoneE164 && contact.phoneNotifyOptIn && smsMasivosConfigured()) {
    const body = buildAddPhotosSms({ shortEditUrl: shortUrl });
    const sms = await smsMasivosSendSms(contact.phoneE164, body);
    if (!sms.ok) {
      console.warn("[add-photos-nudge] sms failed", sms.error);
    }
  }

  db.prepare(
    `UPDATE rooms SET add_photos_nudge_due_at = NULL, add_photos_nudge_sent_at = ? WHERE id = ?`,
  ).run(now.toISOString(), room.id);
}

/**
 * Call right after a room is published with an empty gallery.
 * In-app bell is immediate; email/SMS respect quiet hours (deferred to 06:01 local).
 */
export function scheduleNotifyPublisherAddPhotos(
  db: DatabaseSync,
  opts: { roomId: string },
  now: Date = new Date(),
): void {
  ensureAddPhotosNudgeSchema(db);
  const room = loadRoomForNudge(db, opts.roomId);
  if (!room) return;
  if (parseImageUrls(room.image_urls_json).length > 0) return;

  const already = db
    .prepare(`SELECT add_photos_nudge_sent_at, add_photos_nudge_due_at FROM rooms WHERE id = ?`)
    .get(room.id) as { add_photos_nudge_sent_at: string | null; add_photos_nudge_due_at: string | null } | undefined;
  // Already nudged (or deferred overnight) — do not stack in-app bells.
  if (already?.add_photos_nudge_sent_at || already?.add_photos_nudge_due_at) return;

  const editPath = addPhotosEditPath(room.property_id, room.id);
  notifyPublisher(db, room.publisher_id, {
    text: "Sube fotos a tu anuncio: con fotos te escriben más personas interesadas.",
    link: editPath,
  });

  const tz = resolveTimeZoneForListingCity(room.city).timeZone;
  const contact = loadPublisherContact(db, room.publisher_id);
  const hasChannel =
    Boolean(contact.email) ||
    Boolean(contact.phoneE164 && contact.phoneNotifyOptIn && smsMasivosConfigured());

  if (!hasChannel) {
    db.prepare(
      `UPDATE rooms SET add_photos_nudge_due_at = NULL, add_photos_nudge_sent_at = ? WHERE id = ?`,
    ).run(now.toISOString(), room.id);
    return;
  }

  if (isNotifyQuietHours(now, tz)) {
    const due = nextNotifyQuietHoursResumeAt(now, tz);
    db.prepare(`UPDATE rooms SET add_photos_nudge_due_at = ? WHERE id = ?`).run(due.toISOString(), room.id);
    return;
  }

  // Claim before async email/SMS so a second publish hook cannot double-notify.
  db.prepare(
    `UPDATE rooms SET add_photos_nudge_due_at = NULL, add_photos_nudge_sent_at = ? WHERE id = ?`,
  ).run(now.toISOString(), room.id);

  void sendChannelNudge(db, room, now).catch((err) => {
    console.warn("[add-photos-nudge] send failed", err instanceof Error ? err.message : err);
  });
}

/** Flush deferred email/SMS after quiet hours. */
export async function pollAddPhotosNudges(db: DatabaseSync, now: Date = new Date()): Promise<void> {
  ensureAddPhotosNudgeSchema(db);
  const due = db
    .prepare(
      `SELECT r.id
       FROM rooms r
       WHERE r.add_photos_nudge_due_at IS NOT NULL
         AND r.add_photos_nudge_due_at <= ?
         AND r.add_photos_nudge_sent_at IS NULL
         AND r.status = 'published'
       LIMIT 40`,
    )
    .all(now.toISOString()) as { id: string }[];

  for (const { id } of due) {
    const room = loadRoomForNudge(db, id);
    if (!room) continue;
    const tz = resolveTimeZoneForListingCity(room.city).timeZone;
    if (isNotifyQuietHours(now, tz)) continue;
    try {
      await sendChannelNudge(db, room, now);
    } catch (err) {
      console.warn("[add-photos-nudge] poll failed", err instanceof Error ? err.message : err);
    }
  }
}

export function startAddPhotosNudgeWorker(db: DatabaseSync): () => void {
  const kick = setTimeout(() => {
    void pollAddPhotosNudges(db);
  }, 25_000);
  const t = setInterval(() => {
    void pollAddPhotosNudges(db);
  }, 5 * 60 * 1000);
  return () => {
    clearTimeout(kick);
    clearInterval(t);
  };
}

/** SMS short link `GET /f/A…` → photo editor. Mount before the SPA catch-all. */
export function installAddPhotosRedirect(app: Express, db: DatabaseSync): void {
  app.get("/f/:code", (req: Request, res: Response) => {
    const roomId = resolveRoomIdFromRouteParam(db, String(req.params.code ?? ""));
    if (!roomId) {
      res.status(404).type("text/plain").send("not_found");
      return;
    }
    const row = db
      .prepare(`SELECT property_id FROM rooms WHERE id = ?`)
      .get(roomId) as { property_id: string } | undefined;
    if (!row?.property_id) {
      res.status(404).type("text/plain").send("not_found");
      return;
    }
    res.redirect(302, addPhotosEditPath(row.property_id, roomId));
  });
}

import { randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { buildListingAvailabilityEmail } from "./emails/listingAvailabilityEmail.js";
import { resolveTimeZoneForListingCity } from "./emails/emailDateTime.js";
import { listingTitleLeadForSms } from "./listingFirstSeekerSms.js";
import {
  buildListingAvailabilityDigestSms,
  buildListingAvailabilitySms,
} from "./listingAvailabilitySms.js";
import { sendTransactionalEmail } from "./mailer.js";
import { notifyPublisher } from "./notificationsSchema.js";
import { isNotifyQuietHours } from "./notifyQuietHours.js";
import {
  isPhoneVerifiedAt,
  isRealListingPhone,
  isUnclaimedAdminOutreach,
  listingPhoneToE164,
} from "./phoneAuth.js";
import { publicBaseUrl } from "./publicBaseUrl.js";
import { smsMasivosConfigured, smsMasivosSendSms } from "./smsMasivosOtp.js";

/** Notice goes out once the post has been live 25 days without a confirmation. */
export const AVAILABILITY_NOTICE_AFTER_DAYS = 25;
/** Pause only after the notice, and never sooner than 5 days later (launch grace). */
export const AVAILABILITY_PAUSE_AFTER_NOTICE_DAYS = 5;
/** Published cycle length until auto-pause when the notice goes out on day 25. */
export const AVAILABILITY_WINDOW_DAYS =
  AVAILABILITY_NOTICE_AFTER_DAYS + AVAILABILITY_PAUSE_AFTER_NOTICE_DAYS;
/** Admin "expiring soon" horizon. */
export const AVAILABILITY_EXPIRING_SOON_DAYS = 5;
export const AVAILABILITY_PAUSED_BY = "availability";

const DAY_MS = 24 * 60 * 60 * 1000;
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LEN = 6;

export type AvailabilityAction = "confirm" | "pause";

export type AvailabilityContact = {
  email: string | null;
  phoneE164: string | null;
  phoneNotifyOptIn: boolean;
  /** No Bestie account — listing phone only. SMS goes out without notify opt-in. */
  phoneOnly: boolean;
};

export function availabilityNotifyPlan(contact: AvailabilityContact): { email: boolean; sms: boolean } {
  const email = Boolean(contact.email?.trim());
  const phone = Boolean(contact.phoneE164?.trim());
  if (!email && phone) return { email: false, sms: true };
  if (email && phone && contact.phoneNotifyOptIn) return { email: true, sms: true };
  if (email) return { email: true, sms: false };
  return { email: false, sms: false };
}

export function smsLinkHost(base: string = publicBaseUrl()): string {
  try {
    const host = new URL(base).hostname.toLowerCase();
    if (host === "www.bestie.mx" || host === "bestie.mx") return "bestie.mx";
    return host;
  } catch {
    return "bestie.mx";
  }
}

export function availabilityActionPath(action: AvailabilityAction, code: string): string {
  return action === "confirm" ? `/c/${code}` : `/p/${code}`;
}

export function parseAvailabilityActionPath(pathname: string): { action: AvailabilityAction; code: string } | null {
  const m = pathname.match(/^\/([cp])\/([a-z0-9]{6})$/i);
  if (!m) return null;
  const action: AvailabilityAction = m[1]!.toLowerCase() === "c" ? "confirm" : "pause";
  return { action, code: m[2]!.toLowerCase() };
}

function parseIsoMs(raw: string | null | undefined): number | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
}

/** Clock starts at the later of first publish and the last confirmation (or resume). */
export function availabilityCycleStartMs(
  publishedAt: string | null | undefined,
  confirmedAt: string | null | undefined,
): number | null {
  const published = parseIsoMs(publishedAt);
  const confirmed = parseIsoMs(confirmedAt);
  if (published == null && confirmed == null) return null;
  if (published == null) return confirmed;
  if (confirmed == null) return published;
  return Math.max(published, confirmed);
}

export function availabilityAgeDays(cycleStartMs: number, now: Date): number {
  return (now.getTime() - cycleStartMs) / DAY_MS;
}

export function shouldSendAvailabilityNotice(opts: {
  status: string;
  publishedAt: string | null;
  confirmedAt: string | null;
  noticeSentAt: string | null;
  now: Date;
}): boolean {
  if (opts.status !== "published") return false;
  const start = availabilityCycleStartMs(opts.publishedAt, opts.confirmedAt);
  if (start == null) return false;
  if (availabilityAgeDays(start, opts.now) < AVAILABILITY_NOTICE_AFTER_DAYS) return false;
  const noticeMs = parseIsoMs(opts.noticeSentAt);
  if (noticeMs != null && noticeMs >= start) return false;
  return true;
}

/**
 * Pause only if a notice for this cycle was sent and 5 days have passed since that send.
 * A post already older than 30 days at launch is not paused until that grace elapses.
 */
export function shouldPauseForAvailability(opts: {
  status: string;
  publishedAt: string | null;
  confirmedAt: string | null;
  noticeSentAt: string | null;
  now: Date;
}): boolean {
  if (opts.status !== "published") return false;
  const start = availabilityCycleStartMs(opts.publishedAt, opts.confirmedAt);
  if (start == null) return false;
  const noticeMs = parseIsoMs(opts.noticeSentAt);
  if (noticeMs == null || noticeMs < start) return false;
  const confirmed = parseIsoMs(opts.confirmedAt);
  if (confirmed != null && confirmed >= noticeMs) return false;
  return opts.now.getTime() >= noticeMs + AVAILABILITY_PAUSE_AFTER_NOTICE_DAYS * DAY_MS;
}

export type ListingAvailabilityClock = {
  /** 1-based day in the 30-day window. Null when the post is not on the published clock. */
  dayOfWindow: number | null;
  /** Whole days until auto-pause. 0 means due now. Null if not scheduled. */
  daysUntilPause: number | null;
  expiresWithin5Days: boolean;
};

/**
 * When the post will pause if the owner does not confirm.
 * If the day-25 notice is already due but not sent, pause is 5 days after that send.
 */
export function availabilityPauseAtMs(opts: {
  status: string;
  publishedAt: string | null;
  confirmedAt: string | null;
  noticeSentAt: string | null;
  now: Date;
}): number | null {
  if (opts.status !== "published") return null;
  const start = availabilityCycleStartMs(opts.publishedAt, opts.confirmedAt);
  if (start == null) return null;
  const noticeMs = parseIsoMs(opts.noticeSentAt);
  if (noticeMs != null && noticeMs >= start) {
    return noticeMs + AVAILABILITY_PAUSE_AFTER_NOTICE_DAYS * DAY_MS;
  }
  if (opts.now.getTime() - start >= AVAILABILITY_NOTICE_AFTER_DAYS * DAY_MS) {
    return opts.now.getTime() + AVAILABILITY_PAUSE_AFTER_NOTICE_DAYS * DAY_MS;
  }
  return start + AVAILABILITY_WINDOW_DAYS * DAY_MS;
}

export function listingAvailabilityClock(opts: {
  status: string;
  publishedAt: string | null;
  confirmedAt: string | null;
  noticeSentAt: string | null;
  pausedBy?: string | null;
  now?: Date;
}): ListingAvailabilityClock {
  const now = opts.now ?? new Date();
  if (opts.status === "paused" && String(opts.pausedBy ?? "").trim() === AVAILABILITY_PAUSED_BY) {
    return { dayOfWindow: AVAILABILITY_WINDOW_DAYS, daysUntilPause: 0, expiresWithin5Days: false };
  }
  const start = availabilityCycleStartMs(opts.publishedAt, opts.confirmedAt);
  if (opts.status !== "published" || start == null) {
    return { dayOfWindow: null, daysUntilPause: null, expiresWithin5Days: false };
  }
  const dayOfWindow = Math.min(
    AVAILABILITY_WINDOW_DAYS,
    Math.max(1, Math.floor(availabilityAgeDays(start, now)) + 1),
  );
  const pauseAt = availabilityPauseAtMs({
    status: opts.status,
    publishedAt: opts.publishedAt,
    confirmedAt: opts.confirmedAt,
    noticeSentAt: opts.noticeSentAt,
    now,
  });
  const daysUntilPause =
    pauseAt == null ? null : Math.max(0, Math.ceil((pauseAt - now.getTime()) / DAY_MS));
  const expiresWithin5Days =
    pauseAt != null && pauseAt <= now.getTime() + AVAILABILITY_EXPIRING_SOON_DAYS * DAY_MS;
  return { dayOfWindow, daysUntilPause, expiresWithin5Days };
}

export function countPostsExpiringWithin5Days(db: DatabaseSync, now: Date = new Date()): number {
  ensureListingAvailabilitySchema(db);
  const cols = new Set(
    (db.prepare(`PRAGMA table_info(properties)`).all() as { name: string }[]).map((c) => c.name),
  );
  if (!cols.has("published_at")) return 0;
  const rows = db
    .prepare(
      `SELECT status, published_at, availability_confirmed_at, availability_notice_sent_at
       FROM properties WHERE status = 'published'`,
    )
    .all() as {
    status: string;
    published_at: string | null;
    availability_confirmed_at: string | null;
    availability_notice_sent_at: string | null;
  }[];
  let n = 0;
  for (const row of rows) {
    if (
      listingAvailabilityClock({
        status: row.status,
        publishedAt: row.published_at,
        confirmedAt: row.availability_confirmed_at,
        noticeSentAt: row.availability_notice_sent_at,
        now,
      }).expiresWithin5Days
    ) {
      n += 1;
    }
  }
  return n;
}

export function availabilityNeedsConfirm(opts: {
  status: string;
  publishedAt: string | null;
  confirmedAt: string | null;
  now?: Date;
}): boolean {
  if (opts.status !== "published") return false;
  const start = availabilityCycleStartMs(opts.publishedAt, opts.confirmedAt);
  if (start == null) return false;
  return availabilityAgeDays(start, opts.now ?? new Date()) >= AVAILABILITY_NOTICE_AFTER_DAYS;
}

export function ensureListingAvailabilitySchema(db: DatabaseSync): void {
  const cols = db.prepare(`PRAGMA table_info(properties)`).all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("availability_confirmed_at")) {
    db.exec(`ALTER TABLE properties ADD COLUMN availability_confirmed_at TEXT`);
  }
  if (!names.has("availability_notice_sent_at")) {
    db.exec(`ALTER TABLE properties ADD COLUMN availability_notice_sent_at TEXT`);
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS listing_availability_action_codes (
      code TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      action TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_listing_availability_codes_property
      ON listing_availability_action_codes(property_id);
    CREATE TABLE IF NOT EXISTS listing_availability_sms_sent (
      recipient_key TEXT PRIMARY KEY,
      sent_on TEXT NOT NULL,
      sent_at TEXT NOT NULL
    );
  `);
  const roomCols = db.prepare(`PRAGMA table_info(rooms)`).all() as { name: string }[];
  if (roomCols.length > 0 && !roomCols.some((c) => c.name === "availability_confirmed_at")) {
    db.exec(`ALTER TABLE rooms ADD COLUMN availability_confirmed_at TEXT`);
  }
}

function randomCode(): string {
  const bytes = randomBytes(CODE_LEN);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return out;
}

function insertUniqueCode(db: DatabaseSync, propertyId: string, action: AvailabilityAction, nowIso: string): string {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode();
    try {
      db.prepare(
        `INSERT INTO listing_availability_action_codes (code, property_id, action, created_at) VALUES (?, ?, ?, ?)`,
      ).run(code, propertyId, action, nowIso);
      return code;
    } catch {
      /* collision */
    }
  }
  throw new Error("availability_code_exhausted");
}

export function ensureAvailabilityActionCodes(
  db: DatabaseSync,
  propertyId: string,
  now: Date = new Date(),
): { confirmCode: string; pauseCode: string } {
  const existing = db
    .prepare(
      `SELECT code, action FROM listing_availability_action_codes WHERE property_id = ?`,
    )
    .all(propertyId) as { code: string; action: string }[];
  const confirm = existing.find((r) => r.action === "confirm")?.code;
  const pause = existing.find((r) => r.action === "pause")?.code;
  if (confirm && pause) return { confirmCode: confirm, pauseCode: pause };
  db.prepare(`DELETE FROM listing_availability_action_codes WHERE property_id = ?`).run(propertyId);
  const nowIso = now.toISOString();
  return {
    confirmCode: insertUniqueCode(db, propertyId, "confirm", nowIso),
    pauseCode: insertUniqueCode(db, propertyId, "pause", nowIso),
  };
}

export function lookupAvailabilityCode(
  db: DatabaseSync,
  code: string,
): { propertyId: string; action: AvailabilityAction } | null {
  const row = db
    .prepare(
      `SELECT property_id, action FROM listing_availability_action_codes WHERE code = ?`,
    )
    .get(code.toLowerCase()) as { property_id: string; action: string } | undefined;
  if (!row) return null;
  if (row.action !== "confirm" && row.action !== "pause") return null;
  return { propertyId: row.property_id, action: row.action };
}

type PropertyAvailRow = {
  id: string;
  publisher_id: string;
  status: string;
  post_mode: string | null;
  title: string | null;
  city: string | null;
  neighborhood: string | null;
  contact_whatsapp: string | null;
  published_at: string | null;
  availability_confirmed_at: string | null;
  availability_notice_sent_at: string | null;
  paused_by: string | null;
};

function loadProperty(db: DatabaseSync, propertyId: string): PropertyAvailRow | null {
  const row = db
    .prepare(
      `SELECT id, publisher_id, status, post_mode, title, city, neighborhood, contact_whatsapp,
              published_at, availability_confirmed_at, availability_notice_sent_at, paused_by
       FROM properties WHERE id = ?`,
    )
    .get(propertyId) as PropertyAvailRow | undefined;
  return row ?? null;
}

export function markAvailabilityConfirmed(db: DatabaseSync, propertyId: string, now: Date = new Date()): void {
  db.prepare(
    `UPDATE properties
     SET availability_confirmed_at = ?, availability_notice_sent_at = NULL
     WHERE id = ?`,
  ).run(now.toISOString(), propertyId);
  // Keep the pause code so the same SMS can still pause after they confirm.
  db.prepare(
    `DELETE FROM listing_availability_action_codes WHERE property_id = ? AND action = 'confirm'`,
  ).run(propertyId);
}

export function pausePropertyForAvailability(db: DatabaseSync, propertyId: string): void {
  db.prepare(
    `UPDATE properties SET status = 'paused', paused_by = ? WHERE id = ? AND status = 'published'`,
  ).run(AVAILABILITY_PAUSED_BY, propertyId);
  db.prepare(
    `UPDATE rooms SET status = 'paused', paused_by = ?, updated_at = CURRENT_TIMESTAMP
     WHERE property_id = ? AND status != 'archived'`,
  ).run(AVAILABILITY_PAUSED_BY, propertyId);
}

type AvailableRoomRow = {
  id: string;
  title: string | null;
  custom_name: string | null;
  availability_confirmed_at: string | null;
};

function roomLabel(row: AvailableRoomRow, index: number): string {
  const custom = String(row.custom_name ?? "").trim();
  const title = String(row.title ?? "").trim();
  if (custom && custom !== "Recámara 1") return custom;
  if (title && title !== "Recámara 1") return title;
  return `Recámara ${index + 1}`;
}

function availableRooms(db: DatabaseSync, propertyId: string): AvailableRoomRow[] {
  return db
    .prepare(
      `SELECT id, title, custom_name, availability_confirmed_at
       FROM rooms
       WHERE property_id = ?
         AND status = 'published'
         AND IFNULL(occupancy_status, 'available') != 'occupied'
       ORDER BY sort_order ASC, id ASC`,
    )
    .all(propertyId) as AvailableRoomRow[];
}

export function listAvailabilityRoomChoices(
  db: DatabaseSync,
  propertyId: string,
): { id: string; label: string }[] {
  return availableRooms(db, propertyId).map((row, i) => ({ id: row.id, label: roomLabel(row, i) }));
}

function remainingAvailableCount(db: DatabaseSync, propertyId: string): number {
  return availableRooms(db, propertyId).length;
}

export function markRoomRented(db: DatabaseSync, propertyId: string, roomId: string | null): AvailabilityActionResult {
  const prop = loadProperty(db, propertyId);
  if (!prop) return { ok: false, error: "not_found" };
  const title = String(prop.title ?? "").trim() || "Anuncio sin título";
  if (prop.status !== "published") {
    return { ok: true, outcome: "already_paused", title };
  }
  const rooms = availableRooms(db, propertyId);
  const targets = roomId ? rooms.filter((r) => r.id === roomId) : rooms;
  if (targets.length === 0) {
    pausePropertyForAvailability(db, propertyId);
    return { ok: true, outcome: "rented", title };
  }
  for (const room of targets) {
    db.prepare(
      `UPDATE rooms SET occupancy_status = 'occupied', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).run(room.id);
  }
  if (remainingAvailableCount(db, propertyId) === 0) {
    pausePropertyForAvailability(db, propertyId);
  }
  return { ok: true, outcome: "rented", title: targets.length === 1 ? roomLabel(targets[0]!, 0) : title };
}

export function confirmRoomStillFree(
  db: DatabaseSync,
  propertyId: string,
  roomId: string | null,
  now: Date = new Date(),
): AvailabilityActionResult {
  const prop = loadProperty(db, propertyId);
  if (!prop) return { ok: false, error: "not_found" };
  const title = String(prop.title ?? "").trim() || "Anuncio sin título";
  if (prop.status !== "published") {
    if (prop.status === "paused" && String(prop.paused_by ?? "") === AVAILABILITY_PAUSED_BY) {
      return { ok: true, outcome: "already_paused", title };
    }
    return { ok: false, error: "not_published" };
  }
  const rooms = availableRooms(db, propertyId);
  const isProperty = String(prop.post_mode ?? "") === "property" && rooms.length > 1;
  const targets = roomId ? rooms.filter((r) => r.id === roomId) : rooms;
  const nowIso = now.toISOString();
  for (const room of targets) {
    db.prepare(`UPDATE rooms SET availability_confirmed_at = ? WHERE id = ?`).run(nowIso, room.id);
  }
  const stillOpen = availableRooms(db, propertyId);
  const cycleStart = availabilityCycleStartMs(prop.published_at, prop.availability_confirmed_at) ?? 0;
  const allConfirmed =
    !isProperty ||
    (stillOpen.length > 0 &&
      stillOpen.every((room) => {
        const at = parseIsoMs(room.availability_confirmed_at);
        return at != null && at >= cycleStart;
      }));
  if (allConfirmed || !isProperty) {
    markAvailabilityConfirmed(db, propertyId, now);
  }
  return {
    ok: true,
    outcome: "confirmed",
    title: targets.length === 1 ? roomLabel(targets[0]!, 0) : title,
  };
}

export type AvailabilityActionResult =
  | {
      ok: true;
      outcome: "confirmed" | "rented" | "paused" | "already_paused" | "already_confirmed";
      title: string;
    }
  | { ok: false; error: "not_found" | "not_published" };

export function applyAvailabilityAction(
  db: DatabaseSync,
  propertyId: string,
  action: AvailabilityAction,
  now: Date = new Date(),
): AvailabilityActionResult {
  const prop = loadProperty(db, propertyId);
  if (!prop) return { ok: false, error: "not_found" };
  const title = String(prop.title ?? "").trim() || "Anuncio sin título";
  if (action === "confirm") {
    if (prop.status !== "published") {
      if (prop.status === "paused" && String(prop.paused_by ?? "") === AVAILABILITY_PAUSED_BY) {
        return { ok: true, outcome: "already_paused", title };
      }
      return { ok: false, error: "not_published" };
    }
    return confirmRoomStillFree(db, propertyId, null, now);
  }
  if (prop.status === "paused") {
    return { ok: true, outcome: "already_paused", title };
  }
  if (prop.status !== "published") return { ok: false, error: "not_published" };
  pausePropertyForAvailability(db, propertyId);
  return { ok: true, outcome: "paused", title };
}

function loadUserContact(
  db: DatabaseSync,
  publisherId: string,
): {
  email: string | null;
  phoneE164: string | null;
  phoneNotifyOptIn: boolean;
  displayName: string | null;
  userId: string | null;
} {
  const link = db
    .prepare(`SELECT user_id FROM user_publishers WHERE publisher_id = ? LIMIT 1`)
    .get(publisherId) as { user_id: string } | undefined;
  if (!link?.user_id) {
    return { email: null, phoneE164: null, phoneNotifyOptIn: false, displayName: null, userId: null };
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
    return { email: null, phoneE164: null, phoneNotifyOptIn: false, displayName: null, userId: null };
  }
  const email = user.email?.trim() || null;
  const phone =
    isPhoneVerifiedAt(user.phone_verified_at) && user.phone_e164?.trim()
      ? user.phone_e164.trim()
      : null;
  return {
    email,
    phoneE164: phone,
    phoneNotifyOptIn: Number(user.phone_notify_opt_in ?? 1) === 1,
    displayName: user.display_name?.trim() || null,
    userId: link.user_id,
  };
}

export function resolveAvailabilityContact(
  db: DatabaseSync,
  property: { id: string; publisher_id: string; contact_whatsapp: string | null },
): AvailabilityContact & { displayName: string | null; userId: string | null } {
  const listingPhone = isRealListingPhone(property.contact_whatsapp)
    ? listingPhoneToE164(String(property.contact_whatsapp))
    : null;
  const unclaimed = isUnclaimedAdminOutreach(db, property.id);
  if (unclaimed) {
    return {
      email: null,
      phoneE164: listingPhone,
      phoneNotifyOptIn: false,
      phoneOnly: true,
      displayName: null,
      userId: null,
    };
  }
  const account = loadUserContact(db, property.publisher_id);
  const email = account.email;
  const phone = email ? account.phoneE164 : account.phoneE164 || listingPhone;
  return {
    email,
    phoneE164: phone,
    phoneNotifyOptIn: account.phoneNotifyOptIn,
    phoneOnly: !email && Boolean(phone),
    displayName: account.displayName,
    userId: account.userId,
  };
}

function revealPeopleSince(db: DatabaseSync, propertyId: string, sinceIso: string | null): number {
  try {
    const row = db
      .prepare(
        `SELECT COUNT(DISTINCT seeker_user_id) AS n
         FROM listing_contact_events
         WHERE property_id = ? AND event_type = 'reveal' AND (? IS NULL OR created_at >= ?)`,
      )
      .get(propertyId, sinceIso, sinceIso) as { n: number } | undefined;
    return Math.max(0, Math.floor(Number(row?.n ?? 0)));
  } catch {
    return 0;
  }
}

function confirmUrlFor(base: string, code: string): string {
  const host = smsLinkHost(base);
  const httpsHost = host === "bestie.mx" || host.endsWith(".bestie.mx") ? host : host;
  return `https://${httpsHost}${availabilityActionPath("confirm", code)}`;
}

function localDateKey(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function smsAlreadySentToday(db: DatabaseSync, recipientKey: string, dayKey: string): boolean {
  const row = db
    .prepare(`SELECT sent_on FROM listing_availability_sms_sent WHERE recipient_key = ?`)
    .get(recipientKey) as { sent_on: string } | undefined;
  return row?.sent_on === dayKey;
}

function markSmsSent(db: DatabaseSync, recipientKey: string, dayKey: string, now: Date): void {
  db.prepare(
    `INSERT INTO listing_availability_sms_sent (recipient_key, sent_on, sent_at)
     VALUES (?, ?, ?)
     ON CONFLICT(recipient_key) DO UPDATE SET sent_on = excluded.sent_on, sent_at = excluded.sent_at`,
  ).run(recipientKey, dayKey, now.toISOString());
}

/** Claim link for an unclaimed post, extended so the SMS page can still save it. */
export function availabilityClaimUrl(
  db: DatabaseSync,
  propertyId: string,
  now: Date = new Date(),
): string | null {
  if (!isUnclaimedAdminOutreach(db, propertyId)) return null;
  const token = extendUnclaimedClaim(db, propertyId, now);
  if (!token) return null;
  return `https://${smsLinkHost(publicBaseUrl())}/borrador/${encodeURIComponent(token)}`;
}

function extendUnclaimedClaim(db: DatabaseSync, propertyId: string, now: Date): string | null {
  try {
    const row = db
      .prepare(
        `SELECT token FROM assisted_draft_claim_tokens
         WHERE property_id = ? AND claimed_by_user_id IS NULL
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get(propertyId) as { token: string } | undefined;
    if (!row?.token) return null;
    const until = now.getTime() + 30 * DAY_MS;
    db.prepare(
      `UPDATE assisted_draft_claim_tokens SET expires_at = ? WHERE token = ? AND expires_at < ?`,
    ).run(until, row.token, until);
    return row.token;
  } catch {
    return null;
  }
}

function propertyTitleLead(title: string | null): string {
  const t = String(title ?? "").trim();
  return listingTitleLeadForSms(t, 48) || "tu anuncio";
}

type NoticeJob = {
  prop: PropertyAvailRow;
  contact: ReturnType<typeof resolveAvailabilityContact>;
  confirmUrl: string;
  revealPeople: number;
};

async function deliverAvailabilityNotice(
  db: DatabaseSync,
  job: NoticeJob,
  now: Date,
  sms: { body: string; recipientKey: string; dayKey: string } | null,
  coveredByMorningSms = false,
): Promise<boolean> {
  const { prop, contact, confirmUrl } = job;
  const plan = availabilityNotifyPlan(contact);
  const title = String(prop.title ?? "").trim() || "Anuncio sin título";
  let sent = false;

  if (plan.email && contact.email) {
    const built = buildListingAvailabilityEmail({
      title,
      city: String(prop.city ?? ""),
      neighborhood: String(prop.neighborhood ?? ""),
      publisherName: contact.displayName,
      confirmUrl,
    });
    const ok = await sendTransactionalEmail({
      to: contact.email,
      subject: built.subject,
      html: built.html,
      text: built.text,
      replyTo: built.replyTo,
      tags: built.tags,
    });
    if (ok) sent = true;
  }

  if (sms && plan.sms && contact.phoneE164 && smsMasivosConfigured()) {
    if (!smsAlreadySentToday(db, sms.recipientKey, sms.dayKey)) {
      const result = await smsMasivosSendSms(contact.phoneE164, sms.body);
      if (result.ok) {
        sent = true;
        markSmsSent(db, sms.recipientKey, sms.dayKey, now);
      } else {
        console.error(`[availability] sms failed property=${prop.id}: ${result.error}`);
      }
    }
  } else if (plan.sms && !sms && contact.userId) {
    sent = sent || Boolean(contact.email) || coveredByMorningSms;
  } else if (plan.sms && !smsMasivosConfigured()) {
    console.info(`[availability] sms skipped, not configured property=${prop.id}`);
  }

  if (!sent) return false;

  db.prepare(`UPDATE properties SET availability_notice_sent_at = ? WHERE id = ?`).run(
    now.toISOString(),
    prop.id,
  );
  if (contact.userId) {
    notifyPublisher(db, prop.publisher_id, {
      text: `Confirma que "${propertyTitleLead(title)}" sigue libre o lo ocultamos en 5 días.`,
      link: "/mis-anuncios",
    });
  }
  return true;
}

function pauseDueProperty(db: DatabaseSync, prop: PropertyAvailRow): void {
  const rooms = availableRooms(db, prop.id);
  const isProperty = String(prop.post_mode ?? "") === "property" && rooms.length > 1;
  if (!isProperty) {
    pausePropertyForAvailability(db, prop.id);
    return;
  }
  const start = availabilityCycleStartMs(prop.published_at, prop.availability_confirmed_at);
  for (const room of rooms) {
    const confirmed = parseIsoMs(room.availability_confirmed_at);
    if (start != null && confirmed != null && confirmed >= start) continue;
    db.prepare(
      `UPDATE rooms SET status = 'paused', paused_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).run(AVAILABILITY_PAUSED_BY, room.id);
  }
  if (remainingAvailableCount(db, prop.id) === 0) {
    pausePropertyForAvailability(db, prop.id);
  } else {
    db.prepare(`UPDATE properties SET availability_notice_sent_at = NULL WHERE id = ?`).run(prop.id);
  }
}

export async function pollListingAvailability(db: DatabaseSync, now: Date = new Date()): Promise<void> {
  ensureListingAvailabilitySchema(db);
  const rows = db
    .prepare(
      `SELECT id, publisher_id, status, post_mode, title, city, neighborhood, contact_whatsapp,
              published_at, availability_confirmed_at, availability_notice_sent_at, paused_by
       FROM properties
       WHERE status = 'published'`,
    )
    .all() as PropertyAvailRow[];

  const due: NoticeJob[] = [];
  for (const prop of rows) {
    try {
      if (
        shouldPauseForAvailability({
          status: prop.status,
          publishedAt: prop.published_at,
          confirmedAt: prop.availability_confirmed_at,
          noticeSentAt: prop.availability_notice_sent_at,
          now,
        })
      ) {
        pauseDueProperty(db, prop);
        continue;
      }
      if (
        !shouldSendAvailabilityNotice({
          status: prop.status,
          publishedAt: prop.published_at,
          confirmedAt: prop.availability_confirmed_at,
          noticeSentAt: prop.availability_notice_sent_at,
          now,
        })
      ) {
        continue;
      }
      const contact = resolveAvailabilityContact(db, prop);
      const tz = resolveTimeZoneForListingCity(prop.city).timeZone;
      if (isNotifyQuietHours(now, tz)) continue;
      if (!availabilityNotifyPlan(contact).email && !availabilityNotifyPlan(contact).sms) {
        console.info(`[availability] no contact property=${prop.id}`);
        continue;
      }
      const codes = ensureAvailabilityActionCodes(db, prop.id, now);
      const start = availabilityCycleStartMs(prop.published_at, prop.availability_confirmed_at);
      due.push({
        prop,
        contact,
        confirmUrl: confirmUrlFor(publicBaseUrl(), codes.confirmCode),
        revealPeople: revealPeopleSince(db, prop.id, start == null ? null : new Date(start).toISOString()),
      });
    } catch (e) {
      console.error(`[availability] property=${prop.id}:`, e instanceof Error ? e.message : e);
    }
  }

  const claimed = new Map<string, NoticeJob[]>();
  const solo: NoticeJob[] = [];
  for (const job of due) {
    if (job.contact.userId) {
      const list = claimed.get(job.contact.userId) ?? [];
      list.push(job);
      claimed.set(job.contact.userId, list);
    } else {
      solo.push(job);
    }
  }

  for (const job of solo) {
    const tz = resolveTimeZoneForListingCity(job.prop.city).timeZone;
    const dayKey = localDateKey(now, tz);
    const key = `unclaimed:${job.prop.id}`;
    const sms = availabilityNotifyPlan(job.contact).sms
      ? {
          body: buildListingAvailabilitySms({
            title: String(job.prop.title ?? ""),
            revealPeople: job.revealPeople,
            confirmUrl: job.confirmUrl,
          }),
          recipientKey: key,
          dayKey,
        }
      : null;
    try {
      availabilityClaimUrl(db, job.prop.id, now);
      await deliverAvailabilityNotice(db, job, now, sms);
    } catch (e) {
      console.error(`[availability] property=${job.prop.id}:`, e instanceof Error ? e.message : e);
    }
  }

  for (const [userId, jobs] of claimed) {
    const tz = resolveTimeZoneForListingCity(jobs[0]?.prop.city).timeZone;
    const dayKey = localDateKey(now, tz);
    const recipientKey = `user:${userId}`;
    const digest = jobs.length > 1;
    const hub = `https://${smsLinkHost(publicBaseUrl())}/mis-anuncios`;
    let morningCovered = smsAlreadySentToday(db, recipientKey, dayKey);
    for (const job of jobs) {
      const sendSms = availabilityNotifyPlan(job.contact).sms && !morningCovered;
      const sms = sendSms
        ? {
            body: digest
              ? buildListingAvailabilityDigestSms({ count: jobs.length, hubUrl: hub })
              : buildListingAvailabilitySms({
                  title: String(job.prop.title ?? ""),
                  revealPeople: job.revealPeople,
                  confirmUrl: job.confirmUrl,
                }),
            recipientKey,
            dayKey,
          }
        : null;
      try {
        await deliverAvailabilityNotice(db, job, now, sms, morningCovered);
        if (sendSms && smsAlreadySentToday(db, recipientKey, dayKey)) morningCovered = true;
      } catch (e) {
        console.error(`[availability] property=${job.prop.id}:`, e instanceof Error ? e.message : e);
      }
    }
  }
}

export function startListingAvailabilityWorker(db: DatabaseSync): () => void {
  const raw = Number(process.env.LISTING_AVAILABILITY_POLL_MS);
  const ms = Number.isFinite(raw) && raw >= 60_000 ? raw : 60 * 60 * 1000;
  const kick = setTimeout(() => {
    void pollListingAvailability(db);
  }, 20_000);
  const t = setInterval(() => {
    void pollListingAvailability(db);
  }, ms);
  return () => {
    clearTimeout(kick);
    clearInterval(t);
  };
}

export function availabilityOwnerFlags(
  db: DatabaseSync,
  propertyIds: string[],
  now: Date = new Date(),
): Map<string, { availabilityNeedsConfirm: boolean }> {
  const out = new Map<string, { availabilityNeedsConfirm: boolean }>();
  const ids = [...new Set(propertyIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return out;
  const placeholders = ids.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT id, status, published_at, availability_confirmed_at
       FROM properties WHERE id IN (${placeholders})`,
    )
    .all(...ids) as {
    id: string;
    status: string;
    published_at: string | null;
    availability_confirmed_at: string | null;
  }[];
  for (const row of rows) {
    out.set(row.id, {
      availabilityNeedsConfirm: availabilityNeedsConfirm({
        status: row.status,
        publishedAt: row.published_at,
        confirmedAt: row.availability_confirmed_at,
        now,
      }),
    });
  }
  return out;
}

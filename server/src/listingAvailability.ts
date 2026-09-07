import { randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { buildListingAvailabilityEmail } from "./emails/listingAvailabilityEmail.js";
import { resolveTimeZoneForListingCity } from "./emails/emailDateTime.js";
import { listingTitleLeadForSms } from "./listingFirstSeekerSms.js";
import { buildListingAvailabilitySms } from "./listingAvailabilitySms.js";
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
  `);
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
      `SELECT id, publisher_id, status, title, city, neighborhood, contact_whatsapp,
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

export type AvailabilityActionResult =
  | { ok: true; outcome: "confirmed" | "paused" | "already_paused" | "already_confirmed"; title: string }
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
    markAvailabilityConfirmed(db, propertyId, now);
    return { ok: true, outcome: "confirmed", title };
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

function propertyTitleLead(title: string | null): string {
  const t = String(title ?? "").trim();
  return listingTitleLeadForSms(t, 48) || "tu anuncio";
}

async function sendAvailabilityNotice(
  db: DatabaseSync,
  prop: PropertyAvailRow,
  now: Date,
): Promise<boolean> {
  const contact = resolveAvailabilityContact(db, prop);
  const plan = availabilityNotifyPlan(contact);
  if (!plan.email && !plan.sms) {
    console.info(`[availability] no contact property=${prop.id}`);
    return false;
  }
  const tz = resolveTimeZoneForListingCity(prop.city).timeZone;
  if (isNotifyQuietHours(now, tz)) return false;

  const codes = ensureAvailabilityActionCodes(db, prop.id, now);
  const base = publicBaseUrl();
  const host = smsLinkHost(base);
  const confirmUrl = `${base}${availabilityActionPath("confirm", codes.confirmCode)}`;
  const pauseUrl = `${base}${availabilityActionPath("pause", codes.pauseCode)}`;
  const confirmSms = `${host}${availabilityActionPath("confirm", codes.confirmCode)}`;
  const pauseSms = `${host}${availabilityActionPath("pause", codes.pauseCode)}`;
  const title = String(prop.title ?? "").trim() || "Anuncio sin título";

  let sent = false;
  if (plan.email && contact.email) {
    const built = buildListingAvailabilityEmail({
      title,
      city: String(prop.city ?? ""),
      neighborhood: String(prop.neighborhood ?? ""),
      publisherName: contact.displayName,
      confirmUrl,
      pauseUrl,
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
  if (plan.sms && contact.phoneE164 && smsMasivosConfigured()) {
    const body = buildListingAvailabilitySms({
      title,
      confirmUrl: confirmSms,
      pauseUrl: pauseSms,
    });
    const sms = await smsMasivosSendSms(contact.phoneE164, body);
    if (sms.ok) sent = true;
    else console.error(`[availability] sms failed property=${prop.id}: ${sms.error}`);
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
      text: `Confirma que "${propertyTitleLead(title)}" sigue disponible o lo pausamos en 5 días.`,
      link: "/mis-anuncios",
    });
  }
  return true;
}

export async function pollListingAvailability(db: DatabaseSync, now: Date = new Date()): Promise<void> {
  ensureListingAvailabilitySchema(db);
  const rows = db
    .prepare(
      `SELECT id, publisher_id, status, title, city, neighborhood, contact_whatsapp,
              published_at, availability_confirmed_at, availability_notice_sent_at, paused_by
       FROM properties
       WHERE status = 'published'`,
    )
    .all() as PropertyAvailRow[];

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
        pausePropertyForAvailability(db, prop.id);
        continue;
      }
      if (
        shouldSendAvailabilityNotice({
          status: prop.status,
          publishedAt: prop.published_at,
          confirmedAt: prop.availability_confirmed_at,
          noticeSentAt: prop.availability_notice_sent_at,
          now,
        })
      ) {
        await sendAvailabilityNotice(db, prop, now);
      }
    } catch (e) {
      console.error(
        `[availability] property=${prop.id}:`,
        e instanceof Error ? e.message : e,
      );
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

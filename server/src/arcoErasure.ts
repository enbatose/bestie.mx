import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { classifyAdminUserRole } from "./adminUsers.js";
import { canonicalLookupEmail } from "./authEmail.js";
import { isUserEmailVerified } from "./emailVerification.js";
import {
  buildArcoWhatsAppConfirmation,
} from "./emails/arcoErasureEmail.js";
import {
  DELETED_USER_ID,
  isSystemMessagingBot,
  normalizeConversationKind,
} from "./messagingSchema.js";
import { uploadFilenameFromListingPath } from "./shareOgImage.js";
import { normalizeWhatsAppDigits } from "./validation.js";

export const ARCO_TOMBSTONE_BODY = "[Mensaje eliminado]";

export type ArcoEraseSource = "admin" | "email" | "facebook" | "whatsapp";

export type ArcoEraseCounts = {
  properties: number;
  rooms: number;
  photos: number;
  listingConversationsKept: number;
  supportConversationsDeleted: number;
  messagesTombstoned: number;
  savedSearches: number;
  blogComments: number;
  reportsAnonymized: number;
  clientEvents: number;
  oauthIdentities: number;
};

export type ArcoListingPreview = {
  propertyId: string;
  title: string;
  status: string;
  city: string;
  neighborhood: string;
  roomCount: number;
};

export type ArcoUserPreview = {
  id: string;
  email: string | null;
  phoneLast4: string | null;
  displayName: string;
  createdAt: string;
  emailVerified: boolean;
  role: "user" | "admin" | "system";
};

export type ArcoPreview = {
  user: ArcoUserPreview;
  canErase: boolean;
  cannotEraseReason: string | null;
  confirmHint: string;
  listings: ArcoListingPreview[];
  oauthProviders: string[];
  counts: ArcoEraseCounts;
};

export type ArcoPriorErasure = {
  id: string;
  createdAt: string;
  source: string;
  confirmationEmailSent: boolean;
  confirmationSmsSent: boolean;
};

export type ArcoSearchHit = {
  user: ArcoUserPreview;
  canErase: boolean;
  listingCount: number;
};

export type ArcoSearchResult = {
  users: ArcoSearchHit[];
  priorErasures: ArcoPriorErasure[];
};

export type ArcoEraseResult = {
  userId: string;
  counts: ArcoEraseCounts;
  confirmationEmailTo: string | null;
  confirmationEmailMasked: string | null;
  confirmationPhoneE164: string | null;
  confirmationPhoneLast4: string | null;
  displayName: string;
  whatsappMessage: string;
  logId: string;
};

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashArcoIdentifier(value: string): string {
  return sha256Hex(value.trim().toLowerCase());
}

function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.slice(0, 1) || "*";
  return `${head}***@${domain}`;
}

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? "";
}

function emptyCounts(): ArcoEraseCounts {
  return {
    properties: 0,
    rooms: 0,
    photos: 0,
    listingConversationsKept: 0,
    supportConversationsDeleted: 0,
    messagesTombstoned: 0,
    savedSearches: 0,
    blogComments: 0,
    reportsAnonymized: 0,
    clientEvents: 0,
    oauthIdentities: 0,
  };
}

function tableExists(db: DatabaseSync, name: string): boolean {
  const row = db
    .prepare(`SELECT 1 AS x FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`)
    .get(name) as { x: number } | undefined;
  return Boolean(row);
}

function parseUrlList(raw: unknown): string[] {
  try {
    const v = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function filenamesFromUrls(urls: string[]): string[] {
  const out: string[] = [];
  for (const u of urls) {
    const name = uploadFilenameFromListingPath(u);
    if (name) out.push(name);
  }
  return out;
}

function loadUserRow(db: DatabaseSync, userId: string): {
  id: string;
  email: string | null;
  phone_e164: string | null;
  display_name: string;
  created_at: string;
  email_verified_at: string | null;
  profile_picture_url: string | null;
} | null {
  const row = db
    .prepare(
      `SELECT id, email, phone_e164, display_name, created_at, email_verified_at, profile_picture_url
       FROM users WHERE id = ?`,
    )
    .get(userId) as
    | {
        id: string;
        email: string | null;
        phone_e164: string | null;
        display_name: string;
        created_at: string;
        email_verified_at: string | null;
        profile_picture_url: string | null;
      }
    | undefined;
  return row ?? null;
}

function toUserPreview(row: {
  id: string;
  email: string | null;
  phone_e164: string | null;
  display_name: string;
  created_at: string;
  email_verified_at: string | null;
}): ArcoUserPreview {
  const email = typeof row.email === "string" && row.email.trim() ? row.email : null;
  const phone = typeof row.phone_e164 === "string" ? row.phone_e164 : null;
  return {
    id: row.id,
    email,
    phoneLast4: phone && phone.length >= 4 ? phone.slice(-4) : null,
    displayName: String(row.display_name ?? ""),
    createdAt: String(row.created_at ?? ""),
    emailVerified: isUserEmailVerified(row.email_verified_at),
    role: classifyAdminUserRole(row.id, email),
  };
}

export function arcoCannotEraseReason(
  preview: Pick<ArcoUserPreview, "id" | "email" | "role">,
  adminUserId: string,
): string | null {
  if (preview.role === "system") {
    return "No se pueden eliminar cuentas de sistema.";
  }
  if (preview.role === "admin") {
    return "No se pueden eliminar cuentas de administrador por este flujo.";
  }
  if (preview.id === adminUserId) {
    return "No puedes eliminar tu propia cuenta desde aquí.";
  }
  if (isSystemMessagingBot(preview.id)) {
    return "No se pueden eliminar cuentas de sistema.";
  }
  return null;
}

function publisherIdsForUser(db: DatabaseSync, userId: string): string[] {
  const rows = db
    .prepare(`SELECT publisher_id FROM user_publishers WHERE user_id = ?`)
    .all(userId) as { publisher_id: string }[];
  return rows.map((r) => r.publisher_id).filter(Boolean);
}

function listingsForPublishers(db: DatabaseSync, publisherIds: string[]): ArcoListingPreview[] {
  if (publisherIds.length === 0) return [];
  const ph = publisherIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT p.id, p.title, p.status, p.city, p.neighborhood,
              (SELECT COUNT(*) FROM rooms r WHERE r.property_id = p.id) AS room_count
       FROM properties p WHERE p.publisher_id IN (${ph})
       ORDER BY p.created_at DESC`,
    )
    .all(...publisherIds) as Record<string, unknown>[];
  return rows.map((r) => ({
    propertyId: String(r.id ?? ""),
    title: String(r.title ?? ""),
    status: String(r.status ?? ""),
    city: String(r.city ?? ""),
    neighborhood: String(r.neighborhood ?? ""),
    roomCount: Number(r.room_count) || 0,
  }));
}

function propertyIdsForPublishers(db: DatabaseSync, publisherIds: string[]): string[] {
  if (publisherIds.length === 0) return [];
  const ph = publisherIds.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT id FROM properties WHERE publisher_id IN (${ph})`)
    .all(...publisherIds) as { id: string }[];
  return rows.map((r) => r.id);
}

function roomIdsForProperties(db: DatabaseSync, propertyIds: string[]): string[] {
  if (propertyIds.length === 0) return [];
  const ph = propertyIds.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT id FROM rooms WHERE property_id IN (${ph})`)
    .all(...propertyIds) as { id: string }[];
  return rows.map((r) => r.id);
}

function countOrZero(db: DatabaseSync, sql: string, params: Array<string | number | null>): number {
  try {
    return (db.prepare(sql).get(...params) as { c: number }).c;
  } catch {
    return 0;
  }
}

function collectCounts(db: DatabaseSync, userId: string, publisherIds: string[]): ArcoEraseCounts {
  const propertyIds = propertyIdsForPublishers(db, publisherIds);
  const counts = emptyCounts();
  counts.properties = propertyIds.length;
  counts.rooms = roomIdsForProperties(db, propertyIds).length;
  counts.savedSearches = countOrZero(db, `SELECT COUNT(*) AS c FROM saved_searches WHERE user_id = ?`, [userId]);
  counts.blogComments = tableExists(db, "blog_comments")
    ? countOrZero(db, `SELECT COUNT(*) AS c FROM blog_comments WHERE user_id = ?`, [userId])
    : 0;
  counts.oauthIdentities = countOrZero(db, `SELECT COUNT(*) AS c FROM oauth_identities WHERE user_id = ?`, [userId]);
  counts.clientEvents = tableExists(db, "client_events")
    ? countOrZero(
        db,
        `SELECT COUNT(*) AS c FROM client_events WHERE user_id = ?${publisherIds.length ? ` OR publisher_id IN (${publisherIds.map(() => "?").join(",")})` : ""}`,
        publisherIds.length ? [userId, ...publisherIds] : [userId],
      )
    : 0;
  counts.reportsAnonymized =
    countOrZero(db, `SELECT COUNT(*) AS c FROM post_report_events WHERE reporter_user_id = ?`, [userId]) +
    countOrZero(db, `SELECT COUNT(*) AS c FROM post_reports WHERE publisher_user_id = ?`, [userId]);

  const convRows = db
    .prepare(
      `SELECT c.id, c.kind FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE cp.user_id = ?`,
    )
    .all(userId) as { id: string; kind: string }[];
  for (const c of convRows) {
    const kind = normalizeConversationKind(c.kind);
    if (kind === "support" || kind === "feedback" || kind === "blog") {
      counts.supportConversationsDeleted += 1;
    } else {
      counts.listingConversationsKept += 1;
    }
  }
  counts.messagesTombstoned = countOrZero(
    db,
    `SELECT COUNT(*) AS c FROM messages WHERE sender_user_id = ?`,
    [userId],
  );
  counts.photos = collectOwnedFilenames(db, userId, propertyIds).length;
  return counts;
}

function collectOwnedFilenames(db: DatabaseSync, userId: string, propertyIds: string[]): string[] {
  const names = new Set<string>();
  const user = loadUserRow(db, userId);
  if (user?.profile_picture_url) {
    for (const n of filenamesFromUrls([user.profile_picture_url])) names.add(n);
  }
  if (propertyIds.length > 0) {
    const ph = propertyIds.map(() => "?").join(",");
    const props = db
      .prepare(
        `SELECT image_urls_json, admin_publish_evidence_url FROM properties WHERE id IN (${ph})`,
      )
      .all(...propertyIds) as { image_urls_json: string; admin_publish_evidence_url: string | null }[];
    for (const p of props) {
      for (const n of filenamesFromUrls(parseUrlList(p.image_urls_json))) names.add(n);
      if (p.admin_publish_evidence_url) {
        for (const n of filenamesFromUrls([p.admin_publish_evidence_url])) names.add(n);
      }
    }
    const rooms = db
      .prepare(`SELECT image_urls_json FROM rooms WHERE property_id IN (${ph})`)
      .all(...propertyIds) as { image_urls_json: string }[];
    for (const r of rooms) {
      for (const n of filenamesFromUrls(parseUrlList(r.image_urls_json))) names.add(n);
    }
  }
  const msgs = db
    .prepare(`SELECT attachments_json FROM messages WHERE sender_user_id = ?`)
    .all(userId) as { attachments_json: string | null }[];
  for (const m of msgs) {
    const atts = parseUrlList(m.attachments_json);
    const urls = atts
      .map((a) => {
        if (typeof a === "string") return a;
        return "";
      })
      .filter(Boolean);
    // attachments_json is objects, not string urls
    try {
      const parsed = JSON.parse(String(m.attachments_json ?? "[]"));
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === "object" && typeof (item as { url?: unknown }).url === "string") {
            for (const n of filenamesFromUrls([(item as { url: string }).url])) names.add(n);
          }
        }
      }
    } catch {
      for (const n of filenamesFromUrls(urls)) names.add(n);
    }
  }
  return [...names];
}

function blobStillReferenced(db: DatabaseSync, filename: string): boolean {
  const needle = `%${filename.replace(/[%_]/g, "")}%`;
  const hit =
    db
      .prepare(
        `SELECT 1 AS x FROM properties
         WHERE image_urls_json LIKE ? OR IFNULL(admin_publish_evidence_url, '') LIKE ?
         LIMIT 1`,
      )
      .get(needle, needle) as { x: number } | undefined;
  if (hit) return true;
  const roomHit = db
    .prepare(`SELECT 1 AS x FROM rooms WHERE image_urls_json LIKE ? LIMIT 1`)
    .get(needle) as { x: number } | undefined;
  if (roomHit) return true;
  const userHit = db
    .prepare(`SELECT 1 AS x FROM users WHERE IFNULL(profile_picture_url, '') LIKE ? LIMIT 1`)
    .get(needle) as { x: number } | undefined;
  if (userHit) return true;
  const msgHit = db
    .prepare(`SELECT 1 AS x FROM messages WHERE IFNULL(attachments_json, '') LIKE ? LIMIT 1`)
    .get(needle) as { x: number } | undefined;
  return Boolean(msgHit);
}

function deleteUploadBlob(db: DatabaseSync, filename: string, uploadDir?: string): void {
  if (tableExists(db, "upload_blobs")) {
    db.prepare(`DELETE FROM upload_blobs WHERE filename = ?`).run(filename);
  }
  if (!uploadDir) return;
  const fp = path.join(path.resolve(uploadDir), path.basename(filename));
  if (!fp.startsWith(path.resolve(uploadDir))) return;
  try {
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch {
    /* best-effort */
  }
}

function otherHumanParticipantIds(db: DatabaseSync, conversationId: string, userId: string): string[] {
  const rows = db
    .prepare(
      `SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id != ?`,
    )
    .all(conversationId, userId) as { user_id: string }[];
  return rows.map((r) => r.user_id).filter((id) => !isSystemMessagingBot(id));
}

function tombstoneUserMessages(db: DatabaseSync, conversationId: string, userId: string): number {
  const info = db
    .prepare(
      `UPDATE messages
       SET sender_user_id = ?, body = ?, attachments_json = NULL
       WHERE conversation_id = ? AND sender_user_id = ?`,
    )
    .run(DELETED_USER_ID, ARCO_TOMBSTONE_BODY, conversationId, userId);
  return Number(info.changes) || 0;
}

function replaceParticipantWithDeletedUser(db: DatabaseSync, conversationId: string, userId: string): void {
  db.prepare(`DELETE FROM conversation_participants WHERE conversation_id = ? AND user_id = ?`).run(
    conversationId,
    userId,
  );
  db.prepare(
    `INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`,
  ).run(conversationId, DELETED_USER_ID);
}

function emailMatchesConfirm(stored: string | null, confirm: string): boolean {
  const c = confirm.trim();
  if (!stored?.trim()) return false;
  return canonicalLookupEmail(c) === canonicalLookupEmail(stored);
}

export function previewArcoErasure(db: DatabaseSync, userId: string, adminUserId: string): ArcoPreview | null {
  const row = loadUserRow(db, userId);
  if (!row) return null;
  const user = toUserPreview(row);
  const cannotEraseReason = arcoCannotEraseReason(user, adminUserId);
  const publisherIds = publisherIdsForUser(db, userId);
  const listings = listingsForPublishers(db, publisherIds);
  const oauthRows = db
    .prepare(`SELECT provider FROM oauth_identities WHERE user_id = ?`)
    .all(userId) as { provider: string }[];
  const confirmHint = user.email
    ? `Escribe ${user.email} para confirmar`
    : `Esta cuenta no tiene correo. Escribe el id ${user.id} para confirmar`;
  return {
    user,
    canErase: cannotEraseReason == null,
    cannotEraseReason,
    confirmHint,
    listings,
    oauthProviders: oauthRows.map((r) => r.provider),
    counts: collectCounts(db, userId, publisherIds),
  };
}

export function searchArcoTargets(db: DatabaseSync, qRaw: string): ArcoSearchResult {
  const q = qRaw.trim();
  const users: ArcoSearchHit[] = [];
  const priorErasures: ArcoPriorErasure[] = [];
  if (!q) return { users, priorErasures };

  const seen = new Set<string>();
  const pushUser = (id: string) => {
    if (seen.has(id) || isSystemMessagingBot(id)) return;
    const row = loadUserRow(db, id);
    if (!row) return;
    seen.add(id);
    const user = toUserPreview(row);
    users.push({
      user,
      canErase: user.role === "user",
      listingCount: listingsForPublishers(db, publisherIdsForUser(db, id)).length,
    });
  };
  const pushPriorsByHash = (column: "email_hash" | "phone_hash", hash: string) => {
    if (!tableExists(db, "arco_erasure_log") || !hash) return;
    const sql =
      column === "email_hash"
        ? `SELECT id, created_at, source, confirmation_email_sent, confirmation_sms_sent
           FROM arco_erasure_log WHERE email_hash = ? ORDER BY created_at DESC LIMIT 5`
        : `SELECT id, created_at, source, confirmation_email_sent, confirmation_sms_sent
           FROM arco_erasure_log WHERE phone_hash = ? ORDER BY created_at DESC LIMIT 5`;
    const logs = db.prepare(sql).all(hash) as {
      id: string;
      created_at: string;
      source: string;
      confirmation_email_sent: number;
      confirmation_sms_sent: number;
    }[];
    for (const l of logs) {
      if (priorErasures.some((p) => p.id === l.id)) continue;
      priorErasures.push(mapArcoLogRow(l));
    }
  };

  pushUser(q);

  if (q.includes("@")) {
    const canon = canonicalLookupEmail(q);
    const byCanon = db
      .prepare(`SELECT id FROM users WHERE email_canonical = ? OR lower(trim(IFNULL(email, ''))) = ? LIMIT 5`)
      .all(canon, q.trim().toLowerCase()) as { id: string }[];
    for (const r of byCanon) pushUser(r.id);
    pushPriorsByHash("email_hash", hashArcoIdentifier(canon));
  }

  const digits = q.replace(/\D/g, "");
  if (digits.length >= 10) {
    const e164 = normalizeWhatsAppDigits(q);
    const phoneRows = db
      .prepare(
        `SELECT id FROM users WHERE phone_e164 = ? OR phone_e164 LIKE ? LIMIT 5`,
      )
      .all(e164 ? `+${e164}` : `__never__`, `%${digits.slice(-10)}`) as { id: string }[];
    for (const r of phoneRows) pushUser(r.id);
    if (e164) {
      pushPriorsByHash("phone_hash", hashArcoIdentifier(`+${e164}`));
      const last10 = e164.slice(-10);
      if (last10.length === 10) {
        pushPriorsByHash("phone_hash", hashArcoIdentifier(`+52${last10}`));
      }
    }
  }

  return { users, priorErasures };
}

function mapArcoLogRow(l: {
  id: string;
  created_at: string;
  source: string;
  confirmation_email_sent: number;
  confirmation_sms_sent: number;
}): ArcoPriorErasure {
  return {
    id: l.id,
    createdAt: l.created_at,
    source: l.source,
    confirmationEmailSent: Boolean(l.confirmation_email_sent),
    confirmationSmsSent: Boolean(l.confirmation_sms_sent),
  };
}

export function listRecentArcoErasures(db: DatabaseSync, limit = 20): ArcoPriorErasure[] {
  if (!tableExists(db, "arco_erasure_log")) return [];
  const rows = db
    .prepare(
      `SELECT id, created_at, source, confirmation_email_sent, confirmation_sms_sent
       FROM arco_erasure_log ORDER BY created_at DESC LIMIT ?`,
    )
    .all(Math.min(50, Math.max(1, limit))) as {
    id: string;
    created_at: string;
    source: string;
    confirmation_email_sent: number;
    confirmation_sms_sent: number;
  }[];
  return rows.map(mapArcoLogRow);
}

export function markArcoConfirmationEmailSent(db: DatabaseSync, logId: string, sent: boolean): void {
  db.prepare(`UPDATE arco_erasure_log SET confirmation_email_sent = ? WHERE id = ?`).run(sent ? 1 : 0, logId);
}

export function markArcoConfirmationSmsSent(db: DatabaseSync, logId: string, sent: boolean): void {
  db.prepare(`UPDATE arco_erasure_log SET confirmation_sms_sent = ? WHERE id = ?`).run(sent ? 1 : 0, logId);
}

export function eraseUserForArco(
  db: DatabaseSync,
  opts: {
    userId: string;
    adminUserId: string;
    emailConfirm: string;
    reason?: string;
    source?: ArcoEraseSource;
    uploadDir?: string;
  },
): ArcoEraseResult {
  const preview = previewArcoErasure(db, opts.userId, opts.adminUserId);
  if (!preview) {
    throw Object.assign(new Error("not_found"), { code: "not_found" });
  }
  if (!preview.canErase) {
    throw Object.assign(new Error(preview.cannotEraseReason ?? "forbidden"), { code: "forbidden" });
  }
  const confirm = opts.emailConfirm.trim();
  const emailOk = preview.user.email
    ? emailMatchesConfirm(preview.user.email, confirm)
    : confirm === preview.user.id;
  if (!emailOk) {
    throw Object.assign(new Error("confirm_mismatch"), { code: "confirm_mismatch" });
  }

  const userId = preview.user.id;
  const capturedEmail = preview.user.email;
  const capturedPhone = loadUserRow(db, userId)?.phone_e164 ?? null;
  const displayName = preview.user.displayName;
  const publisherIds = publisherIdsForUser(db, userId);
  const propertyIds = propertyIdsForPublishers(db, publisherIds);
  const roomIds = roomIdsForProperties(db, propertyIds);
  const filenames = collectOwnedFilenames(db, userId, propertyIds);
  const counts = emptyCounts();
  counts.properties = propertyIds.length;
  counts.rooms = roomIds.length;
  counts.photos = filenames.length;
  counts.savedSearches = preview.counts.savedSearches;
  counts.blogComments = preview.counts.blogComments;
  counts.oauthIdentities = preview.counts.oauthIdentities;

  const logId = randomUUID();
  const now = new Date().toISOString();

  db.exec("BEGIN IMMEDIATE;");
  try {
    const convs = db
      .prepare(
        `SELECT c.id, c.kind FROM conversations c
         JOIN conversation_participants cp ON cp.conversation_id = c.id
         WHERE cp.user_id = ?`,
      )
      .all(userId) as { id: string; kind: string }[];

    for (const conv of convs) {
      const kind = normalizeConversationKind(conv.kind);
      const humans = otherHumanParticipantIds(db, conv.id, userId);
      if (kind === "support" || kind === "feedback" || kind === "blog") {
        db.prepare(`DELETE FROM conversations WHERE id = ?`).run(conv.id);
        counts.supportConversationsDeleted += 1;
        continue;
      }
      if (kind === "listing" && humans.length === 0) {
        db.prepare(`DELETE FROM conversations WHERE id = ?`).run(conv.id);
        counts.supportConversationsDeleted += 1;
        continue;
      }
      counts.messagesTombstoned += tombstoneUserMessages(db, conv.id, userId);
      replaceParticipantWithDeletedUser(db, conv.id, userId);
      counts.listingConversationsKept += 1;
    }

    if (tableExists(db, "post_report_events")) {
      const n = db
        .prepare(`UPDATE post_report_events SET reporter_user_id = NULL WHERE reporter_user_id = ?`)
        .run(userId);
      counts.reportsAnonymized += Number(n.changes) || 0;
    }
    if (tableExists(db, "report_abuse_flags")) {
      db.prepare(`UPDATE report_abuse_flags SET reporter_user_id = ? WHERE reporter_user_id = ?`).run(
        DELETED_USER_ID,
        userId,
      );
    }
    if (tableExists(db, "post_reports")) {
      const n = db
        .prepare(`UPDATE post_reports SET publisher_user_id = NULL WHERE publisher_user_id = ?`)
        .run(userId);
      counts.reportsAnonymized += Number(n.changes) || 0;
      if (roomIds.length > 0) {
        const ph = roomIds.map(() => "?").join(",");
        db.prepare(
          `UPDATE post_reports SET target_room_id = NULL WHERE target_room_id IN (${ph})`,
        ).run(...roomIds);
      }
      if (propertyIds.length > 0) {
        const ph = propertyIds.map(() => "?").join(",");
        db.prepare(
          `UPDATE post_reports SET target_property_id = NULL WHERE target_property_id IN (${ph})`,
        ).run(...propertyIds);
      }
    }

    if (tableExists(db, "assisted_draft_claim_tokens")) {
      db.prepare(`UPDATE assisted_draft_claim_tokens SET claimed_by_user_id = NULL WHERE claimed_by_user_id = ?`).run(
        userId,
      );
    }

    if (tableExists(db, "renter_groups") && publisherIds.length > 0) {
      const ph = publisherIds.map(() => "?").join(",");
      const owned = db
        .prepare(`SELECT id FROM renter_groups WHERE owner_publisher_id IN (${ph})`)
        .all(...publisherIds) as { id: string }[];
      for (const g of owned) {
        db.prepare(`DELETE FROM renter_group_members WHERE group_id = ?`).run(g.id);
        db.prepare(`DELETE FROM renter_groups WHERE id = ?`).run(g.id);
      }
      db.prepare(`DELETE FROM renter_group_members WHERE publisher_id IN (${ph})`).run(...publisherIds);
    }

    if (tableExists(db, "client_events")) {
      const info = publisherIds.length
        ? db
            .prepare(
              `DELETE FROM client_events WHERE user_id = ? OR publisher_id IN (${publisherIds.map(() => "?").join(",")})`,
            )
            .run(userId, ...publisherIds)
        : db.prepare(`DELETE FROM client_events WHERE user_id = ?`).run(userId);
      counts.clientEvents = Number(info.changes) || 0;
    }
    if (tableExists(db, "dau_publishers") && publisherIds.length > 0) {
      const ph = publisherIds.map(() => "?").join(",");
      db.prepare(`DELETE FROM dau_publishers WHERE publisher_id IN (${ph})`).run(...publisherIds);
    }
    if (tableExists(db, "messenger_handoff_tokens") && publisherIds.length > 0) {
      const ph = publisherIds.map(() => "?").join(",");
      db.prepare(`DELETE FROM messenger_handoff_tokens WHERE publisher_id IN (${ph})`).run(...publisherIds);
    }
    if (tableExists(db, "messenger_chat_sessions") && publisherIds.length > 0) {
      const ph = publisherIds.map(() => "?").join(",");
      db.prepare(`DELETE FROM messenger_chat_sessions WHERE publisher_id IN (${ph})`).run(...publisherIds);
    }

    db.prepare(`DELETE FROM email_verification_challenges WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM password_reset_tokens WHERE user_id = ?`).run(userId);
    if (capturedPhone) {
      db.prepare(`DELETE FROM whatsapp_otp_challenges WHERE phone_e164 = ?`).run(capturedPhone);
    }

    if (propertyIds.length > 0) {
      const ph = propertyIds.map(() => "?").join(",");
      if (tableExists(db, "assisted_draft_claim_tokens")) {
        db.prepare(`DELETE FROM assisted_draft_claim_tokens WHERE property_id IN (${ph})`).run(...propertyIds);
      }
      db.prepare(`DELETE FROM rooms WHERE property_id IN (${ph})`).run(...propertyIds);
      db.prepare(`DELETE FROM properties WHERE id IN (${ph})`).run(...propertyIds);
    }

    db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);

    for (const name of filenames) {
      if (!blobStillReferenced(db, name)) {
        deleteUploadBlob(db, name, opts.uploadDir);
      }
    }

    db.prepare(
      `INSERT INTO arco_erasure_log (
         id, user_id, email_hash, phone_hash, admin_user_id, source, reason, counts_json,
         confirmation_email_sent, confirmation_sms_sent, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
    ).run(
      logId,
      userId,
      capturedEmail ? hashArcoIdentifier(canonicalLookupEmail(capturedEmail)) : null,
      capturedPhone ? hashArcoIdentifier(capturedPhone) : null,
      opts.adminUserId,
      opts.source ?? "admin",
      (opts.reason ?? "").trim().slice(0, 500) || null,
      JSON.stringify(counts),
      now,
    );

    db.exec("COMMIT;");
  } catch (err) {
    try {
      db.exec("ROLLBACK;");
    } catch {
      /* ignore */
    }
    throw err;
  }

  return {
    userId,
    counts,
    confirmationEmailTo: capturedEmail,
    confirmationEmailMasked: capturedEmail ? maskEmail(capturedEmail) : null,
    confirmationPhoneE164: capturedEmail ? null : capturedPhone,
    confirmationPhoneLast4:
      !capturedEmail && capturedPhone && capturedPhone.length >= 4 ? capturedPhone.slice(-4) : null,
    displayName,
    whatsappMessage: buildArcoWhatsAppConfirmation(firstName(displayName) || displayName),
    logId,
  };
}

import { randomBytes, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { buildSavedSearchEmail } from "./emails/savedSearchEmail.js";
import { isUserEmailVerified } from "./emailVerification.js";
import { sendTransactionalEmail } from "./mailer.js";
import { publicBaseUrl } from "./publicBaseUrl.js";
import {
  fetchMatchingListingsForSavedSearch,
  parseSavedSearchFilters,
  parseSavedSearchLocation,
  type SavedSearchLocationSnapshot,
} from "./savedSearchMatch.js";
import { fetchPublishedListings } from "./publishedListingsQuery.js";
import {
  highAffinitySimilar,
  parseSimilarConfig,
  splitSharedSearchMatches,
} from "./sharedSearchMatch.js";
import type { SearchFilters } from "./searchFilters.js";
import type { PropertyListing } from "./types.js";
import { formatSavedSearchDraftLabel } from "./savedSearchDraftLabel.js";

const INITIAL_EMAIL_LISTING_CAP = 50;
const FOLLOW_UP_OTHER_CAP = 5;
/** Minimum interval between follow-up alert emails (aggregate new matches in this window). */
const FOLLOW_UP_DEBOUNCE_MS = 3 * 60 * 60 * 1000;

export type SavedSearchRow = {
  id: string;
  user_id: string;
  label: string;
  city_code: string;
  filters_json: string;
  location_json: string;
  search_url: string;
  email_notify_enabled: number;
  unsubscribe_token: string;
  last_notified_at: string | null;
  is_draft: number;
  created_at: string;
  updated_at: string;
  share_id?: string | null;
};

function isoNow(): string {
  return new Date().toISOString();
}

function loadSavedSearch(db: DatabaseSync, id: string): SavedSearchRow | undefined {
  return db.prepare(`SELECT * FROM saved_searches WHERE id = ?`).get(id) as SavedSearchRow | undefined;
}

function loadUserEmail(db: DatabaseSync, userId: string): string | null {
  const row = db
    .prepare(`SELECT email, email_verified_at FROM users WHERE id = ?`)
    .get(userId) as { email: string | null; email_verified_at: string | null } | undefined;
  const e = row?.email?.trim();
  if (!e || !isUserEmailVerified(row?.email_verified_at)) return null;
  return e;
}

function notifiedRoomIds(db: DatabaseSync, savedSearchId: string): Set<string> {
  const rows = db
    .prepare(`SELECT room_id FROM saved_search_notified_rooms WHERE saved_search_id = ?`)
    .all(savedSearchId) as { room_id: string }[];
  return new Set(rows.map((r) => r.room_id));
}

function markRoomsNotified(db: DatabaseSync, savedSearchId: string, roomIds: string[]): void {
  const now = isoNow();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO saved_search_notified_rooms (saved_search_id, room_id, notified_at) VALUES (?, ?, ?)`,
  );
  for (const roomId of roomIds) {
    stmt.run(savedSearchId, roomId, now);
  }
}

function clearNotifiedRooms(db: DatabaseSync, savedSearchId: string): void {
  db.prepare(`DELETE FROM saved_search_notified_rooms WHERE saved_search_id = ?`).run(savedSearchId);
}

export function generateUnsubscribeToken(): string {
  return randomBytes(24).toString("hex");
}

export function autoLabelFromSearch(
  location: SavedSearchLocationSnapshot,
  _filters: SearchFilters,
  at: Date = new Date(),
): string {
  return formatSavedSearchDraftLabel(location, at);
}

export type EnableNotifyResult = {
  ok: boolean;
  emailSent: boolean;
  replacedPrevious?: { id: string; label: string };
  error?: string;
};

/** Enable email alerts for one saved search (disables others for same user). */
export async function enableSavedSearchNotify(
  db: DatabaseSync,
  userId: string,
  savedSearchId: string,
  opts?: { requireEmail?: boolean },
): Promise<EnableNotifyResult> {
  const row = loadSavedSearch(db, savedSearchId);
  if (!row || row.user_id !== userId) {
    return { ok: false, emailSent: false, error: "not_found" };
  }
  const email = loadUserEmail(db, userId);
  if (!email && opts?.requireEmail !== false) {
    return { ok: false, emailSent: false, error: "email_required" };
  }

  const prev = db
    .prepare(
      `SELECT id, label FROM saved_searches WHERE user_id = ? AND email_notify_enabled = 1 AND id != ? LIMIT 1`,
    )
    .get(userId, savedSearchId) as { id: string; label: string } | undefined;

  const now = isoNow();
  db.exec("BEGIN");
  try {
    db.prepare(`UPDATE saved_searches SET email_notify_enabled = 0, updated_at = ? WHERE user_id = ?`).run(
      now,
      userId,
    );
    db.prepare(
      `UPDATE saved_searches SET email_notify_enabled = 1, last_notified_at = NULL, updated_at = ? WHERE id = ?`,
    ).run(now, savedSearchId);
    clearNotifiedRooms(db, savedSearchId);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  const emailSent = await sendSavedSearchEmail(db, savedSearchId, "initial");

  return {
    ok: true,
    emailSent,
    ...(prev ? { replacedPrevious: { id: prev.id, label: prev.label } } : {}),
  };
}

function listingsForSavedSearchEmail(db: DatabaseSync, row: SavedSearchRow): {
  exact: PropertyListing[];
  similarHigh: PropertyListing[];
} {
  const filters = parseSavedSearchFilters(row.filters_json);
  const location = parseSavedSearchLocation(row.location_json);
  const exact = fetchMatchingListingsForSavedSearch(db, filters, location);
  if (!row.share_id) return { exact, similarHigh: [] };
  const share = db
    .prepare(`SELECT similar_json FROM shared_searches WHERE id = ?`)
    .get(row.share_id) as { similar_json: string } | undefined;
  if (!share) return { exact, similarHigh: [] };
  const split = splitSharedSearchMatches(
    fetchPublishedListings(db),
    filters,
    location,
    parseSimilarConfig(share.similar_json),
  );
  const exactIds = new Set(exact.map((l) => l.id));
  const similarHigh = highAffinitySimilar(split.similar)
    .map((r) => r.listing)
    .filter((l) => !exactIds.has(l.id));
  return { exact, similarHigh };
}

export async function sendSavedSearchEmail(
  db: DatabaseSync,
  savedSearchId: string,
  mode: "initial" | "follow_up",
): Promise<boolean> {
  const row = loadSavedSearch(db, savedSearchId);
  if (!row || !row.email_notify_enabled) return false;

  const email = loadUserEmail(db, row.user_id);
  if (!email) return false;

  const { exact, similarHigh } = listingsForSavedSearchEmail(db, row);
  const notified = notifiedRoomIds(db, savedSearchId);

  let newListings: PropertyListing[] = [];
  let otherListings: PropertyListing[] = [];
  let similarListings: PropertyListing[] = [];

  if (mode === "initial") {
    newListings = exact.slice(0, INITIAL_EMAIL_LISTING_CAP);
    similarListings = similarHigh.slice(0, INITIAL_EMAIL_LISTING_CAP);
    otherListings = [];
  } else {
    if (row.last_notified_at) {
      const last = Date.parse(row.last_notified_at);
      if (Number.isFinite(last) && Date.now() - last < FOLLOW_UP_DEBOUNCE_MS) {
        return false;
      }
    }
    newListings = exact.filter((l) => !notified.has(l.id));
    similarListings = similarHigh.filter((l) => !notified.has(l.id));
    if (!newListings.length && !similarListings.length) return false;
    otherListings = exact.filter((l) => notified.has(l.id)).slice(0, FOLLOW_UP_OTHER_CAP);
  }

  const mail = buildSavedSearchEmail({
    label: row.label,
    searchUrl: row.search_url,
    unsubscribeToken: row.unsubscribe_token,
    mode,
    newListings,
    otherListings,
    similarListings,
  });

  const unsubUrl = `${publicBaseUrl()}/api/saved-searches/unsubscribe/${encodeURIComponent(row.unsubscribe_token)}`;
  const sent = await sendTransactionalEmail({
    to: email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    previewText: mail.previewText,
    replyTo: mail.replyTo,
    tags: mail.tags,
    headers: {
      "List-Unsubscribe": `<${unsubUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
  if (!sent) return false;

  const roomIdsToMark =
    mode === "initial"
      ? [...exact.slice(0, INITIAL_EMAIL_LISTING_CAP), ...similarHigh.slice(0, INITIAL_EMAIL_LISTING_CAP)].map(
          (l) => l.id,
        )
      : [...newListings, ...otherListings, ...similarListings].map((l) => l.id);
  markRoomsNotified(db, savedSearchId, roomIdsToMark);
  db.prepare(`UPDATE saved_searches SET last_notified_at = ?, updated_at = ? WHERE id = ?`).run(
    isoNow(),
    isoNow(),
    savedSearchId,
  );
  return true;
}

function listingMatchesSavedSearch(db: DatabaseSync, row: SavedSearchRow, roomId: string): boolean {
  const { exact, similarHigh } = listingsForSavedSearchEmail(db, row);
  return exact.some((l) => l.id === roomId) || similarHigh.some((l) => l.id === roomId);
}

/** After a room is published, notify enabled saved searches that match. */
export async function onRoomPublished(db: DatabaseSync, roomId: string): Promise<void> {
  const rows = db
    .prepare(`SELECT * FROM saved_searches WHERE email_notify_enabled = 1`)
    .all() as SavedSearchRow[];
  for (const row of rows) {
    if (!listingMatchesSavedSearch(db, row, roomId)) continue;
    const notified = notifiedRoomIds(db, row.id);
    if (notified.has(roomId)) continue;
    try {
      await sendSavedSearchEmail(db, row.id, "follow_up");
    } catch (e) {
      console.error(`[saved-search] notify failed search=${row.id}:`, e instanceof Error ? e.message : e);
    }
  }
}

/** Poll all enabled saved searches for new matches. */
export async function pollSavedSearchNotifications(db: DatabaseSync): Promise<void> {
  const rows = db
    .prepare(`SELECT * FROM saved_searches WHERE email_notify_enabled = 1`)
    .all() as SavedSearchRow[];
  for (const row of rows) {
    try {
      await sendSavedSearchEmail(db, row.id, "follow_up");
    } catch (e) {
      console.error(`[saved-search] poll failed search=${row.id}:`, e instanceof Error ? e.message : e);
    }
  }
}

export function startSavedSearchPollWorker(db: DatabaseSync): () => void {
  const raw = Number(process.env.SAVED_SEARCH_POLL_MS);
  const ms = Number.isFinite(raw) && raw >= 60_000 ? raw : 20 * 60 * 1000;
  const t = setInterval(() => {
    void pollSavedSearchNotifications(db);
  }, ms);
  return () => clearInterval(t);
}

export function rowToApi(
  row: SavedSearchRow,
  matchCount?: number,
  areaNeighborhoods?: string[],
) {
  return {
    id: row.id,
    label: row.label,
    cityCode: row.city_code,
    searchUrl: row.search_url,
    emailNotifyEnabled: row.email_notify_enabled === 1,
    isDraft: row.is_draft === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    shareId: row.share_id ?? null,
    ...(matchCount != null ? { matchCount } : {}),
    ...(areaNeighborhoods && areaNeighborhoods.length
      ? { areaNeighborhoods }
      : {}),
  };
}

export function newSavedSearchId(): string {
  return randomUUID();
}

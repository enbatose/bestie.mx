import { randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { normalizeSourceFacebookUrl } from "./facebookPostUrl.js";
import { resolveMetroCity } from "./metroCities.js";
import { fetchPublishedListings } from "./publishedListingsQuery.js";
import {
  enableSavedSearchNotify,
  generateUnsubscribeToken,
  newSavedSearchId,
  rowToApi,
  type SavedSearchRow,
} from "./savedSearchNotify.js";
import {
  parseSavedSearchFilters,
  parseSavedSearchLocation,
  type SavedSearchLocationSnapshot,
} from "./savedSearchMatch.js";
import type { SearchFilters } from "./searchFilters.js";
import {
  composeSharedSearch,
  formatShareOgCaption,
  priceLabelFromFilters,
  type SharedSearchExtraction,
} from "./sharedSearchCompose.js";
import {
  highAffinitySimilar,
  parseSimilarConfig,
  splitSharedSearchMatches,
  type SharedSearchInsight,
  type SharedSearchNonNegotiable,
  type SharedSearchSimilarConfig,
} from "./sharedSearchMatch.js";
import type { PropertyListing } from "./types.js";

const SLUG_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

export type SharedSearchRow = {
  id: string;
  kind: string;
  forked_from_id: string | null;
  owner_user_id: string | null;
  created_by_user_id: string;
  source_facebook_url: string | null;
  source_facebook_key: string | null;
  seeker_name: string | null;
  seeker_gender: string | null;
  city_code: string;
  city_label: string | null;
  label: string;
  filters_json: string;
  location_json: string;
  similar_json: string;
  insights_json: string;
  non_negotiables_json: string;
  q_text: string | null;
  created_at: string;
  updated_at: string;
};

function isoNow(): string {
  return new Date().toISOString();
}

export function newShareSlug(): string {
  const bytes = randomBytes(8);
  let s = "";
  for (const b of bytes) s += SLUG_ALPHABET[b % SLUG_ALPHABET.length];
  return s;
}

export function loadSharedSearch(db: DatabaseSync, id: string): SharedSearchRow | null {
  const row = db.prepare(`SELECT * FROM shared_searches WHERE id = ?`).get(id) as SharedSearchRow | undefined;
  return row ?? null;
}

function uniqueSlug(db: DatabaseSync): string {
  for (let i = 0; i < 8; i++) {
    const id = newShareSlug();
    const exists = db.prepare(`SELECT 1 FROM shared_searches WHERE id = ?`).get(id);
    if (!exists) return id;
  }
  return `${newShareSlug()}${newShareSlug()}`.slice(0, 12);
}

export function analyzeSharedSearch(
  db: DatabaseSync,
  filters: SearchFilters,
  location: SavedSearchLocationSnapshot,
  similar: SharedSearchSimilarConfig,
): { exact: PropertyListing[]; similar: ReturnType<typeof splitSharedSearchMatches>["similar"] } {
  const published = fetchPublishedListings(db);
  return splitSharedSearchMatches(published, filters, location, similar);
}

export function matchQuality(exactCount: number, similarAvg: number, similarCount: number): "alta" | "media" | "baja" {
  if (exactCount >= 3) return "alta";
  if (exactCount >= 1 || (similarCount >= 4 && similarAvg >= 0.45)) return "media";
  return "baja";
}

function insertSharedSearch(
  db: DatabaseSync,
  row: SharedSearchRow,
): void {
  db.prepare(
    `INSERT INTO shared_searches (
      id, kind, forked_from_id, owner_user_id, created_by_user_id,
      source_facebook_url, source_facebook_key, seeker_name, seeker_gender,
      city_code, city_label, label, filters_json, location_json, similar_json,
      insights_json, non_negotiables_json, q_text, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.kind,
    row.forked_from_id,
    row.owner_user_id,
    row.created_by_user_id,
    row.source_facebook_url,
    row.source_facebook_key,
    row.seeker_name,
    row.seeker_gender,
    row.city_code,
    row.city_label,
    row.label,
    row.filters_json,
    row.location_json,
    row.similar_json,
    row.insights_json,
    row.non_negotiables_json,
    row.q_text,
    row.created_at,
    row.updated_at,
  );
}

export function upsertSharedSearch(db: DatabaseSync, row: SharedSearchRow): void {
  db.prepare(
    `INSERT INTO shared_searches (
      id, kind, forked_from_id, owner_user_id, created_by_user_id,
      source_facebook_url, source_facebook_key, seeker_name, seeker_gender,
      city_code, city_label, label, filters_json, location_json, similar_json,
      insights_json, non_negotiables_json, q_text, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      kind = excluded.kind,
      label = excluded.label,
      filters_json = excluded.filters_json,
      location_json = excluded.location_json,
      similar_json = excluded.similar_json,
      insights_json = excluded.insights_json,
      non_negotiables_json = excluded.non_negotiables_json,
      q_text = excluded.q_text,
      city_code = excluded.city_code,
      city_label = excluded.city_label,
      updated_at = excluded.updated_at`,
  ).run(
    row.id,
    row.kind,
    row.forked_from_id,
    row.owner_user_id,
    row.created_by_user_id,
    row.source_facebook_url,
    row.source_facebook_key,
    row.seeker_name,
    row.seeker_gender,
    row.city_code,
    row.city_label,
    row.label,
    row.filters_json,
    row.location_json,
    row.similar_json,
    row.insights_json,
    row.non_negotiables_json,
    row.q_text,
    row.created_at,
    row.updated_at,
  );
}

export function findSharedSearchesByFacebookUrl(db: DatabaseSync, rawUrl: string): SharedSearchRow[] {
  const norm = normalizeSourceFacebookUrl(rawUrl);
  if (!norm) return [];
  return db
    .prepare(
      `SELECT * FROM shared_searches WHERE source_facebook_key = ? ORDER BY created_at DESC LIMIT 8`,
    )
    .all(norm.key) as SharedSearchRow[];
}

export function createTemplateSharedSearch(
  db: DatabaseSync,
  opts: {
    adminUserId: string;
    city: string;
    seekerName: string;
    seekerGender: "female" | "male" | null;
    sourceFacebookUrl: string;
    extraction: SharedSearchExtraction;
  },
): {
  share: SharedSearchRow;
  exactCount: number;
  similarCount: number;
  similarHighCount: number;
  quality: "alta" | "media" | "baja";
  caption: string;
  sharePath: string;
  composed: ReturnType<typeof composeSharedSearch>;
} {
  const composed = composeSharedSearch({
    city: opts.city,
    seekerGender: opts.seekerGender,
    extraction: opts.extraction,
  });
  const now = isoNow();
  const fb = opts.sourceFacebookUrl.trim() ? normalizeSourceFacebookUrl(opts.sourceFacebookUrl) : null;
  const id = uniqueSlug(db);
  const share: SharedSearchRow = {
    id,
    kind: "template",
    forked_from_id: null,
    owner_user_id: null,
    created_by_user_id: opts.adminUserId,
    source_facebook_url: fb?.url ?? (opts.sourceFacebookUrl.trim() || null),
    source_facebook_key: fb?.key ?? null,
    seeker_name: opts.seekerName.trim() || null,
    seeker_gender: opts.seekerGender,
    city_code: composed.location.cityCode,
    city_label: composed.location.cityLabel ?? opts.city,
    label: composed.label,
    filters_json: JSON.stringify(composed.filters),
    location_json: JSON.stringify(composed.location),
    similar_json: JSON.stringify(composed.similar),
    insights_json: JSON.stringify(composed.insights),
    non_negotiables_json: JSON.stringify(composed.nonNegotiables),
    q_text: composed.qText || null,
    created_at: now,
    updated_at: now,
  };
  insertSharedSearch(db, share);
  const split = analyzeSharedSearch(db, composed.filters, composed.location, composed.similar);
  const similarHigh = highAffinitySimilar(split.similar);
  const metro = resolveMetroCity(composed.location.cityCode);
  const caption = formatShareOgCaption({
    exactCount: split.exact.length,
    similarCount: split.similar.length,
    cityAbbr: metro.abbr || metro.label,
    priceLabel: priceLabelFromFilters(composed.filters),
    mainArea: composed.mainArea,
  });
  const avg =
    split.similar.length > 0
      ? split.similar.reduce((s, r) => s + r.score, 0) / split.similar.length
      : 0;
  return {
    share,
    exactCount: split.exact.length,
    similarCount: split.similar.length,
    similarHighCount: similarHigh.length,
    quality: matchQuality(split.exact.length, avg, split.similar.length),
    caption,
    sharePath: `/busquedas/${id}`,
    composed,
  };
}

function insertUserSavedSearch(
  db: DatabaseSync,
  uid: string,
  share: SharedSearchRow,
): SavedSearchRow {
  const now = isoNow();
  const id = newSavedSearchId();
  const row: SavedSearchRow = {
    id,
    user_id: uid,
    label: share.label,
    city_code: share.city_code,
    filters_json: share.filters_json,
    location_json: share.location_json,
    search_url: `/busquedas/${share.id}`,
    email_notify_enabled: 0,
    unsubscribe_token: generateUnsubscribeToken(),
    last_notified_at: null,
    is_draft: 0,
    created_at: now,
    updated_at: now,
    share_id: share.id,
  };
  db.prepare(
    `INSERT INTO saved_searches (
      id, user_id, label, city_code, filters_json, location_json, search_url,
      email_notify_enabled, unsubscribe_token, last_notified_at, is_draft, created_at, updated_at, share_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, 0, ?, ?, ?)`,
  ).run(
    row.id,
    row.user_id,
    row.label,
    row.city_code,
    row.filters_json,
    row.location_json,
    row.search_url,
    row.unsubscribe_token,
    row.created_at,
    row.updated_at,
    share.id,
  );
  return row;
}

function cloneForkForUser(db: DatabaseSync, source: SharedSearchRow, uid: string): SharedSearchRow {
  const now = isoNow();
  const id = uniqueSlug(db);
  const row: SharedSearchRow = {
    ...source,
    id,
    kind: "fork",
    forked_from_id: source.id,
    owner_user_id: uid,
    created_by_user_id: uid,
    created_at: now,
    updated_at: now,
  };
  insertSharedSearch(db, row);
  return row;
}

export async function subscribeToSharedSearch(
  db: DatabaseSync,
  uid: string,
  slug: string,
): Promise<{
  share: SharedSearchRow;
  savedSearch: SavedSearchRow;
  subscribedNow: boolean;
  redirectedSlug?: string;
  exact: PropertyListing[];
  similar: ReturnType<typeof splitSharedSearchMatches>["similar"];
}> {
  const original = loadSharedSearch(db, slug);
  if (!original) {
    throw Object.assign(new Error("not_found"), { code: "not_found" });
  }

  let share = original;
  let redirectedSlug: string | undefined;
  if (share.kind === "fork" && share.owner_user_id && share.owner_user_id !== uid) {
    share = cloneForkForUser(db, share, uid);
    redirectedSlug = share.id;
  }

  const existing = db
    .prepare(`SELECT * FROM saved_searches WHERE user_id = ? AND share_id = ? AND is_draft = 0 LIMIT 1`)
    .get(uid, share.id) as SavedSearchRow | undefined;

  let saved: SavedSearchRow;
  let subscribedNow = false;
  if (existing) {
    saved = existing;
  } else {
    saved = insertUserSavedSearch(db, uid, share);
    subscribedNow = true;
  }

  await enableSavedSearchNotify(db, uid, saved.id, { requireEmail: false });
  saved = db.prepare(`SELECT * FROM saved_searches WHERE id = ?`).get(saved.id) as SavedSearchRow;

  const filters = parseSavedSearchFilters(share.filters_json);
  const location = parseSavedSearchLocation(share.location_json);
  const similarCfg = parseSimilarConfig(share.similar_json);
  const split = splitSharedSearchMatches(fetchPublishedListings(db), filters, location, similarCfg);

  return {
    share,
    savedSearch: saved,
    subscribedNow,
    redirectedSlug,
    exact: split.exact,
    similar: split.similar,
  };
}

export function forkSharedSearchOnEdit(
  db: DatabaseSync,
  uid: string,
  saved: SavedSearchRow,
  next: { filters: SearchFilters; location: SavedSearchLocationSnapshot; searchUrl: string },
): { shareId: string; searchUrl: string } | null {
  const shareId = saved.share_id?.trim();
  if (!shareId) return null;
  const share = loadSharedSearch(db, shareId);
  if (!share) return null;

  const now = isoNow();
  const ownsFork = share.kind === "fork" && share.owner_user_id === uid;
  if (ownsFork) {
    db.prepare(
      `UPDATE shared_searches
       SET filters_json = ?, location_json = ?, city_code = ?, updated_at = ?
       WHERE id = ?`,
    ).run(JSON.stringify(next.filters), JSON.stringify(next.location), next.location.cityCode, now, share.id);
    return { shareId: share.id, searchUrl: `/busquedas/${share.id}` };
  }

  const forked = cloneForkForUser(db, share, uid);
  db.prepare(
    `UPDATE shared_searches
     SET filters_json = ?, location_json = ?, city_code = ?, updated_at = ?
     WHERE id = ?`,
  ).run(JSON.stringify(next.filters), JSON.stringify(next.location), next.location.cityCode, now, forked.id);
  return { shareId: forked.id, searchUrl: `/busquedas/${forked.id}` };
}

export function sharedSearchPublicMeta(
  db: DatabaseSync,
  slug: string,
): {
  id: string;
  label: string;
  cityCode: string;
  cityLabel: string;
  caption: string;
  exactCount: number;
  similarCount: number;
  sharePath: string;
} | null {
  const share = loadSharedSearch(db, slug);
  if (!share) return null;
  const filters = parseSavedSearchFilters(share.filters_json);
  const location = parseSavedSearchLocation(share.location_json);
  const similarCfg = parseSimilarConfig(share.similar_json);
  const split = splitSharedSearchMatches(fetchPublishedListings(db), filters, location, similarCfg);
  const metro = resolveMetroCity(share.city_code);
  const insights = safeJsonArray<SharedSearchInsight>(share.insights_json);
  const mainArea =
    location.neighborhoods[0]?.name ||
    similarCfg.pois[0]?.name ||
    share.city_label ||
    metro.label;
  void insights;
  const caption = formatShareOgCaption({
    exactCount: split.exact.length,
    similarCount: split.similar.length,
    cityAbbr: metro.abbr || metro.label,
    priceLabel: priceLabelFromFilters(filters),
    mainArea,
  });
  return {
    id: share.id,
    label: share.label,
    cityCode: share.city_code,
    cityLabel: share.city_label || metro.label,
    caption,
    exactCount: split.exact.length,
    similarCount: split.similar.length,
    sharePath: `/busquedas/${share.id}`,
  };
}

function safeJsonArray<T>(raw: string): T[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

export function sharedSearchAdminPreview(
  db: DatabaseSync,
  composed: ReturnType<typeof composeSharedSearch>,
): {
  exact: PropertyListing[];
  similar: ReturnType<typeof splitSharedSearchMatches>["similar"];
  quality: "alta" | "media" | "baja";
  caption: string;
  insights: SharedSearchInsight[];
  nonNegotiables: SharedSearchNonNegotiable[];
} {
  const split = analyzeSharedSearch(db, composed.filters, composed.location, composed.similar);
  const avg =
    split.similar.length > 0
      ? split.similar.reduce((s, r) => s + r.score, 0) / split.similar.length
      : 0;
  const metro = resolveMetroCity(composed.location.cityCode);
  return {
    exact: split.exact,
    similar: split.similar,
    quality: matchQuality(split.exact.length, avg, split.similar.length),
    caption: formatShareOgCaption({
      exactCount: split.exact.length,
      similarCount: split.similar.length,
      cityAbbr: metro.abbr || metro.label,
      priceLabel: priceLabelFromFilters(composed.filters),
      mainArea: composed.mainArea,
    }),
    insights: composed.insights,
    nonNegotiables: composed.nonNegotiables,
  };
}

export { rowToApi };

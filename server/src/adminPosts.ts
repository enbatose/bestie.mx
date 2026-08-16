import type { DatabaseSync } from "node:sqlite";
import {
  listingReferenceId,
  propertyReferenceCode,
  roomReferenceCode,
} from "./listingReference.js";
import { posthogReplayUrl } from "./vendorUsageLimits.js";

/** Short Spanish labels for publish-wizard steps (aligned with client WIZARD_STEP_TITLES order). */
export const ADMIN_WIZARD_STEP_LABELS = [
  "Tipo de espacio",
  "Ubicación",
  "Cómo es el espacio",
  "Recámaras",
  "Fotos",
  "Etiquetar fotos",
  "Revisar y publicar",
] as const;

export const ADMIN_POSTS_PAGE_SIZES = [10, 25, 50, 100] as const;

export type AdminPostStatus = "draft" | "published" | "paused" | "archived";

export type AdminPostRow = {
  propertyId: string;
  shortId: string;
  postMode: "room" | "property";
  title: string;
  city: string;
  neighborhood: string;
  status: AdminPostStatus;
  createdAt: string | null;
  publishedAt: string | null;
  wizardStep: number | null;
  wizardStepLabel: string | null;
  creatorLoggedIn: boolean;
  creatorUserId: string | null;
  creatorDisplayName: string | null;
  creatorEmail: string | null;
  feedbackCompleted: boolean;
  feedbackRating: number | null;
  feedbackComment: string | null;
  feedbackAt: string | null;
  posthogSessionId: string | null;
  posthogReplayUrl: string | null;
  viewPath: string;
  editPath: string;
  primaryRoomId: string | null;
  /** True when the listing was created by the admin AI-assisted draft flow. */
  assistedDraft: boolean;
};

/** 1-based `paso` for the wizard review step (`publishWizardLastStepIndex` + 1). */
function wizardReviewPaso(postMode: "room" | "property"): number {
  return postMode === "property" ? 5 : 6;
}

export function adminPostEditPath(opts: {
  propertyId: string;
  postMode: "room" | "property";
  status: AdminPostStatus;
  assistedDraft: boolean;
  claimToken: string | null;
}): string {
  if (opts.assistedDraft && opts.status === "draft" && opts.claimToken) {
    return `/borrador/${encodeURIComponent(opts.claimToken)}`;
  }
  if (opts.assistedDraft && opts.status === "draft") {
    return `/publicar?edit=${encodeURIComponent(propertyReferenceCode(opts.propertyId))}&paso=${wizardReviewPaso(opts.postMode)}`;
  }
  return `/publicar?edit=${encodeURIComponent(opts.propertyId)}`;
}

export type AdminPostsListResult = {
  posts: AdminPostRow[];
  total: number;
  limit: number;
  offset: number;
};

function isAdminPostStatus(v: string): v is AdminPostStatus {
  return v === "draft" || v === "published" || v === "paused" || v === "archived";
}

function wizardStepLabel(step: number | null): string | null {
  if (step == null || !Number.isFinite(step)) return null;
  const i = Math.floor(step);
  if (i < 0 || i >= ADMIN_WIZARD_STEP_LABELS.length) return `Paso ${i + 1}`;
  return ADMIN_WIZARD_STEP_LABELS[i]!;
}

function escapeLike(token: string): string {
  return token.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * List all properties for the admin Posts report with search, status filter, and pagination.
 */
export function listAdminPosts(
  db: DatabaseSync,
  opts: {
    q?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {},
): AdminPostsListResult {
  const rawLimit = Number(opts.limit);
  const limit = ADMIN_POSTS_PAGE_SIZES.includes(rawLimit as (typeof ADMIN_POSTS_PAGE_SIZES)[number])
    ? (rawLimit as (typeof ADMIN_POSTS_PAGE_SIZES)[number])
    : 25;
  const offset = Math.max(0, Math.floor(Number(opts.offset) || 0));

  const statusFilter =
    typeof opts.status === "string" && isAdminPostStatus(opts.status.trim())
      ? opts.status.trim()
      : null;

  const rawQ = typeof opts.q === "string" ? opts.q.trim().slice(0, 240) : "";
  const tokens =
    rawQ.length > 0
      ? rawQ
          .split(/\s+/)
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 12)
      : [];

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (statusFilter) {
    conditions.push(`p.status = ?`);
    params.push(statusFilter);
  }

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (lower === "ia" || lower === "ai" || lower === "asistido") {
      conditions.push(`IFNULL(p.assisted_draft, 0) = 1`);
      continue;
    }

    const like = `%${escapeLike(token)}%`;
    const upper = token.toUpperCase();
    const hexFromShort =
      /^[AP]([A-F0-9]{8})$/i.test(token) || /^BES-[AP]-([A-F0-9]{8})$/i.test(token)
        ? (token.match(/([A-F0-9]{8})$/i)?.[1] ?? "").toUpperCase()
        : "";

    const parts = [
      `p.title LIKE ? ESCAPE '\\'`,
      `p.city LIKE ? ESCAPE '\\'`,
      `p.neighborhood LIKE ? ESCAPE '\\'`,
      `p.status LIKE ? ESCAPE '\\'`,
      `p.id LIKE ? ESCAPE '\\'`,
      `IFNULL(p.posthog_session_id, '') LIKE ? ESCAPE '\\'`,
      `IFNULL(p.feedback_comment, '') LIKE ? ESCAPE '\\'`,
      `IFNULL(u.email, '') LIKE ? ESCAPE '\\'`,
      `IFNULL(u.display_name, '') LIKE ? ESCAPE '\\'`,
      `IFNULL(CAST(p.wizard_step AS TEXT), '') LIKE ? ESCAPE '\\'`,
      `IFNULL(CAST(p.feedback_rating AS TEXT), '') LIKE ? ESCAPE '\\'`,
    ];
    params.push(like, like, like, like, like, like, like, like, like, like, like);

    // Match short codes against property / room UUID hex prefixes.
    if (hexFromShort) {
      parts.push(
        `UPPER(REPLACE(REPLACE(p.id, 'prp__', ''), '-', '')) LIKE ? ESCAPE '\\'`,
        `EXISTS (
           SELECT 1 FROM rooms rk
           WHERE rk.property_id = p.id
             AND UPPER(REPLACE(rk.id, '-', '')) LIKE ? ESCAPE '\\'
         )`,
      );
      params.push(`${hexFromShort}%`, `${hexFromShort}%`);
    } else if (/^[A-F0-9]{4,}$/i.test(token)) {
      parts.push(
        `UPPER(REPLACE(REPLACE(p.id, 'prp__', ''), '-', '')) LIKE ? ESCAPE '\\'`,
        `EXISTS (
           SELECT 1 FROM rooms rk
           WHERE rk.property_id = p.id
             AND UPPER(REPLACE(rk.id, '-', '')) LIKE ? ESCAPE '\\'
         )`,
      );
      params.push(`${upper}%`, `${upper}%`);
    }

    // Logged-in / guest keyword aliases.
    if (
      lower === "logueado" ||
      lower === "logged" ||
      lower === "logged-in" ||
      lower === "sesión" ||
      lower === "sesion"
    ) {
      parts.push(`u.id IS NOT NULL`);
    }
    if (
      lower === "invitado" ||
      lower === "guest" ||
      lower === "sin-sesión" ||
      lower === "sin-sesion" ||
      lower === "unlogged"
    ) {
      parts.push(`u.id IS NULL`);
    }

    // Wizard step label keyword (e.g. "fotos", "ubicación").
    for (let i = 0; i < ADMIN_WIZARD_STEP_LABELS.length; i++) {
      if (ADMIN_WIZARD_STEP_LABELS[i]!.toLowerCase().includes(lower)) {
        parts.push(`p.wizard_step = ?`);
        params.push(i);
      }
    }

    conditions.push(`(${parts.join(" OR ")})`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const fromSql = `
    FROM properties p
    LEFT JOIN user_publishers up ON up.publisher_id = p.publisher_id
    LEFT JOIN users u ON u.id = up.user_id
  `;

  const total = (
    db.prepare(`SELECT COUNT(*) AS c ${fromSql} ${where}`).get(...params) as { c: number }
  ).c;

  // Bind claim expiry with Date.now() interpolation, not "?": a SELECT-list
  // placeholder is filled before WHERE/LIMIT and emptied the published filter.
  const rows = db
    .prepare(
      `
      SELECT
        p.id AS property_id,
        p.publisher_id,
        p.status,
        p.post_mode,
        p.title,
        p.city,
        p.neighborhood,
        p.created_at,
        p.published_at,
        p.wizard_step,
        p.posthog_session_id,
        p.feedback_rating,
        p.feedback_comment,
        p.feedback_at,
        IFNULL(p.assisted_draft, 0) AS assisted_draft,
        u.id AS user_id,
        u.email AS user_email,
        u.display_name AS user_display_name,
        (
          SELECT r.id FROM rooms r
          WHERE r.property_id = p.id
          ORDER BY
            CASE r.status
              WHEN 'published' THEN 0
              WHEN 'paused' THEN 1
              WHEN 'draft' THEN 2
              ELSE 3
            END,
            r.sort_order ASC,
            r.id ASC
          LIMIT 1
        ) AS primary_room_id,
        (
          SELECT t.token FROM assisted_draft_claim_tokens t
          WHERE t.property_id = p.id
            AND t.claimed_by_user_id IS NULL
            AND t.expires_at > ${Date.now()}
          ORDER BY t.created_at DESC
          LIMIT 1
        ) AS claim_token
      ${fromSql}
      ${where}
      ORDER BY COALESCE(p.created_at, '') DESC, p.id DESC
      LIMIT ? OFFSET ?
    `,
    )
    .all(...params, limit, offset) as Record<string, unknown>[];

  const posts: AdminPostRow[] = rows.map((row) => {
    const propertyId = String(row.property_id);
    const postMode = String(row.post_mode ?? "property") === "room" ? "room" : "property";
    const statusRaw = String(row.status ?? "draft");
    const status: AdminPostStatus = isAdminPostStatus(statusRaw) ? statusRaw : "draft";
    const primaryRoomId =
      row.primary_room_id != null && String(row.primary_room_id).trim()
        ? String(row.primary_room_id)
        : null;
    const wizardStep =
      row.wizard_step != null && Number.isFinite(Number(row.wizard_step))
        ? Math.floor(Number(row.wizard_step))
        : null;
    const sessionId =
      row.posthog_session_id != null && String(row.posthog_session_id).trim()
        ? String(row.posthog_session_id).trim()
        : null;
    const feedbackRating =
      row.feedback_rating != null && Number.isFinite(Number(row.feedback_rating))
        ? Math.floor(Number(row.feedback_rating))
        : null;
    const feedbackComment =
      row.feedback_comment != null && String(row.feedback_comment).trim()
        ? String(row.feedback_comment)
        : null;
    const creatorUserId =
      row.user_id != null && String(row.user_id).trim() ? String(row.user_id) : null;

    const shortId =
      postMode === "room" && primaryRoomId
        ? roomReferenceCode(primaryRoomId)
        : propertyReferenceCode(propertyId);

    const viewPath =
      postMode === "room" && primaryRoomId
        ? `/anuncio/${roomReferenceCode(primaryRoomId)}`
        : `/propiedad/${propertyReferenceCode(propertyId)}`;
    const assistedDraft = Number(row.assisted_draft) === 1;
    const claimToken =
      row.claim_token != null && String(row.claim_token).trim()
        ? String(row.claim_token).trim()
        : null;

    return {
      propertyId,
      shortId,
      postMode,
      title: String(row.title ?? ""),
      city: String(row.city ?? ""),
      neighborhood: String(row.neighborhood ?? ""),
      status,
      createdAt: row.created_at != null ? String(row.created_at) : null,
      publishedAt: row.published_at != null ? String(row.published_at) : null,
      wizardStep,
      wizardStepLabel: status === "draft" ? wizardStepLabel(wizardStep) : null,
      creatorLoggedIn: creatorUserId != null,
      creatorUserId,
      creatorDisplayName:
        row.user_display_name != null ? String(row.user_display_name) : null,
      creatorEmail: row.user_email != null ? String(row.user_email) : null,
      feedbackCompleted: feedbackRating != null,
      feedbackRating,
      feedbackComment,
      feedbackAt: row.feedback_at != null ? String(row.feedback_at) : null,
      posthogSessionId: sessionId,
      posthogReplayUrl: posthogReplayUrl(sessionId),
      viewPath,
      editPath: adminPostEditPath({
        propertyId,
        postMode,
        status,
        assistedDraft,
        claimToken,
      }),
      primaryRoomId,
      assistedDraft,
    };
  });

  return { posts, total, limit, offset };
}

/** Resolve room → property and store publish-flow feedback on the property row. */
export function attachPublishFeedbackToProperty(
  db: DatabaseSync,
  opts: {
    listingRoomId?: string | null;
    rating: number;
    comment: string;
    /** When true, do not overwrite an existing rating (used by message backfill). */
    onlyIfEmpty?: boolean;
  },
): boolean {
  const roomId = typeof opts.listingRoomId === "string" ? opts.listingRoomId.trim() : "";
  if (!roomId) return false;

  const room = db.prepare(`SELECT property_id FROM rooms WHERE id = ?`).get(roomId) as
    | { property_id: string }
    | undefined;
  if (room?.property_id) {
    return writeFeedback(db, room.property_id, opts.rating, opts.comment, opts.onlyIfEmpty);
  }

  // Allow short codes: A550E8400 / BES-A-550E8400 / PBD66DF78 / BES-P-BD66DF78.
  const propertyCode = roomId.match(/^(?:BES-)?P([A-F0-9]{8})$/i)?.[1]?.toUpperCase();
  if (propertyCode) {
    const props = db.prepare(`SELECT id FROM properties`).all() as { id: string }[];
    const match = props.find((p) => listingReferenceId(p.id) === propertyCode);
    if (!match) return false;
    return writeFeedback(db, match.id, opts.rating, opts.comment, opts.onlyIfEmpty);
  }

  const roomCode = roomId.match(/^(?:BES-)?A([A-F0-9]{8})$/i)?.[1]?.toUpperCase();
  if (!roomCode) return false;
  const rows = db.prepare(`SELECT id, property_id FROM rooms`).all() as {
    id: string;
    property_id: string;
  }[];
  const match = rows.find((r) => listingReferenceId(r.id) === roomCode);
  if (!match) return false;
  return writeFeedback(db, match.property_id, opts.rating, opts.comment, opts.onlyIfEmpty);
}

function writeFeedback(
  db: DatabaseSync,
  propertyId: string,
  rating: number,
  comment: string,
  onlyIfEmpty = false,
): boolean {
  const now = new Date().toISOString();
  const r = onlyIfEmpty
    ? db
        .prepare(
          `UPDATE properties
           SET feedback_rating = ?, feedback_comment = ?, feedback_at = ?
           WHERE id = ? AND feedback_rating IS NULL`,
        )
        .run(rating, comment.trim() || null, now, propertyId)
    : db
        .prepare(
          `UPDATE properties
           SET feedback_rating = ?, feedback_comment = ?, feedback_at = ?
           WHERE id = ?`,
        )
        .run(rating, comment.trim() || null, now, propertyId);
  return r.changes > 0;
}

const FEEDBACK_RATING_LINE = /^[★☆]{1,5}\s+(\d)\s*\/\s*5\b/m;
const FEEDBACK_LISTING_LINK =
  /\/(?:anuncio|propiedad)\/((?:BES-[AP]-)?[AP][A-F0-9]{8})\b/i;

/**
 * Backfill `properties.feedback_*` from existing publish-feedback chat messages.
 * Needed for grades submitted before admin Posts denormalization shipped.
 * Idempotent: only fills rows that still have null feedback_rating.
 */
export function backfillPublishFeedbackFromMessages(db: DatabaseSync): number {
  const rows = db
    .prepare(
      `
      SELECT m.body, m.created_at
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE c.kind = 'feedback'
        AND (
          c.context_title LIKE 'Feedback · Publicaci%'
          OR m.body LIKE '%Contexto:%'
        )
      ORDER BY m.created_at ASC
    `,
    )
    .all() as { body: string; created_at: string }[];

  let attached = 0;
  for (const row of rows) {
    const body = typeof row.body === "string" ? row.body : "";
    const ratingMatch = body.match(FEEDBACK_RATING_LINE);
    if (!ratingMatch) continue;
    const rating = Number(ratingMatch[1]);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) continue;

    const linkMatch = body.match(FEEDBACK_LISTING_LINK);
    if (!linkMatch?.[1]) continue;
    const listingRef = linkMatch[1];

    let comment = "";
    const afterRating = body.slice((ratingMatch.index ?? 0) + ratingMatch[0].length);
    const contextoIdx = afterRating.search(/\n\s*Contexto:\s*/i);
    if (contextoIdx >= 0) {
      comment = afterRating.slice(0, contextoIdx).trim();
    }

    if (
      attachPublishFeedbackToProperty(db, {
        listingRoomId: listingRef,
        rating,
        comment,
        onlyIfEmpty: true,
      })
    ) {
      attached += 1;
    }
  }
  return attached;
}

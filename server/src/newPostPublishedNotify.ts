import type { DatabaseSync } from "node:sqlite";
import { posthogReplayUrl } from "./vendorUsageLimits.js";
import { buildNewPostPublishedEmail } from "./emails/newPostPublishedEmail.js";
import { resolveContactForwardTo } from "./resendWebhook.js";
import { sendTransactionalEmail } from "./mailer.js";
import { propertyReferenceCode, roomReferenceCode } from "./listingReference.js";
import { isProductionPublicSite, publicBaseUrl } from "./publicBaseUrl.js";

export function isFirstPropertyPublish(
  previousStatus: string,
  previousPublishedAt: string | null | undefined,
  nextStatus: string,
): boolean {
  if (nextStatus !== "published") return false;
  if (previousStatus === "published") return false;
  return previousPublishedAt == null || String(previousPublishedAt).trim() === "";
}

function loadNotifyPayload(db: DatabaseSync, propertyId: string) {
  const row = db
    .prepare(
      `
      SELECT
        p.id AS property_id,
        p.status,
        p.post_mode,
        p.title,
        p.city,
        p.neighborhood,
        p.posthog_session_id,
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
        ) AS primary_room_id
      FROM properties p
      LEFT JOIN user_publishers up ON up.publisher_id = p.publisher_id
      LEFT JOIN users u ON u.id = up.user_id
      WHERE p.id = ?
      LIMIT 1
    `,
    )
    .get(propertyId) as Record<string, unknown> | undefined;
  if (!row) return null;

  const postMode = String(row.post_mode ?? "property") === "room" ? "room" : "property";
  const primaryRoomId =
    row.primary_room_id != null && String(row.primary_room_id).trim()
      ? String(row.primary_room_id)
      : null;
  const shortId =
    postMode === "room" && primaryRoomId
      ? roomReferenceCode(primaryRoomId)
      : propertyReferenceCode(String(row.property_id));
  const viewPath =
    postMode === "room" && primaryRoomId
      ? `/anuncio/${roomReferenceCode(primaryRoomId)}`
      : `/propiedad/${propertyReferenceCode(String(row.property_id))}`;
  const sessionId =
    row.posthog_session_id != null && String(row.posthog_session_id).trim()
      ? String(row.posthog_session_id).trim()
      : null;

  return {
    title: String(row.title ?? ""),
    city: String(row.city ?? ""),
    neighborhood: String(row.neighborhood ?? ""),
    postUrl: `${publicBaseUrl()}${viewPath}`,
    replayUrl: posthogReplayUrl(sessionId),
    publisherName: row.user_display_name != null ? String(row.user_display_name) : null,
    publisherEmail: row.user_email != null ? String(row.user_email) : null,
    shortId,
  };
}

/** Ops first-publish emails only on Prod — skip Dev / local even if mail is configured. */
export function shouldNotifyOpsNewPostPublished(): boolean {
  return isProductionPublicSite();
}

export async function notifyOpsNewPostPublished(db: DatabaseSync, propertyId: string): Promise<boolean> {
  if (!shouldNotifyOpsNewPostPublished()) {
    console.info(`[new-post] notify skipped: not production (${publicBaseUrl()})`);
    return false;
  }
  const payload = loadNotifyPayload(db, propertyId);
  if (!payload) {
    console.warn(`[new-post] notify skipped: property not found id=${propertyId}`);
    return false;
  }
  const mail = buildNewPostPublishedEmail(payload);
  return sendTransactionalEmail({
    to: resolveContactForwardTo(),
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    previewText: mail.previewText,
    replyTo: mail.replyTo,
    tags: mail.tags,
  });
}

/** Fire-and-forget first-publish alert to ops Gmail (not contacto@ — that inbound-loops). */
export function scheduleNotifyOpsNewPostPublished(db: DatabaseSync, propertyId: string): void {
  void notifyOpsNewPostPublished(db, propertyId).catch((e) => {
    console.error(
      `[new-post] notify failed property=${propertyId}:`,
      e instanceof Error ? e.message : e,
    );
  });
}

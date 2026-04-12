import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export function publicWebOrigin(): string {
  return process.env.PUBLIC_WEB_ORIGIN?.replace(/\/$/, "") || "https://bestie.mx";
}

/**
 * Creates a single-use Messenger → web publish handoff URL for the given publisher.
 */
export function createPublishHandoff(
  db: DatabaseSync,
  publisherId: string,
  draftPropertyId: string | null,
): { token: string; url: string } {
  const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 8);
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  db.prepare(
    `INSERT INTO messenger_handoff_tokens (token, publisher_id, draft_property_id, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)`,
  ).run(token, publisherId, draftPropertyId, exp, Date.now());
  const base = publicWebOrigin();
  return { token, url: `${base}/publicar?handoff=${encodeURIComponent(token)}` };
}

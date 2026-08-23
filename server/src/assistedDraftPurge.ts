import type { DatabaseSync } from "node:sqlite";
import { SELF_SERVE_CREATOR_ID } from "./assistedDraftMerge.js";

/** Claim link + retention for admin outreach assisted drafts (unclaimed → deleted). */
export const ADMIN_OUTREACH_CLAIM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Self-serve compose claim links keep a longer window (no auto-delete of the draft). */
export const SELF_SERVE_CLAIM_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type PurgeUnclaimedAdminAssistedDraftsResult = {
  deletedProperties: number;
  propertyIds: string[];
};

/**
 * Deletes admin-outreach assisted drafts that were never claimed and are older than
 * {@link ADMIN_OUTREACH_CLAIM_TTL_MS}. Self-serve drafts are left alone.
 *
 * Safety: only `status = 'draft'` + `assisted_draft = 1` + unclaimed token + not self-serve.
 */
export function purgeUnclaimedAdminAssistedDrafts(
  db: DatabaseSync,
  nowMs: number = Date.now(),
): PurgeUnclaimedAdminAssistedDraftsResult {
  const cutoff = nowMs - ADMIN_OUTREACH_CLAIM_TTL_MS;
  const rows = db
    .prepare(
      `SELECT DISTINCT t.property_id AS property_id
       FROM assisted_draft_claim_tokens t
       INNER JOIN properties p ON p.id = t.property_id
       WHERE t.claimed_by_user_id IS NULL
         AND t.created_by_admin_id != ?
         AND t.created_at < ?
         AND IFNULL(p.assisted_draft, 0) = 1
         AND p.status = 'draft'`,
    )
    .all(SELF_SERVE_CREATOR_ID, cutoff) as { property_id: string }[];

  const propertyIds = rows.map((r) => String(r.property_id)).filter(Boolean);
  if (propertyIds.length === 0) {
    return { deletedProperties: 0, propertyIds: [] };
  }

  const deleteTokens = db.prepare(`DELETE FROM assisted_draft_claim_tokens WHERE property_id = ?`);
  const deleteRooms = db.prepare(`DELETE FROM rooms WHERE property_id = ?`);
  const deleteProperty = db.prepare(`DELETE FROM properties WHERE id = ?`);

  const deleted: string[] = [];
  for (const propertyId of propertyIds) {
    try {
      db.exec("BEGIN IMMEDIATE;");
      deleteTokens.run(propertyId);
      deleteRooms.run(propertyId);
      deleteProperty.run(propertyId);
      db.exec("COMMIT;");
      deleted.push(propertyId);
    } catch (err) {
      try {
        db.exec("ROLLBACK;");
      } catch {
        /* ignore */
      }
      console.error(
        `[assisted-draft-purge] failed property=${propertyId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (deleted.length > 0) {
    console.log(`[assisted-draft-purge] deleted ${deleted.length} unclaimed admin draft(s)`);
  }

  return { deletedProperties: deleted.length, propertyIds: deleted };
}

export function startAssistedDraftPurgeWorker(db: DatabaseSync): () => void {
  const raw = Number(process.env.ASSISTED_DRAFT_PURGE_MS);
  const ms = Number.isFinite(raw) && raw >= 60_000 ? raw : 60 * 60 * 1000;
  const run = () => {
    try {
      purgeUnclaimedAdminAssistedDrafts(db);
    } catch (e) {
      console.error(
        "[assisted-draft-purge] poll failed:",
        e instanceof Error ? e.message : e,
      );
    }
  };
  // Catch up shortly after boot, then on an hourly cadence.
  const boot = setTimeout(run, 15_000);
  const t = setInterval(run, ms);
  return () => {
    clearTimeout(boot);
    clearInterval(t);
  };
}

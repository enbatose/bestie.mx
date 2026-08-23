import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb } from "./db.js";
import { SELF_SERVE_CREATOR_ID } from "./assistedDraftMerge.js";
import {
  ADMIN_OUTREACH_CLAIM_TTL_MS,
  purgeUnclaimedAdminAssistedDrafts,
} from "./assistedDraftPurge.js";

const PROP_SUMMARY =
  "Descripción de la propiedad lo bastante larga para pruebas de purga de borradores asistidos (≥100 caracteres).";

function insertAdminDraft(
  db: DatabaseSync,
  opts: {
    propertyId: string;
    roomId: string;
    token: string;
    createdAtMs: number;
    claimed?: boolean;
    status?: string;
    creatorId?: string;
  },
): void {
  const creator = opts.creatorId ?? "admin-user-1";
  const nowIso = new Date(opts.createdAtMs).toISOString();
  db.prepare(
    `INSERT INTO properties (
       id, publisher_id, status, post_mode, title, city, neighborhood, lat, lng,
       summary, contact_whatsapp, created_at, assisted_draft, created_by_admin_id
     ) VALUES (?, ?, ?, 'property', 'Casa AI', 'Guadalajara', 'Centro', 20.67, -103.35,
       ?, '523331112233', ?, 1, ?)`,
  ).run(
    opts.propertyId,
    `pub-${opts.propertyId}`,
    opts.status ?? "draft",
    PROP_SUMMARY,
    nowIso,
    creator,
  );
  db.prepare(
    `INSERT INTO rooms (
       id, property_id, status, title, rent_mxn, rooms_available, tags_json,
       roommate_gender_pref, age_min, age_max, summary, created_at, updated_at
     ) VALUES (?, ?, 'draft', 'Cuarto', 5000, 1, '[]', 'any', 18, 40, ?, ?, ?)`,
  ).run(opts.roomId, opts.propertyId, PROP_SUMMARY, nowIso, nowIso);
  db.prepare(
    `INSERT INTO assisted_draft_claim_tokens (
       token, property_id, created_by_admin_id, orphan_publisher_id,
       expires_at, created_at, claimed_by_user_id, claimed_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    opts.token,
    opts.propertyId,
    creator,
    `pub-${opts.propertyId}`,
    opts.createdAtMs + ADMIN_OUTREACH_CLAIM_TTL_MS,
    opts.createdAtMs,
    opts.claimed ? "user-1" : null,
    opts.claimed ? opts.createdAtMs + 1000 : null,
  );
}

describe("purgeUnclaimedAdminAssistedDrafts", () => {
  let dir: string;
  let db: DatabaseSync;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-ad-purge-"));
    db = openDb(join(dir, "t.db"));
  });

  afterEach(() => {
    db.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  it("deletes unclaimed admin outreach drafts older than 7 days", () => {
    const now = Date.now();
    insertAdminDraft(db, {
      propertyId: "prp__old-unclaimed",
      roomId: "room-old-unclaimed",
      token: "tokoldunclaimed1234567890abcdef12",
      createdAtMs: now - ADMIN_OUTREACH_CLAIM_TTL_MS - 60_000,
    });

    const result = purgeUnclaimedAdminAssistedDrafts(db, now);
    expect(result.deletedProperties).toBe(1);
    expect(result.propertyIds).toEqual(["prp__old-unclaimed"]);
    expect(
      db.prepare(`SELECT COUNT(*) AS c FROM properties WHERE id = ?`).get("prp__old-unclaimed") as {
        c: number;
      },
    ).toEqual({ c: 0 });
    expect(
      db.prepare(`SELECT COUNT(*) AS c FROM rooms WHERE property_id = ?`).get("prp__old-unclaimed") as {
        c: number;
      },
    ).toEqual({ c: 0 });
    expect(
      db
        .prepare(`SELECT COUNT(*) AS c FROM assisted_draft_claim_tokens WHERE property_id = ?`)
        .get("prp__old-unclaimed") as { c: number },
    ).toEqual({ c: 0 });
  });

  it("keeps recent unclaimed, claimed, self-serve, and published drafts", () => {
    const now = Date.now();
    insertAdminDraft(db, {
      propertyId: "prp__fresh",
      roomId: "room-fresh",
      token: "tokfresh1234567890abcdef123456789",
      createdAtMs: now - 2 * 24 * 60 * 60 * 1000,
    });
    insertAdminDraft(db, {
      propertyId: "prp__claimed",
      roomId: "room-claimed",
      token: "tokclaimed1234567890abcdef1234567",
      createdAtMs: now - ADMIN_OUTREACH_CLAIM_TTL_MS - 60_000,
      claimed: true,
      status: "published",
    });
    insertAdminDraft(db, {
      propertyId: "prp__self",
      roomId: "room-self",
      token: "tokselfserve1234567890abcdef12345",
      createdAtMs: now - ADMIN_OUTREACH_CLAIM_TTL_MS - 60_000,
      creatorId: SELF_SERVE_CREATOR_ID,
    });

    const result = purgeUnclaimedAdminAssistedDrafts(db, now);
    expect(result.deletedProperties).toBe(0);
    for (const id of ["prp__fresh", "prp__claimed", "prp__self"]) {
      expect(
        db.prepare(`SELECT COUNT(*) AS c FROM properties WHERE id = ?`).get(id) as { c: number },
      ).toEqual({ c: 1 });
    }
  });
});

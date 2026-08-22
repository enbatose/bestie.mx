import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./appFactory.js";
import { openDb } from "./db.js";
import { AUTH_COOKIE, signAuthToken } from "./jwtSession.js";

/**
 * Assisted / AI-claim publish must store posthog_session_id so admin
 * "Ver session replay" works for every create path.
 */
describe("assisted draft claim publish stores PostHog session", () => {
  let dir: string;
  let dbPath: string;
  let db: DatabaseSync;
  let app: ReturnType<typeof createApp>;
  const prevSecret = process.env.AUTH_JWT_SECRET;

  const token = "claimtokenposthog1234567890abcdef";
  const propertyId = "prp__adraft_posthog_sess01";
  const roomId = "adraft_room__posthog_sess01";
  const orphanPub = "orphan-pub-posthog";
  let userId: string;

  beforeAll(() => {
    process.env.AUTH_JWT_SECRET = "test-secret-assisted-claim-posthog-xx";
    dir = mkdtempSync(join(tmpdir(), "bestie-adraft-ph-"));
    dbPath = join(dir, "test.db");
    db = openDb(dbPath);
    app = createApp(db, { databaseLabel: "test.db", databasePath: dbPath });

    userId = randomUUID();
    const now = new Date().toISOString();

    // Match columns used by assistedDraftClaimSave.test.ts / openDb schema.
    db.prepare(
      `INSERT INTO users (id, email, email_canonical, password_hash, display_name, email_verified_at, created_at)
       VALUES (?, 'claim-ph@example.com', 'claim-ph@example.com', 'x', 'Claimer', datetime('now'), datetime('now'))`,
    ).run(userId);

    db.prepare(`
      INSERT INTO properties (
        id, publisher_id, status, post_mode, title, city, neighborhood,
        lat, lng, summary, contact_whatsapp, property_kind,
        bedrooms_total, bathrooms, show_whatsapp, image_urls_json,
        is_approximate_location, approximate_radius_m,
        created_at, assisted_draft, created_by_admin_id
      ) VALUES (
        ?, ?, 'draft', 'room', 'Habitación claim PostHog', 'Guadalajara', 'Americana',
        20.67, -103.35, '', '', 'house',
        1, 1, 0, '[]',
        1, 200,
        ?, 1, 'admin-test'
      )
    `).run(propertyId, orphanPub, now);

    db.prepare(`
      INSERT INTO rooms (
        id, property_id, status, title, rent_mxn, rooms_available, tags_json,
        roommate_gender_pref, age_min, age_max, summary, lodging_type,
        available_from, minimal_stay_months, room_dimension,
        aval_required, sublet_allowed, sort_order, deposit_mxn,
        image_urls_json, created_at, updated_at
      ) VALUES (
        ?, ?, 'draft', '', 5500, 1, '[]',
        'any', 18, 99, '', 'private_room',
        ?, 1, 'medium',
        0, 0, 0, 0,
        '[]', ?, ?
      )
    `).run(roomId, propertyId, now.slice(0, 10), now, now);

    db.prepare(`
      INSERT INTO assisted_draft_claim_tokens (
        token, property_id, created_by_admin_id, orphan_publisher_id,
        expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(token, propertyId, "admin-test", orphanPub, Date.now() + 86_400_000, Date.now());
  });

  afterAll(() => {
    process.env.AUTH_JWT_SECRET = prevSecret;
    db.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  it("persists posthogSessionId from the claim publish body", async () => {
    const sessionId = "019claim-posthog-session-id-xyz";
    const auth = signAuthToken(userId, 3600);

    const res = await request(app)
      .post(`/api/assisted-draft/claim/${token}/publish`)
      .set("Cookie", `${AUTH_COOKIE}=${encodeURIComponent(auth)}`)
      .send({ posthogSessionId: sessionId });

    expect(res.status).toBe(200);

    const row = db
      .prepare(`SELECT status, posthog_session_id FROM properties WHERE id = ?`)
      .get(propertyId) as { status: string; posthog_session_id: string | null };

    expect(row.status).toBe("published");
    expect(row.posthog_session_id).toBe(sessionId);
  });
});

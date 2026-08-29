import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./appFactory.js";
import { openDb } from "./db.js";

describe("outreach listing claim preview", () => {
  let dir: string;
  let dbPath: string;
  let db: DatabaseSync;
  let app: ReturnType<typeof createApp>;
  const token = "claimpreviewtoken1234567890ab";
  const propertyId = "prp__adraft_claimpreview01";
  const roomId = "adraft_room__claimpreview01";

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-outreach-"));
    dbPath = join(dir, "t.db");
    db = openDb(dbPath);
    app = createApp(db, { databaseLabel: "t.db", databasePath: dbPath });
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO properties (
        id, publisher_id, status, post_mode, title, city, neighborhood,
        lat, lng, summary, contact_whatsapp, property_kind,
        bedrooms_total, bathrooms, show_whatsapp, image_urls_json,
        is_approximate_location, approximate_radius_m,
        created_at, assisted_draft, created_by_admin_id
      ) VALUES (
        ?, ?, 'draft', 'room', 'Cuarto claim', 'Guadalajara', 'Centro',
        20.67, -103.35, '', '523331112233', 'house',
        1, 1, 1, '[]',
        1, 200,
        ?, 1, 'admin-test'
      )
    `).run(propertyId, "orphan-pub-preview", now);
    db.prepare(`
      INSERT INTO rooms (
        id, property_id, status, title, rent_mxn, rooms_available, tags_json,
        roommate_gender_pref, age_min, age_max, summary, lodging_type,
        available_from, minimal_stay_months, room_dimension,
        aval_required, sublet_allowed, sort_order, deposit_mxn,
        image_urls_json, created_at, updated_at
      ) VALUES (
        ?, ?, 'draft', '', 0, 1, '[]',
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
    `).run(token, propertyId, "admin-test", "orphan-pub-preview", Date.now() + 86_400_000, Date.now());
  });

  afterAll(() => {
    db.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  it("GET /api/listings/:id serves a draft when claim token matches and does not leak the phone", async () => {
    await request(app).get(`/api/listings/${encodeURIComponent(roomId)}`).expect(404);

    const ok = await request(app)
      .get(`/api/listings/${encodeURIComponent(roomId)}?claim=${token}`)
      .expect(200);
    expect(ok.body.claimPreview).toBe(true);
    expect(ok.body.hasDraftPhone).toBe(true);
    expect(ok.body.contactWhatsApp).toBe("");
    expect(ok.body.status).toBe("draft");
  });
});

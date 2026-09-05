import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./appFactory.js";
import { openDb } from "./db.js";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("admin publish unclaimed outreach", () => {
  let dir: string;
  let dbPath: string;
  let db: DatabaseSync;
  let app: ReturnType<typeof createApp>;
  const token = "claimunclaimedtoken1234567890ab";
  const propertyId = "prp__adraft_unclaimedpub01";
  const roomId = "adraft_room__unclaimedpub01";
  const bossEmail = `boss-unclaimed-${Date.now()}@test.mx`;
  const prevAdmin = process.env.ADMIN_EMAILS;

  beforeAll(async () => {
    process.env.ADMIN_EMAILS = bossEmail;
    dir = mkdtempSync(join(tmpdir(), "bestie-unclaimed-pub-"));
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
        ?, ?, 'draft', 'room', 'Cuarto sin dueño', 'Guadalajara', 'Centro',
        20.67, -103.35, 'Resumen de prueba con más de veinte caracteres.', '523331112233', 'house',
        1, 1, 1, '[]',
        1, 200,
        ?, 1, 'admin-test'
      )
    `).run(propertyId, "orphan-pub-unclaimed", now);
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
    `).run(token, propertyId, "admin-test", "orphan-pub-unclaimed", Date.now() + 86_400_000, Date.now());
  });

  afterAll(() => {
    db.close();
    process.env.ADMIN_EMAILS = prevAdmin;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  it("refuses a status patch and publishes only with a dedicated screenshot", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ email: bossEmail, password: "longenough1" }).expect(201);
    await agent.post("/api/auth/login").send({ email: bossEmail, password: "longenough1" }).expect(200);

    const patch = await agent
      .patch(`/api/admin/properties/${encodeURIComponent(propertyId)}/status`)
      .send({ status: "published" });
    expect(patch.status).toBe(409);
    expect(patch.body.error).toBe("evidence_required");

    const viaClaim = await agent.post(`/api/assisted-draft/claim/${token}/publish`).send({});
    expect(viaClaim.status).toBe(409);
    expect(viaClaim.body.error).toBe("evidence_required");
    expect(String(viaClaim.body.message)).toMatch(/captura de consentimiento/i);
    const stillDraft = db.prepare(`SELECT status FROM properties WHERE id = ?`).get(propertyId) as {
      status: string;
    };
    expect(stillDraft.status).toBe("draft");

    const pub = await agent
      .post(`/api/admin/properties/${encodeURIComponent(propertyId)}/publish-unclaimed`)
      .field("note", "OK del grupo de FB")
      .attach("file", PNG_1X1, { filename: "consent.png", contentType: "image/png" });
    expect(pub.status).toBe(200);
    expect(pub.body.status).toBe("published");

    const row = db
      .prepare(
        `SELECT status, admin_publish_evidence_url, admin_publish_evidence_note FROM properties WHERE id = ?`,
      )
      .get(propertyId) as {
        status: string;
        admin_publish_evidence_url: string | null;
        admin_publish_evidence_note: string | null;
      };
    expect(row.status).toBe("published");
    expect(row.admin_publish_evidence_url).toMatch(/^evidence\//);
    expect(row.admin_publish_evidence_note).toBe("OK del grupo de FB");

    const listed = await request(app).get(`/api/listings/${encodeURIComponent(roomId)}`).expect(200);
    expect(listed.body.contactDisabled).toBe(true);
    expect(listed.body.imageUrls ?? []).not.toContain(row.admin_publish_evidence_url);
    expect(JSON.stringify(listed.body)).not.toContain("admin_publish_evidence");
    expect(JSON.stringify(listed.body)).not.toContain("evidence/");

    const ev = await agent.get(`/api/admin/properties/${encodeURIComponent(propertyId)}/evidence`).expect(200);
    expect(ev.headers["content-type"]).toMatch(/image\//);
    expect(ev.headers["cache-control"]).toMatch(/private/);

    const publicUpload = await request(app).get(`/api/uploads/${encodeURIComponent(row.admin_publish_evidence_url ?? "")}`);
    expect(publicUpload.status).not.toBe(200);
  });

  it("refuses unclaimed publish when rent is 0 and hidePricing is off", async () => {
    const zeroId = "prp__adraft_unclaimedpub_zero";
    const zeroRoom = "adraft_room__unclaimedpub_zero";
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO properties (
        id, publisher_id, status, post_mode, title, city, neighborhood,
        lat, lng, summary, contact_whatsapp, property_kind,
        bedrooms_total, bathrooms, show_whatsapp, hide_pricing, image_urls_json,
        is_approximate_location, approximate_radius_m,
        created_at, assisted_draft, created_by_admin_id
      ) VALUES (
        ?, ?, 'draft', 'room', 'Cuarto sin precio', 'Guadalajara', 'Centro',
        20.67, -103.35, 'Resumen de prueba con más de veinte caracteres.', '523331112233', 'house',
        1, 1, 1, 0, '[]',
        1, 200,
        ?, 1, 'admin-test'
      )
    `).run(zeroId, "orphan-pub-zero", now);
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
    `).run(zeroRoom, zeroId, now.slice(0, 10), now, now);
    db.prepare(`
      INSERT INTO assisted_draft_claim_tokens (
        token, property_id, created_by_admin_id, orphan_publisher_id,
        expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run("claimunclaimedtokenzero0000000001", zeroId, "admin-test", "orphan-pub-zero", Date.now() + 86_400_000, Date.now());

    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ email: bossEmail, password: "longenough1" });
    await agent.post("/api/auth/login").send({ email: bossEmail, password: "longenough1" }).expect(200);

    const pub = await agent
      .post(`/api/admin/properties/${encodeURIComponent(zeroId)}/publish-unclaimed`)
      .field("note", "OK del grupo de FB")
      .attach("file", PNG_1X1, { filename: "consent.png", contentType: "image/png" });
    expect(pub.status).toBe(400);
    expect(pub.body.error).toBe("rent_required");
    const stillDraft = db.prepare(`SELECT status FROM properties WHERE id = ?`).get(zeroId) as { status: string };
    expect(stillDraft.status).toBe("draft");
  });

  it("publishes unclaimed $0 rent when hidePricing is on", async () => {
    const hideId = "prp__adraft_unclaimedpub_hide";
    const hideRoom = "adraft_room__unclaimedpub_hide";
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO properties (
        id, publisher_id, status, post_mode, title, city, neighborhood,
        lat, lng, summary, contact_whatsapp, property_kind,
        bedrooms_total, bathrooms, show_whatsapp, hide_pricing, image_urls_json,
        is_approximate_location, approximate_radius_m,
        created_at, assisted_draft, created_by_admin_id
      ) VALUES (
        ?, ?, 'draft', 'room', 'Cuarto consultar', 'Guadalajara', 'Centro',
        20.67, -103.35, 'Resumen de prueba con más de veinte caracteres.', '523331112233', 'house',
        1, 1, 1, 1, '[]',
        1, 200,
        ?, 1, 'admin-test'
      )
    `).run(hideId, "orphan-pub-hide", now);
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
    `).run(hideRoom, hideId, now.slice(0, 10), now, now);
    db.prepare(`
      INSERT INTO assisted_draft_claim_tokens (
        token, property_id, created_by_admin_id, orphan_publisher_id,
        expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run("claimunclaimedtokenhide0000000001", hideId, "admin-test", "orphan-pub-hide", Date.now() + 86_400_000, Date.now());

    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ email: bossEmail, password: "longenough1" });
    await agent.post("/api/auth/login").send({ email: bossEmail, password: "longenough1" }).expect(200);

    const pub = await agent
      .post(`/api/admin/properties/${encodeURIComponent(hideId)}/publish-unclaimed`)
      .field("note", "OK del grupo de FB")
      .attach("file", PNG_1X1, { filename: "consent.png", contentType: "image/png" });
    expect(pub.status).toBe(200);
    expect(pub.body.status).toBe("published");
  });
});

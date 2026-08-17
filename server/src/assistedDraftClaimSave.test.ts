import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./appFactory.js";
import { openDb } from "./db.js";

describe("assisted draft claim save", () => {
  let dir: string;
  let dbPath: string;
  let db: DatabaseSync;
  let app: ReturnType<typeof createApp>;
  const token = "claimtokenpersist1234567890abcdef";
  const propertyId = "prp__adraft_testpersist01";
  const roomId = "adraft_room__testpersist01";

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-adraft-"));
    dbPath = join(dir, "test.db");
    db = openDb(dbPath);
    app = createApp(db, { databaseLabel: "test.db", databasePath: dbPath });
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO properties (
        id, publisher_id, status, post_mode, title, city, neighborhood,
        lat, lng, summary, contact_whatsapp, property_kind,
        bedrooms_total, bathrooms, show_whatsapp, image_urls_json,
        is_approximate_location, approximate_radius_m,
        created_at, assisted_draft, created_by_admin_id
      ) VALUES (
        ?, ?, 'draft', 'room', 'Habitación de prueba', 'Guadalajara', 'Americana',
        20.67, -103.35, '', '', 'house',
        1, 1, 0, '[]',
        1, 200,
        ?, 1, 'admin-test'
      )
    `).run(propertyId, "orphan-pub-test", now);
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
    `).run(token, propertyId, "admin-test", "orphan-pub-test", Date.now() + 86_400_000, Date.now());
  });

  afterAll(() => {
    db.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  it("PUT /claim/:token persists rent so GET returns it after refresh", async () => {
    await request(app)
      .put(`/api/assisted-draft/claim/${token}`)
      .send({
        property: { title: "Renta de habitación amueblada en Colonia Americana", neighborhood: "Colonia Americana" },
        rooms: [{ id: roomId, rentMxn: 5500, depositMxn: 5500 }],
      })
      .expect(200);

    const got = await request(app).get(`/api/assisted-draft/claim/${token}`).expect(200);
    expect(got.body.rooms[0].rentMxn).toBe(5500);
    expect(got.body.rooms[0].depositMxn).toBe(5500);
    expect(got.body.property.title).toContain("Colonia Americana");
  });

  it("PUT persists rents for a multi-room property even when client room ids drifted", async () => {
    const propertyId = "prp__adraft_testpersist02";
    const token = "claimtokenpersist2234567890abcdef";
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO properties (
        id, publisher_id, status, post_mode, title, city, neighborhood,
        lat, lng, summary, contact_whatsapp, property_kind,
        bedrooms_total, bathrooms, show_whatsapp, image_urls_json,
        is_approximate_location, approximate_radius_m,
        created_at, assisted_draft, created_by_admin_id
      ) VALUES (
        ?, ?, 'draft', 'property', 'Departamento de prueba', 'Guadalajara', 'Versalles',
        20.67, -103.35, '', '', 'house',
        3, 2, 0, '[]',
        0, null,
        ?, 1, 'admin-test'
      )
    `).run(propertyId, "orphan-pub-test-2", now);
    const roomIds = ["adraft_room__a", "adraft_room__b", "adraft_room__c"];
    for (const [index, roomId] of roomIds.entries()) {
      db.prepare(`
        INSERT INTO rooms (
          id, property_id, status, title, rent_mxn, rooms_available, tags_json,
          roommate_gender_pref, age_min, age_max, summary, lodging_type,
          available_from, minimal_stay_months, room_dimension,
          aval_required, sublet_allowed, sort_order, deposit_mxn,
          occupancy_status, image_urls_json, created_at, updated_at
        ) VALUES (
          ?, ?, 'draft', ?, ?, 1, '[]',
          'any', 18, 99, '', 'private_room',
          ?, 1, 'medium',
          0, 0, ?, 0,
          ?, '[]', ?, ?
        )
      `).run(
        roomId,
        propertyId,
        `Habitación ${index + 1}`,
        index === 0 ? 8200 : 0,
        now.slice(0, 10),
        index,
        index === 2 ? "occupied" : "available",
        now,
        now,
      );
    }
    db.prepare(`
      INSERT INTO assisted_draft_claim_tokens (
        token, property_id, created_by_admin_id, orphan_publisher_id,
        expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(token, propertyId, "admin-test", "orphan-pub-test-2", Date.now() + 86_400_000, Date.now());

    const saved = await request(app)
      .put(`/api/assisted-draft/claim/${token}`)
      .send({
        property: { title: "Departamento luminoso cerca de la Minerva" },
        rooms: [
          { id: "local-uuid-1", rentMxn: 5800, occupancyStatus: "available" },
          { id: "local-uuid-2", rentMxn: 5400, occupancyStatus: "available" },
          { id: "local-uuid-3", rentMxn: 0, occupancyStatus: "occupied", occupantWomenCount: 1 },
        ],
      })
      .expect(200);
    expect(saved.body.rooms.map((room: { id: string }) => room.id)).toEqual(roomIds);

    const got = await request(app).get(`/api/assisted-draft/claim/${token}`).expect(200);
    expect(got.body.rooms.map((room: { rentMxn: number; occupancyStatus: string }) => ({
      rentMxn: room.rentMxn,
      occupancyStatus: room.occupancyStatus,
    }))).toEqual([
      { rentMxn: 5800, occupancyStatus: "available" },
      { rentMxn: 5400, occupancyStatus: "available" },
      { rentMxn: 0, occupancyStatus: "occupied" },
    ]);
  });
});

import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { Application } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./appFactory.js";
import { openDb } from "./db.js";

describe("shared searches", () => {
  const testId = randomUUID().slice(0, 8);
  const adminEmail = `ops-share-${testId}@test.mx`;
  const seekerEmail = `seek-${testId}@test.mx`;
  const otherEmail = `other-${testId}@test.mx`;
  let dir: string;
  let db: DatabaseSync;
  let app: Application;
  const prevAdmin = process.env.ADMIN_EMAILS;
  const prevNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = "test";
    process.env.ADMIN_EMAILS = adminEmail;
    dir = mkdtempSync(join(tmpdir(), "bestie-shared-search-"));
    db = openDb(join(dir, "t.db"));
    app = createApp(db, { databaseLabel: "t.db", corsOrigins: ["http://localhost"] });
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO properties (
        id, publisher_id, status, post_mode, title, city, neighborhood,
        lat, lng, summary, contact_whatsapp, property_kind,
        bedrooms_total, bathrooms, show_whatsapp, image_urls_json,
        created_at, published_at
      ) VALUES (?, 'pub-share', 'published', 'room', 'Cuarto Americana', 'Guadalajara', 'Americana',
        20.6746, -103.3665, '', '523331112233', 'apartment',
        1, 1, 1, '[]', ?, ?)`,
    ).run("prp_share_am", now, now);
    db.prepare(
      `INSERT INTO rooms (
        id, property_id, status, title, rent_mxn, rooms_available, tags_json,
        roommate_gender_pref, age_min, age_max, summary, lodging_type,
        available_from, minimal_stay_months, room_dimension,
        aval_required, sublet_allowed, sort_order, deposit_mxn,
        image_urls_json, created_at, updated_at
      ) VALUES (
        'room_share_am', 'prp_share_am', 'published', 'Cuarto Americana', 7000, 1, '[]',
        'female', 18, 99, '', 'private_room',
        ?, 1, 'medium', 0, 0, 0, 0, '[]', ?, ?
      )`,
    ).run(now.slice(0, 10), now, now);
  });

  afterAll(() => {
    db.close();
    process.env.ADMIN_EMAILS = prevAdmin;
    process.env.NODE_ENV = prevNodeEnv;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  it("admin creates a vanity search and seekers subscribe without changing the slug", async () => {
    const admin = request.agent(app);
    await admin
      .post("/api/auth/register")
      .send({ email: adminEmail, password: "longenough1", displayName: "Ops" })
      .expect(201);

    const created = await admin
      .post("/api/shared-searches/admin")
      .send({
        city: "Guadalajara",
        seekerName: "María",
        seekerGender: "female",
        sourceFacebookUrl: "https://www.facebook.com/groups/x/posts/1234567890",
        extraction: {
          budgetMin: 5000,
          budgetMax: 9000,
          neighborhoods: ["Americana"],
          seekerGenderInferred: "female",
        },
      })
      .expect(201);

    expect(created.body.sharePath).toMatch(/^\/busquedas\/[a-z0-9]+$/);
    const slug = created.body.id as string;
    expect(created.body.caption).toContain("exactas");

    const guestMeta = await request(app).get(`/api/shared-searches/${slug}/meta`).expect(200);
    expect(guestMeta.body.id).toBe(slug);

    await request(app).post(`/api/shared-searches/${slug}/subscribe`).expect(401);

    const seeker = request.agent(app);
    await seeker
      .post("/api/auth/register")
      .send({ email: seekerEmail, password: "longenough1", displayName: "Maria" })
      .expect(201);

    const sub1 = await seeker.post(`/api/shared-searches/${slug}/subscribe`).expect(200);
    expect(sub1.body.subscribedNow).toBe(true);
    expect(sub1.body.sharePath).toBe(`/busquedas/${slug}`);
    expect(sub1.body.savedSearch.emailNotifyEnabled).toBe(true);

    const list1 = await seeker.get("/api/saved-searches").expect(200);
    expect(list1.body.some((r: { shareId?: string }) => r.shareId === slug)).toBe(true);

    const other = request.agent(app);
    await other
      .post("/api/auth/register")
      .send({ email: otherEmail, password: "longenough1", displayName: "Ana" })
      .expect(201);
    const sub2 = await other.post(`/api/shared-searches/${slug}/subscribe`).expect(200);
    expect(sub2.body.sharePath).toBe(`/busquedas/${slug}`);
    expect(sub2.body.redirectedSlug).toBeNull();

    const row = list1.body.find((r: { shareId?: string; id: string }) => r.shareId === slug) as {
      id: string;
    };
    const forked = await seeker
      .patch(`/api/saved-searches/${row.id}`)
      .send({
        filters: {
          q: "",
          budgetMin: 4000,
          budgetMax: 6000,
          tags: [],
          pref: "female",
          age: null,
          ageMin: null,
          ageMax: null,
          bbox: null,
          lodgingType: null,
          wantHouse: false,
          wantApartment: false,
          wantLoft: false,
          availableFrom: null,
          minimalStayMonths: null,
          roomDimensions: [],
          avalRequired: null,
          subletAllowed: null,
        },
        location: {
          cityCode: "gdl",
          cityLabel: "Guadalajara",
          neighborhoods: [{ name: "Americana", lat: 20.6746, lng: -103.3665 }],
          lat: 20.6746,
          lng: -103.3665,
          zoom: 14,
        },
        searchUrl: `/buscar/gdl?max=6000`,
      })
      .expect(200);
    expect(forked.body.searchUrl).toMatch(/^\/busquedas\//);
    expect(forked.body.searchUrl).not.toBe(`/busquedas/${slug}`);
  });
});

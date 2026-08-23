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
import { propertyReferenceCode, roomReferenceCode } from "./listingReference.js";

describe("POST /api/reports short-code resolution", () => {
  let dir: string;
  let db: DatabaseSync;
  let app: Application;

  const propertyId = `prp__${randomUUID()}`;
  const roomId = randomUUID();

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-reports-"));
    const dbPath = join(dir, "t.db");
    db = openDb(dbPath);
    app = createApp(db, { databaseLabel: "t.db", databasePath: dbPath });
    db.prepare(
      `INSERT INTO properties
         (id, publisher_id, status, post_mode, title, city, neighborhood, lat, lng, summary, contact_whatsapp)
       VALUES (?, 'pub-report', 'published', 'property', 'Casa report', 'Guadalajara', 'Centro', 20.67, -103.35, 'Resumen', '3300000000')`,
    ).run(propertyId);
    db.prepare(
      `INSERT INTO rooms
         (id, property_id, status, title, rent_mxn, rooms_available, tags_json, roommate_gender_pref, age_min, age_max, summary)
       VALUES (?, ?, 'published', 'Cuarto 1', 5000, 1, '[]', 'any', 18, 60, 'Resumen')`,
    ).run(roomId, propertyId);
  });

  afterAll(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("accepts property short code P… for anonymous reporters", async () => {
    const code = propertyReferenceCode(propertyId);
    const res = await request(app)
      .post(`/api/reports/properties/${encodeURIComponent(code)}`)
      .send({ categories: ["estafa"], detailText: "Prueba de reporte propiedad" })
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.reportCount).toBeGreaterThanOrEqual(1);
  });

  it("accepts room short code A… for anonymous reporters", async () => {
    const code = roomReferenceCode(roomId);
    const res = await request(app)
      .post(`/api/reports/listings/${encodeURIComponent(code)}`)
      .send({ categories: ["info_falsa"], detailText: "Prueba de reporte cuarto" })
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.reportCount).toBeGreaterThanOrEqual(1);
  });
});

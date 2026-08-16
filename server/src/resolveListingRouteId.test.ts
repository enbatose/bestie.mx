import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDb } from "./db.js";
import { propertyReferenceCode, roomReferenceCode } from "./listingReference.js";
import {
  resolveAdminPropertyIdFromParam,
  resolvePropertyIdFromRouteParam,
} from "./resolveListingRouteId.js";

describe("resolveAdminPropertyIdFromParam", () => {
  let dir: string;
  let db: DatabaseSync;

  const propertyId = `prp__${randomUUID()}`;
  const roomId = randomUUID();

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-admin-resolve-"));
    db = openDb(join(dir, "t.db"));
    db.prepare(
      `INSERT INTO properties
         (id, publisher_id, status, post_mode, title, city, neighborhood, lat, lng, summary, contact_whatsapp)
       VALUES (?, 'pub-admin', 'published', 'property', 'Casa test', 'Guadalajara', 'Centro', 20.67, -103.35, 'Resumen', '3300000000')`,
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

  it("resolves canonical property id", () => {
    expect(resolveAdminPropertyIdFromParam(db, propertyId)).toBe(propertyId);
  });

  it("resolves property short code P…", () => {
    expect(resolveAdminPropertyIdFromParam(db, propertyReferenceCode(propertyId))).toBe(propertyId);
  });

  it("resolves room short code A… to parent property", () => {
    expect(resolveAdminPropertyIdFromParam(db, roomReferenceCode(roomId))).toBe(propertyId);
  });

  it("resolves room uuid to parent property", () => {
    expect(resolveAdminPropertyIdFromParam(db, roomId)).toBe(propertyId);
  });

  it("returns null for unknown short codes", () => {
    expect(resolveAdminPropertyIdFromParam(db, "ADEADBEEF")).toBeNull();
    expect(resolveAdminPropertyIdFromParam(db, "PDEADBEEF")).toBeNull();
  });

  it("resolves legacy adraft_ property ids", () => {
    const legacyId = "adraft_cd7aaefa7ed0433292f3994278053029";
    db.prepare(
      `INSERT INTO properties
         (id, publisher_id, status, post_mode, title, city, neighborhood, lat, lng, summary, contact_whatsapp)
       VALUES (?, 'pub-legacy', 'draft', 'room', 'Legacy IA', 'Guadalajara', 'Centro', 20.67, -103.35, 'Resumen', '3300000000')`,
    ).run(legacyId);
    expect(resolvePropertyIdFromRouteParam(db, legacyId)).toBe(legacyId);
    expect(resolveAdminPropertyIdFromParam(db, legacyId)).toBe(legacyId);
    expect(resolvePropertyIdFromRouteParam(db, "adraft_missing99999999")).toBeNull();
  });
});

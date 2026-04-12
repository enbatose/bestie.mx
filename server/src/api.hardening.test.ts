import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import request from "supertest";
import type { Application } from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./appFactory.js";
import { openDb } from "./db.js";

function cookiePairFromSetCookie(res: { headers: Record<string, unknown> }): string {
  const sc = res.headers["set-cookie"] as string | string[] | undefined;
  if (!sc) return "";
  const list = Array.isArray(sc) ? sc : [sc];
  return list
    .map((line) => String(line).split(";")[0]!.trim())
    .filter(Boolean)
    .join("; ");
}

describe("Phase B API hardening", () => {
  let dir: string;
  let dbPath: string;
  let db: DatabaseSync;
  let app: Application;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-api-hardening-"));
    dbPath = join(dir, "test.db");
    db = openDb(dbPath);
    app = createApp(db, { databaseLabel: "test.db" });
  });

  afterAll(() => {
    db.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  it("GET /api/listings returns a JSON array", async () => {
    const res = await request(app).get("/api/listings").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("propertyId");
    expect(res.body[0]).toHaveProperty("id");
  });

  it("rejects malformed listing id", async () => {
    await request(app).get(`/api/listings/${encodeURIComponent("bad!id")}`).expect(400);
  });

  it("publish-bundle requires legalAccepted", async () => {
    await request(app)
      .post("/api/properties/publish-bundle")
      .send({
        legalAccepted: false,
        property: {
          title: "T",
          city: "Guadalajara",
          neighborhood: "Centro",
          lat: 20.67,
          lng: -103.35,
          contactWhatsApp: "523331234567",
        },
        rooms: [
          {
            title: "C1",
            rentMxn: 4000,
            roomsAvailable: 1,
            tags: [],
            roommateGenderPref: "any",
            ageMin: 18,
            ageMax: 99,
            summary: "S",
          },
        ],
      })
      .expect(400);
  });

  it("blocks publishing a room until the property is published", async () => {
    const r1 = await request(app)
      .post("/api/properties")
      .send({
        title: "Casa prueba API",
        city: "Guadalajara",
        neighborhood: "Centro",
        lat: 20.67,
        lng: -103.35,
        contactWhatsApp: "523331234567",
      })
      .expect(201);
    const cookie = cookiePairFromSetCookie(r1);
    const propertyId = (r1.body as { id: string }).id;

    const r2 = await request(app)
      .post(`/api/properties/${encodeURIComponent(propertyId)}/rooms`)
      .set("Cookie", cookie)
      .send({
        title: "Cuarto 1",
        rentMxn: 4500,
        roomsAvailable: 1,
        tags: [],
        roommateGenderPref: "any",
        ageMin: 20,
        ageMax: 35,
        summary: "Descripción mínima del cuarto para la prueba.",
      })
      .expect(201);
    const roomId = (r2.body as { id: string }).id;

    const r3 = await request(app)
      .patch(`/api/listings/${encodeURIComponent(roomId)}`)
      .set("Cookie", cookie)
      .send({ status: "published" })
      .expect(400);
    expect((r3.body as { error?: string }).error).toBe("property_not_published");

    await request(app)
      .patch(`/api/properties/${encodeURIComponent(propertyId)}`)
      .set("Cookie", cookie)
      .send({ status: "published" })
      .expect(200);

    await request(app)
      .patch(`/api/listings/${encodeURIComponent(roomId)}`)
      .set("Cookie", cookie)
      .send({ status: "published" })
      .expect(200);
  });

  it("GET /api/listings/:id returns draft room for owner cookie, 404 for anonymous", async () => {
    const r1 = await request(app)
      .post("/api/properties")
      .send({
        title: "Casa borrador GET",
        city: "Guadalajara",
        neighborhood: "Centro",
        lat: 20.67,
        lng: -103.35,
        contactWhatsApp: "523331234567",
      })
      .expect(201);
    const cookie = cookiePairFromSetCookie(r1);
    const propertyId = (r1.body as { id: string }).id;

    const r2 = await request(app)
      .post(`/api/properties/${encodeURIComponent(propertyId)}/rooms`)
      .set("Cookie", cookie)
      .send({
        title: "Cuarto borrador",
        rentMxn: 4000,
        roomsAvailable: 1,
        tags: [],
        roommateGenderPref: "any",
        ageMin: 18,
        ageMax: 40,
        summary: "Descripción del cuarto en borrador para prueba GET.",
      })
      .expect(201);
    const roomId = (r2.body as { id: string }).id;

    await request(app).get(`/api/listings/${encodeURIComponent(roomId)}`).expect(404);

    const g = await request(app)
      .get(`/api/listings/${encodeURIComponent(roomId)}`)
      .set("Cookie", cookie)
      .expect(200);
    expect((g.body as { status?: string }).status).toBe("draft");
  });

  it("publishing draft property cascades draft rooms to published", async () => {
    const r1 = await request(app)
      .post("/api/properties")
      .send({
        title: "Casa cascada",
        city: "Mérida",
        neighborhood: "Centro",
        lat: 20.97,
        lng: -89.59,
        contactWhatsApp: "529991112233",
      })
      .expect(201);
    const cookie = cookiePairFromSetCookie(r1);
    const propertyId = (r1.body as { id: string }).id;

    const rRoom1 = await request(app)
      .post(`/api/properties/${encodeURIComponent(propertyId)}/rooms`)
      .set("Cookie", cookie)
      .send({
        title: "C1",
        rentMxn: 3000,
        roomsAvailable: 1,
        tags: ["wifi"],
        roommateGenderPref: "any",
        ageMin: 18,
        ageMax: 99,
        summary: "Suficiente texto para el cuarto en prueba de cascada.",
      })
      .expect(201);
    const room1Id = (rRoom1.body as { id: string }).id;

    await request(app)
      .patch(`/api/properties/${encodeURIComponent(propertyId)}`)
      .set("Cookie", cookie)
      .send({ status: "published" })
      .expect(200);

    const catalog = await request(app).get("/api/listings").expect(200);
    const idsAfterPublish = (catalog.body as { id: string }[]).map((x) => x.id);
    expect(idsAfterPublish).toContain(room1Id);

    const rRoom2 = await request(app)
      .post(`/api/properties/${encodeURIComponent(propertyId)}/rooms`)
      .set("Cookie", cookie)
      .send({
        title: "C2",
        rentMxn: 3200,
        roomsAvailable: 1,
        tags: [],
        roommateGenderPref: "female",
        ageMin: 20,
        ageMax: 30,
        summary: "Segundo cuarto agregado después de publicar la propiedad.",
      })
      .expect(201);
    const room2Id = (rRoom2.body as { id: string }).id;
    expect(idsAfterPublish).not.toContain(room2Id);

    await request(app)
      .patch(`/api/listings/${encodeURIComponent(room2Id)}`)
      .set("Cookie", cookie)
      .send({ status: "published" })
      .expect(200);

    const catalog2 = await request(app).get("/api/listings").expect(200);
    const ids2 = (catalog2.body as { id: string }[]).map((x) => x.id);
    expect(ids2).toContain(room2Id);
  });

  it("rejects publishing a draft property that has no rooms", async () => {
    const r1 = await request(app)
      .post("/api/properties")
      .send({
        title: "Sin cuartos",
        city: "Mérida",
        neighborhood: "Centro",
        lat: 20.97,
        lng: -89.59,
        contactWhatsApp: "529991112233",
      })
      .expect(201);
    const cookie = cookiePairFromSetCookie(r1);
    const propertyId = (r1.body as { id: string }).id;

    await request(app)
      .patch(`/api/properties/${encodeURIComponent(propertyId)}`)
      .set("Cookie", cookie)
      .send({ status: "published" })
      .expect(400);
  });
});

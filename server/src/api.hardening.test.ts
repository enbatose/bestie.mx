import { mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import request from "supertest";
import type { Application } from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./appFactory.js";
import { openDb } from "./db.js";

const PROP_SUMMARY_OK =
  "Descripción de la propiedad lo bastante larga para pruebas API (≥20 caracteres).";

function cookiePairFromSetCookie(res: { headers: Record<string, unknown> }): string {
  const sc = res.headers["set-cookie"] as string | string[] | undefined;
  if (!sc) return "";
  const list = Array.isArray(sc) ? sc : [sc];
  return list
    .map((line) => String(line).split(";")[0]!.trim())
    .filter(Boolean)
    .join("; ");
}

function uniqueTestEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@test.mx`;
}

/** Call after an anonymous publisher cookie exists on `agent` (e.g. after POST /api/properties). */
async function registerAndLinkAnonymousPublisher(agent: ReturnType<typeof request.agent>): Promise<void> {
  await agent
    .post("/api/auth/register")
    .send({ email: uniqueTestEmail("harden"), password: "longenough1", displayName: "Hardening" })
    .expect(201);
  await agent.post("/api/auth/link-publisher").expect(200);
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
    app = createApp(db, { databaseLabel: "test.db", databasePath: dbPath });
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

  it("serves uploaded image bytes from durable storage if file cache is missing", async () => {
    const agent = request.agent(app);
    const up = await agent
      .post("/api/uploads")
      .attach("file", Buffer.from("fake-png-bytes"), { filename: "room.png", contentType: "image/png" })
      .expect(201);

    const url = String(up.body.url);
    expect(url).toMatch(/^\/api\/uploads\/[\w-]+\.png$/);

    const filename = url.split("/").pop()!;
    unlinkSync(join(dir, "uploads", filename));

    const img = await request(app).get(url).expect(200);
    expect(img.headers["content-type"]).toContain("image/png");
    expect(Buffer.from(img.body).toString()).toBe("fake-png-bytes");
  });

  it("publish-bundle rejects all-zero WhatsApp", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/register")
      .send({ email: uniqueTestEmail("bundle-wa"), password: "longenough1", displayName: "Bundle" })
      .expect(201);
    await agent.post("/api/auth/link-publisher").expect(200);
    const res = await agent
      .post("/api/properties/publish-bundle")
      .send({
        legalAccepted: true,
        property: {
          title: "T",
          city: "Guadalajara",
          neighborhood: "Centro",
          lat: 20.67,
          lng: -103.35,
          contactWhatsApp: "0000000000000",
          summary: PROP_SUMMARY_OK,
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
            summary: "Descripción del cuarto.",
            availableFrom: "2026-01-15",
            roomDimension: "medium",
            minimalStayMonths: 1,
            depositMxn: 0,
          },
        ],
      })
      .expect(400);
    expect((res.body as { error?: string }).error).toBe("invalid_whatsapp");
  });

  it("publish-bundle requires legalAccepted", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/register")
      .send({ email: uniqueTestEmail("bundle-legal"), password: "longenough1", displayName: "Bundle" })
      .expect(201);
    await agent.post("/api/auth/link-publisher").expect(200);
    await agent
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
    const agent = request.agent(app);
    const r1 = await agent
      .post("/api/properties")
      .send({
        title: "Casa prueba API",
        city: "Guadalajara",
        neighborhood: "Centro",
        lat: 20.67,
        lng: -103.35,
        contactWhatsApp: "523331234567",
        summary: PROP_SUMMARY_OK,
      })
      .expect(201);
    const propertyId = (r1.body as { id: string }).id;

    const r2 = await agent
      .post(`/api/properties/${encodeURIComponent(propertyId)}/rooms`)
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

    const r3 = await agent
      .patch(`/api/listings/${encodeURIComponent(roomId)}`)
      .send({ status: "published" })
      .expect(400);
    expect((r3.body as { error?: string }).error).toBe("property_not_published");

    await registerAndLinkAnonymousPublisher(agent);

    await agent
      .patch(`/api/properties/${encodeURIComponent(propertyId)}`)
      .send({ status: "published" })
      .expect(200);

    await agent.patch(`/api/listings/${encodeURIComponent(roomId)}`).send({ status: "published" }).expect(200);
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
        summary: PROP_SUMMARY_OK,
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

  it("GET /api/listings/:id returns another publisher's published room when viewer has bestie_pub", async () => {
    const agentA = request.agent(app);
    const r1 = await agentA
      .post("/api/properties")
      .send({
        title: "Casa visitante con cookie",
        city: "Querétaro",
        neighborhood: "Centro",
        lat: 20.59,
        lng: -100.39,
        contactWhatsApp: "524421112233",
        summary: PROP_SUMMARY_OK,
      })
      .expect(201);
    const propertyId = (r1.body as { id: string }).id;

    const r2 = await agentA
      .post(`/api/properties/${encodeURIComponent(propertyId)}/rooms`)
      .send({
        title: "Cuarto público",
        rentMxn: 5000,
        roomsAvailable: 1,
        tags: [],
        roommateGenderPref: "any",
        ageMin: 18,
        ageMax: 40,
        summary: "Descripción del cuarto para prueba de visitante con cookie propia.",
      })
      .expect(201);
    const roomId = (r2.body as { id: string }).id;

    await registerAndLinkAnonymousPublisher(agentA);

    await agentA.patch(`/api/properties/${encodeURIComponent(propertyId)}`).send({ status: "published" }).expect(200);
    await agentA.patch(`/api/listings/${encodeURIComponent(roomId)}`).send({ status: "published" }).expect(200);

    const agentB = request.agent(app);
    await agentB
      .post("/api/properties")
      .send({
        title: "Otro publisher",
        city: "León",
        neighborhood: "Centro",
        lat: 21.12,
        lng: -101.68,
        contactWhatsApp: "524771112244",
        summary: PROP_SUMMARY_OK,
      })
      .expect(201);

    const visitor = await agentB.get(`/api/listings/${encodeURIComponent(roomId)}`).expect(200);
    expect((visitor.body as { status?: string }).status).toBe("published");
    expect((visitor.body as { id?: string }).id).toBe(roomId);
  });

  it("publishing draft property cascades draft rooms to published", async () => {
    const agent = request.agent(app);
    const r1 = await agent
      .post("/api/properties")
      .send({
        title: "Casa cascada",
        city: "Mérida",
        neighborhood: "Centro",
        lat: 20.97,
        lng: -89.59,
        contactWhatsApp: "529991112233",
        summary: PROP_SUMMARY_OK,
      })
      .expect(201);
    const propertyId = (r1.body as { id: string }).id;

    const rRoom1 = await agent
      .post(`/api/properties/${encodeURIComponent(propertyId)}/rooms`)
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

    await registerAndLinkAnonymousPublisher(agent);

    await agent.patch(`/api/properties/${encodeURIComponent(propertyId)}`).send({ status: "published" }).expect(200);

    const catalog = await request(app).get("/api/listings").expect(200);
    const idsAfterPublish = (catalog.body as { id: string }[]).map((x) => x.id);
    expect(idsAfterPublish).toContain(room1Id);

    const rRoom2 = await agent
      .post(`/api/properties/${encodeURIComponent(propertyId)}/rooms`)
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

    await agent.patch(`/api/listings/${encodeURIComponent(room2Id)}`).send({ status: "published" }).expect(200);

    const catalog2 = await request(app).get("/api/listings").expect(200);
    const ids2 = (catalog2.body as { id: string }[]).map((x) => x.id);
    expect(ids2).toContain(room2Id);
  });

  it("allows creating a draft property with a short summary (wizard autosave)", async () => {
    const r1 = await request(app)
      .post("/api/properties")
      .send({
        title: "",
        city: "Guadalajara",
        neighborhood: "Centro",
        lat: 20.67,
        lng: -103.35,
        contactWhatsApp: "0000000000000",
        summary: "corta",
      })
      .expect(201);
    expect((r1.body as { title?: string }).title).toBe("Sin título");
    expect(String((r1.body as { summary?: string }).summary)).toBe("corta");
  });

  it("PATCH draft room updates fields", async () => {
    const r1 = await request(app)
      .post("/api/properties")
      .send({
        title: "C PATCH room",
        city: "Guadalajara",
        neighborhood: "Centro",
        lat: 20.67,
        lng: -103.35,
        contactWhatsApp: "523331234567",
        summary: PROP_SUMMARY_OK,
      })
      .expect(201);
    const cookie = cookiePairFromSetCookie(r1);
    const propertyId = (r1.body as { id: string }).id;

    const r2 = await request(app)
      .post(`/api/properties/${encodeURIComponent(propertyId)}/rooms`)
      .set("Cookie", cookie)
      .send({
        title: "Cuarto",
        rentMxn: 4000,
        roomsAvailable: 1,
        tags: [],
        roommateGenderPref: "any",
        ageMin: 18,
        ageMax: 40,
        summary: "",
      })
      .expect(201);
    const roomId = (r2.body as { id: string }).id;

    const r3 = await request(app)
      .patch(`/api/properties/${encodeURIComponent(propertyId)}/rooms/${encodeURIComponent(roomId)}`)
      .set("Cookie", cookie)
      .send({ title: "Cuarto renovado", summary: "Texto actualizado del cuarto.", rentMxn: 4100 })
      .expect(200);
    expect((r3.body as { title?: string }).title).toBe("Cuarto renovado");
    expect((r3.body as { rentMxn?: number }).rentMxn).toBe(4100);
  });

  it("rejects publishing with placeholder WhatsApp", async () => {
    const agent = request.agent(app);
    const r1 = await agent
      .post("/api/properties")
      .send({
        title: "Casa placeholder",
        city: "Mérida",
        neighborhood: "Centro",
        lat: 20.97,
        lng: -89.59,
        contactWhatsApp: "0000000000000",
        summary: PROP_SUMMARY_OK,
      })
      .expect(201);
    const propertyId = (r1.body as { id: string }).id;

    await agent
      .post(`/api/properties/${encodeURIComponent(propertyId)}/rooms`)
      .send({
        title: "C1",
        rentMxn: 3000,
        roomsAvailable: 1,
        tags: [],
        roommateGenderPref: "any",
        ageMin: 18,
        ageMax: 99,
        summary: "Descripción del cuarto.",
      })
      .expect(201);

    await registerAndLinkAnonymousPublisher(agent);

    const bad = await agent
      .patch(`/api/properties/${encodeURIComponent(propertyId)}`)
      .send({ status: "published" })
      .expect(400);
    expect((bad.body as { error?: string }).error).toBe("invalid_whatsapp");
  });

  it("rejects publishing a draft property that has no rooms", async () => {
    const agent = request.agent(app);
    const r1 = await agent
      .post("/api/properties")
      .send({
        title: "Sin cuartos",
        city: "Mérida",
        neighborhood: "Centro",
        lat: 20.97,
        lng: -89.59,
        contactWhatsApp: "529991112233",
        summary: PROP_SUMMARY_OK,
      })
      .expect(201);
    const propertyId = (r1.body as { id: string }).id;

    await registerAndLinkAnonymousPublisher(agent);

    await agent
      .patch(`/api/properties/${encodeURIComponent(propertyId)}`)
      .send({ status: "published" })
      .expect(400);
  });
});

import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./appFactory.js";
import { openDb } from "./db.js";
import { propertyReferenceCode, roomReferenceCode } from "./listingReference.js";

const PROP_SUMMARY_OK =
  "Descripción de la propiedad lo bastante larga para publicar en pruebas de Open Graph (≥100 caracteres requeridos).";
const ROOM_SUMMARY_OK =
  "Descripción del cuarto lo bastante larga para publicar en pruebas de Open Graph y scrapers sociales (≥100).";
const TEST_LISTING_IMAGE_URL = "/api/uploads/test-listing-photo.png";

describe("SPA static from API process", () => {
  let dir: string;
  let dbPath: string;
  let db: DatabaseSync;
  let distDir: string;
  let prevPublicBase: string | undefined;

  beforeAll(() => {
    prevPublicBase = process.env.PUBLIC_BASE_URL;
    process.env.PUBLIC_BASE_URL = "https://dev.bestie.mx";
    dir = mkdtempSync(join(tmpdir(), "bestie-webstatic-"));
    dbPath = join(dir, "test.db");
    db = openDb(dbPath);
    distDir = join(dir, "dist");
    mkdirSync(distDir, { recursive: true });
    writeFileSync(
      join(distDir, "index.html"),
      `<!doctype html><html><head>
<meta property="og:site_name" content="Bestie" />
<meta property="og:title" content="Bestie — bestie.mx" />
<meta property="og:description" content="Generic site description." />
<meta property="og:url" content="https://www.bestie.mx" />
<meta property="og:type" content="website" />
<meta name="description" content="Generic site description." />
<title>Bestie — bestie.mx</title>
</head><body>spa</body></html>\n`,
    );
    writeFileSync(join(distDir, "robots.txt"), "User-agent: *\nDisallow:\n");
  });

  afterAll(() => {
    if (prevPublicBase === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = prevPublicBase;
    db.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  it("POST /api/auth/register still reaches the API (not blocked by static layer)", async () => {
    const app = createApp(db, { databaseLabel: "test.db", webDistDir: distDir });
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: `spa405-${randomUUID()}@example.com`, password: "longenough1", displayName: "T" });
    expect(res.status).toBe(201);
  });

  it("GET /entrar serves index.html for SPA routing", async () => {
    const app = createApp(db, { databaseLabel: "test.db", webDistDir: distDir });
    const res = await request(app).get("/entrar").expect(200);
    expect(res.text).toContain("spa");
  });

  it("GET /buscar/gdl on apex host redirects to www preserving path", async () => {
    const app = createApp(db, { databaseLabel: "test.db", webDistDir: distDir });
    const res = await request(app).get("/buscar/gdl").set("Host", "bestie.mx").expect(301);
    expect(res.headers.location).toBe("https://www.bestie.mx/buscar/gdl");
  });

  it("GET /robots.txt serves a real file from dist", async () => {
    const app = createApp(db, { databaseLabel: "test.db", webDistDir: distDir });
    const res = await request(app).get("/robots.txt").expect(200);
    expect(res.text).toContain("User-agent");
  });

  it("GET /anuncio/:ref injects listing Open Graph meta for social scrapers", async () => {
    const app = createApp(db, { databaseLabel: "test.db", webDistDir: distDir });
    const agent = request.agent(app);

    const r1 = await agent
      .post("/api/properties")
      .send({
        title: "Cuarto OG Providencia",
        city: "Guadalajara",
        neighborhood: "Providencia",
        lat: 20.67,
        lng: -103.35,
        contactWhatsApp: "523331234567",
        summary: PROP_SUMMARY_OK,
        postMode: "room",
      })
      .expect(201);
    const propertyId = (r1.body as { id: string }).id;

    const r2 = await agent
      .post(`/api/properties/${encodeURIComponent(propertyId)}/rooms`)
      .send({
        title: "Recámara 1",
        rentMxn: 7200,
        roomsAvailable: 1,
        tags: [],
        roommateGenderPref: "any",
        ageMin: 18,
        ageMax: 40,
        summary: ROOM_SUMMARY_OK,
        lodgingType: "private_room",
      })
      .expect(201);
    const roomId = (r2.body as { id: string }).id;

    await agent
      .post("/api/auth/register")
      .send({
        email: `og-room-${randomUUID()}@test.mx`,
        password: "longenough1",
        displayName: "OG Room",
      })
      .expect(201);
    await agent.post("/api/auth/link-publisher").expect(200);

    await agent
      .patch(`/api/properties/${encodeURIComponent(propertyId)}/rooms/${encodeURIComponent(roomId)}`)
      .send({ imageUrls: [TEST_LISTING_IMAGE_URL] })
      .expect(200);
    await agent
      .patch(`/api/properties/${encodeURIComponent(propertyId)}`)
      .send({ imageUrls: [TEST_LISTING_IMAGE_URL] })
      .expect(200);
    await agent.patch(`/api/properties/${encodeURIComponent(propertyId)}`).send({ status: "published" }).expect(200);

    const ref = roomReferenceCode(roomId);
    const res = await request(app)
      .get(`/anuncio/${encodeURIComponent(ref)}`)
      .set("Host", "dev.bestie.mx")
      .expect(200);
    expect(res.text).toContain("og:title");
    expect(res.text).toContain("Cuarto OG Providencia");
    expect(res.text).toContain("7,200");
    expect(res.text).toContain(`og:url" content="https://dev.bestie.mx/anuncio/${ref}"`);
    expect(res.text).toContain(`og:image" content="https://dev.bestie.mx/api/share-og/anuncio/${ref}.jpg"`);
    expect(res.text).toContain("twitter:card");
    expect(res.text).not.toContain("Bestie — bestie.mx");
    expect(res.text).not.toContain("https://www.bestie.mx/api/uploads/");
  });

  it("GET /propiedad/:ref injects property-level Open Graph meta", async () => {
    const app = createApp(db, { databaseLabel: "test.db", webDistDir: distDir });
    const agent = request.agent(app);

    const r1 = await agent
      .post("/api/properties")
      .send({
        title: "Casa Multi OG",
        city: "Guadalajara",
        neighborhood: "Lafayette",
        lat: 20.67,
        lng: -103.35,
        contactWhatsApp: "523331234567",
        summary: PROP_SUMMARY_OK,
        postMode: "property",
      })
      .expect(201);
    const propertyId = (r1.body as { id: string }).id;

    async function addRoom(title: string, rent: number): Promise<string> {
      const r = await agent
        .post(`/api/properties/${encodeURIComponent(propertyId)}/rooms`)
        .send({
          title,
          rentMxn: rent,
          roomsAvailable: 1,
          tags: [],
          roommateGenderPref: "any",
          ageMin: 18,
          ageMax: 40,
          summary: ROOM_SUMMARY_OK,
        })
        .expect(201);
      return (r.body as { id: string }).id;
    }

    const roomA = await addRoom("Recámara A", 6000);
    const roomB = await addRoom("Recámara B", 8000);

    await agent
      .post("/api/auth/register")
      .send({
        email: `og-prop-${randomUUID()}@test.mx`,
        password: "longenough1",
        displayName: "OG Prop",
      })
      .expect(201);
    await agent.post("/api/auth/link-publisher").expect(200);

    await agent
      .patch(`/api/properties/${encodeURIComponent(propertyId)}`)
      .send({ imageUrls: ["/api/uploads/property-cover.png"] })
      .expect(200);
    for (const id of [roomA, roomB]) {
      await agent
        .patch(`/api/properties/${encodeURIComponent(propertyId)}/rooms/${encodeURIComponent(id)}`)
        .send({ imageUrls: [TEST_LISTING_IMAGE_URL] })
        .expect(200);
    }
    // Publishing the property cascades draft rooms to published.
    await agent.patch(`/api/properties/${encodeURIComponent(propertyId)}`).send({ status: "published" }).expect(200);

    const pref = propertyReferenceCode(propertyId);
    const res = await request(app)
      .get(`/propiedad/${encodeURIComponent(pref)}`)
      .set("Host", "dev.bestie.mx")
      .expect(200);
    expect(res.text).toContain("Casa Multi OG");
    expect(res.text).toContain("2 cuartos disponibles");
    expect(res.text).toContain("6,000");
    expect(res.text).toContain("8,000");
    expect(res.text).toContain(`og:image" content="https://dev.bestie.mx/api/share-og/propiedad/${pref}.jpg"`);
    expect(res.text).toContain(`og:url" content="https://dev.bestie.mx/propiedad/${pref}"`);
  });
});

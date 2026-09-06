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

  it("GET /sitemap.xml returns dynamic xml with marketing URLs", async () => {
    const app = createApp(db, { databaseLabel: "test.db", webDistDir: distDir });
    const res = await request(app).get("/sitemap.xml").set("Host", "www.bestie.mx").expect(200);
    expect(res.headers["content-type"]).toMatch(/xml/);
    expect(res.text).toContain("https://www.bestie.mx/buscar/gdl");
    expect(res.text).toContain("https://www.bestie.mx/nosotros");
  });

  it("GET /buscar/gdl injects city SEO title for crawlers", async () => {
    const app = createApp(db, { databaseLabel: "test.db", webDistDir: distDir });
    const res = await request(app).get("/buscar/gdl").set("Host", "www.bestie.mx").expect(200);
    expect(res.text).toMatch(/Roomie GDL/i);
    expect(res.text).toContain("cuartos compartidos");
    expect(res.text).toContain('rel="canonical" href="https://www.bestie.mx/buscar/gdl"');
    expect(res.text).not.toContain("Bestie — bestie.mx");
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

  it("GET /anuncio/:ref?claim= injects branded OG for unpublished claim links", async () => {
    const app = createApp(db, { databaseLabel: "test.db", webDistDir: distDir });
    const token = "ogclaimtoken1234567890abcdef";
    const propertyId = "prp__aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1";
    const roomId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1";
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO properties (
        id, publisher_id, status, post_mode, title, city, neighborhood,
        lat, lng, summary, contact_whatsapp, property_kind,
        bedrooms_total, bathrooms, show_whatsapp, image_urls_json,
        is_approximate_location, approximate_radius_m,
        created_at, assisted_draft, created_by_admin_id
      ) VALUES (
        ?, ?, 'draft', 'room', 'Rento habitación OG claim', 'Guadalajara', 'Atlas',
        20.67, -103.35, ?, '523316979814', 'house',
        1, 1, 1, ?,
        1, 200,
        ?, 1, 'admin-og-claim'
      )
    `).run(
      propertyId,
      "orphan-pub-og-claim",
      PROP_SUMMARY_OK,
      JSON.stringify([TEST_LISTING_IMAGE_URL]),
      now,
    );
    db.prepare(`
      INSERT INTO rooms (
        id, property_id, status, title, rent_mxn, rooms_available, tags_json,
        roommate_gender_pref, age_min, age_max, summary, lodging_type,
        available_from, minimal_stay_months, room_dimension,
        aval_required, sublet_allowed, sort_order, deposit_mxn,
        image_urls_json, created_at, updated_at
      ) VALUES (
        ?, ?, 'draft', '', 5500, 1, '[]',
        'any', 18, 99, ?, 'private_room',
        ?, 1, 'medium',
        0, 0, 0, 0,
        ?, ?, ?
      )
    `).run(roomId, propertyId, ROOM_SUMMARY_OK, now.slice(0, 10), JSON.stringify([TEST_LISTING_IMAGE_URL]), now, now);
    db.prepare(`
      INSERT INTO assisted_draft_claim_tokens (
        token, property_id, created_by_admin_id, orphan_publisher_id,
        expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(token, propertyId, "admin-og-claim", "orphan-pub-og-claim", Date.now() + 86_400_000, Date.now());

    const ref = roomReferenceCode(roomId);
    const withoutClaim = await request(app)
      .get(`/anuncio/${encodeURIComponent(ref)}`)
      .set("Host", "dev.bestie.mx")
      .expect(200);
    expect(withoutClaim.text).toContain("Bestie — bestie.mx");
    expect(withoutClaim.text).not.toContain("Rento habitación OG claim");

    const res = await request(app)
      .get(`/anuncio/${encodeURIComponent(ref)}?claim=${token}`)
      .set("Host", "dev.bestie.mx")
      .expect(200);
    expect(res.text).toContain("Rento habitación OG claim");
    expect(res.text).toContain("5,500");
    expect(res.text).toContain(`og:image" content="https://dev.bestie.mx/api/share-og/anuncio/${ref}.jpg"`);
    expect(res.text).toContain(`og:url" content="https://dev.bestie.mx/anuncio/${ref}?claim=${token}"`);
    expect(res.text).toContain('name="robots" content="noindex, nofollow"');
    expect(res.text).not.toContain("application/ld+json");
    expect(res.text).not.toContain("3316979814");
    expect(res.text).not.toContain("Bestie — bestie.mx");

    const borrador = await request(app)
      .get(`/borrador/${encodeURIComponent(token)}`)
      .set("Host", "dev.bestie.mx")
      .expect(200);
    expect(borrador.text).toContain("Rento habitación OG claim");
    expect(borrador.text).toContain(`og:image" content="https://dev.bestie.mx/api/share-og/anuncio/${ref}.jpg"`);
  });

  it("GET /busquedas/gdlchapu injects the campaign POI Open Graph card", async () => {
    const app = createApp(db, { databaseLabel: "test.db", webDistDir: distDir });
    const res = await request(app)
      .get("/busquedas/gdlchapu")
      .set("Host", "dev.bestie.mx")
      .set("User-Agent", "facebookexternalhit/1.1")
      .expect(200);
    expect(res.text).toContain("Chapultepec/Americana");
    expect(res.text).toContain("https://dev.bestie.mx/brand/og-busquedas/gdlchapu.jpg?v=8");
    expect(res.text).toContain('og:url" content="https://dev.bestie.mx/busquedas/gdlchapu"');
    expect(res.text).not.toContain("https://www.bestie.mx/brand/og-default.jpg");
    expect(res.text).not.toContain("Bestie — bestie.mx");
  });
});

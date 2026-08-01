import { createHmac, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import request from "supertest";
import type { Application } from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "./appFactory.js";
import { openDb } from "./db.js";
import { PUBLISHER_COOKIE } from "./session.js";

const PROP_SUMMARY_OK =
  "Descripción de la propiedad lo bastante larga para pruebas API de publicación (≥100 caracteres requeridos).";
const ROOM_SUMMARY_OK =
  "Descripción del cuarto lo bastante larga para pruebas API de publicación (≥100 caracteres requeridos en el anuncio).";

function publisherCookieValue(setCookieHeader: string | string[] | undefined): string | null {
  const list = !setCookieHeader ? [] : Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const line of list) {
    const first = String(line).split(";")[0] ?? "";
    const idx = first.indexOf("=");
    if (idx === -1) continue;
    const name = first.slice(0, idx).trim();
    if (name === PUBLISHER_COOKIE) return decodeURIComponent(first.slice(idx + 1).trim());
  }
  return null;
}

describe("security hardening", () => {
  let dir: string;
  let dbPath: string;
  let db: DatabaseSync;
  let app: Application;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-security-"));
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

  it("GET /api/health does not leak diagnostics", async () => {
    const res = await request(app).get("/api/health").expect(200);
    expect(res.body).toEqual({ ok: true, service: "bestie-mx-api" });
    expect(res.body).not.toHaveProperty("databasePath");
    expect(res.body).not.toHaveProperty("smtp");
    expect(res.body).not.toHaveProperty("resendInbound");
  });

  it("issues a signed bestie_pub cookie and accepts it for ownership", async () => {
    const agent = request.agent(app);
    const created = await agent
      .post("/api/properties")
      .send({
        title: "Sec Test",
        city: "Guadalajara",
        neighborhood: "Centro",
        lat: 20.67,
        lng: -103.35,
        contactWhatsApp: "523312345678",
        showWhatsApp: true,
        summary: PROP_SUMMARY_OK,
      })
      .expect(201);

    const raw = publisherCookieValue(created.headers["set-cookie"]);
    expect(raw).toBeTruthy();
    expect(raw).toMatch(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]+$/i);

    const propertyId = String(created.body.id);
    const ownerGet = await agent.get(`/api/properties/${propertyId}`).expect(200);
    expect(ownerGet.body.property.publisherId).toBeTruthy();

    await request(app).get(`/api/properties/${propertyId}`).expect(404);
  });

  it("rejects forged signed publisher cookies", async () => {
    const agent = request.agent(app);
    const created = await agent
      .post("/api/properties")
      .send({
        title: "Forge Test",
        city: "Guadalajara",
        neighborhood: "Centro",
        lat: 20.67,
        lng: -103.35,
        contactWhatsApp: "523312345678",
        showWhatsApp: false,
        summary: PROP_SUMMARY_OK,
      })
      .expect(201);
    const propertyId = String(created.body.id);
    const victimPub = String(created.body.publisherId);
    expect(victimPub).toBeTruthy();

    const forged = `${victimPub}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    const res = await request(app)
      .patch(`/api/properties/${propertyId}`)
      .set("Cookie", `${PUBLISHER_COOKIE}=${encodeURIComponent(forged)}`)
      .send({ title: "Hijacked" });
    // Invalid signature → no publisher session (401), not ownership of the listing.
    expect([401, 403]).toContain(res.status);
  });

  it("still accepts legacy bare-UUID publisher cookies (dual-accept)", async () => {
    const pub = randomUUID();
    const propertyId = `prp__${randomUUID()}`;
    db.prepare(
      `INSERT INTO properties (
        id, publisher_id, status, post_mode, title, city, neighborhood, lat, lng, summary, contact_whatsapp,
        bedrooms_total, bathrooms, show_whatsapp, image_urls_json, created_at
      ) VALUES (?, ?, 'draft', 'property', 'Legacy', 'Guadalajara', 'Centro', 20.67, -103.35, ?, '523311111111',
        1, 1, 1, '[]', datetime('now'))`,
    ).run(propertyId, pub, PROP_SUMMARY_OK);

    const res = await request(app)
      .get(`/api/properties/${propertyId}`)
      .set("Cookie", `${PUBLISHER_COOKIE}=${pub}`)
      .expect(200);
    expect(res.body.property.id).toBe(propertyId);
    expect(res.body.property.publisherId).toBe(pub);
  });

  it("omits publisherId on public published property GET", async () => {
    const agent = request.agent(app);
    const created = await agent
      .post("/api/properties")
      .send({
        title: "Public Leak Test",
        city: "Guadalajara",
        neighborhood: "Centro",
        lat: 20.67,
        lng: -103.35,
        contactWhatsApp: "523312345678",
        summary: PROP_SUMMARY_OK,
      })
      .expect(201);
    const propertyId = String(created.body.id);
    await agent
      .post(`/api/properties/${propertyId}/rooms`)
      .send({
        title: "R1",
        rentMxn: 4000,
        roomsAvailable: 1,
        tags: [],
        roommateGenderPref: "any",
        ageMin: 18,
        ageMax: 99,
        summary: ROOM_SUMMARY_OK,
        availableFrom: "2026-01-15",
        roomDimension: "medium",
        minimalStayMonths: 1,
        depositMxn: 0,
        imageUrls: ["/api/uploads/test-listing-photo.png"],
      })
      .expect(201);

    db.prepare(`UPDATE properties SET status = 'published', published_at = datetime('now') WHERE id = ?`).run(
      propertyId,
    );
    db.prepare(`UPDATE rooms SET status = 'published' WHERE property_id = ?`).run(propertyId);

    const publicGet = await request(app).get(`/api/properties/${propertyId}`).expect(200);
    expect(publicGet.body.property.id).toBe(propertyId);
    expect(publicGet.body.property.publisherId).toBeUndefined();
  });

  it("rejects SVG uploads", async () => {
    const svg = Buffer.from(
      `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`,
    );
    const res = await request(app)
      .post("/api/uploads")
      .attach("file", svg, { filename: "x.svg", contentType: "image/svg+xml" })
      .expect(400);
    expect(res.body.error).toBe("invalid_mimetype");
  });
});

describe("messenger webhook signature", () => {
  let dir: string;
  let db: DatabaseSync;
  let app: Application;
  const prevMeta = process.env.META_APP_SECRET;
  const secret = "meta-webhook-test-secret-xxxxxx";

  beforeAll(() => {
    // Prefer META_APP_SECRET so parallel Facebook OAuth tests cannot race this value.
    process.env.META_APP_SECRET = secret;
    dir = mkdtempSync(join(tmpdir(), "bestie-messenger-sec-"));
    db = openDb(join(dir, "test.db"));
    app = createApp(db, { databaseLabel: "test.db", databasePath: join(dir, "test.db") });
  });

  afterAll(() => {
    if (prevMeta === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = prevMeta;
    db.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  it("rejects unsigned messenger posts when Meta secret is configured", async () => {
    await request(app)
      .post("/api/messenger/webhook")
      .set("Content-Type", "application/json")
      .send({ object: "page", entry: [] })
      .expect(403);
  });

  it("accepts messenger posts with a valid HMAC signature", async () => {
    const payload = '{"object":"page","entry":[]}';
    const sig = createHmac("sha256", secret).update(payload).digest("hex");
    await request(app)
      .post("/api/messenger/webhook")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", `sha256=${sig}`)
      .send(payload)
      .expect(200);
  });
});

describe("login rate limit (isolated module reload)", () => {
  it("returns 429 after repeated failed logins", async () => {
    process.env.RATE_LIMIT_LOGIN_MAX = "5";
    vi.resetModules();
    const { createApp: createAppFresh } = await import("./appFactory.js");
    const { openDb: openDbFresh } = await import("./db.js");
    const dir = mkdtempSync(join(tmpdir(), "bestie-login-rl-"));
    const dbPath = join(dir, "test.db");
    const db = openDbFresh(dbPath);
    const app = createAppFresh(db, { databaseLabel: "test.db", databasePath: dbPath });
    try {
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post("/api/auth/login")
          .send({ email: "nobody-rate-limit@test.mx", password: "wrong-password" });
      }
      const blocked = await request(app)
        .post("/api/auth/login")
        .send({ email: "nobody-rate-limit@test.mx", password: "wrong-password" });
      expect(blocked.status).toBe(429);
      expect(blocked.body.error).toBe("rate_limited");
    } finally {
      delete process.env.RATE_LIMIT_LOGIN_MAX;
      db.close();
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* Windows */
      }
    }
  });
});

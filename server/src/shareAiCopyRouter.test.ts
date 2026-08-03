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
import { AUTH_COOKIE, signAuthToken } from "./jwtSession.js";
import { PUBLISHER_COOKIE } from "./session.js";

describe("shareAiCopyRouter", () => {
  let dir: string;
  let dbPath: string;
  let db: DatabaseSync;
  let app: Application;
  let propertyId: string;
  let roomId: string;
  let userId: string;
  let publisherId: string;
  const prevSecret = process.env.AUTH_JWT_SECRET;
  const prevGemini = process.env.GEMINI_API_KEY;

  beforeAll(() => {
    process.env.AUTH_JWT_SECRET = "test-secret-share-ai-copy-xxxxxxxx";
    delete process.env.GEMINI_API_KEY;
    dir = mkdtempSync(join(tmpdir(), "bestie-share-ai-"));
    dbPath = join(dir, "t.db");
    db = openDb(dbPath);
    app = createApp(db, { corsOrigins: ["http://localhost"], databasePath: dbPath });

    userId = randomUUID();
    publisherId = randomUUID();
    propertyId = randomUUID();
    roomId = randomUUID();

    db.prepare(
      `INSERT INTO users (id, email, email_canonical, password_hash, display_name, email_verified_at, created_at)
       VALUES (?, 'share-ai@example.com', 'share-ai@example.com', 'x', 'Ana', datetime('now'), datetime('now'))`,
    ).run(userId);
    db.prepare(
      `INSERT INTO user_publishers (user_id, publisher_id, created_at) VALUES (?, ?, datetime('now'))`,
    ).run(userId, publisherId);
    db.prepare(
      `INSERT INTO properties (
         id, publisher_id, status, post_mode, title, city, neighborhood, lat, lng, summary, contact_whatsapp,
         bedrooms_total, bathrooms, show_whatsapp, image_urls_json, is_approximate_location
       ) VALUES (
         ?, ?, 'published', 'property', 'Casa test', 'Guadalajara', 'Americana', 20.67, -103.35,
         'Resumen ok suficiente para compartir', '3312345678',
         2, 1, 1, '["/api/uploads/x.jpg"]', 0
       )`,
    ).run(propertyId, publisherId);
    db.prepare(
      `INSERT INTO rooms (
         id, property_id, status, title, rent_mxn, rooms_available, tags_json, roommate_gender_pref,
         age_min, age_max, summary, lodging_type, sort_order, deposit_mxn, image_urls_json
       ) VALUES (
         ?, ?, 'published', 'Cuarto 1', 4500, 1, '["wifi","muebles"]', 'any',
         20, 40, 'Cuarto amplio y limpio para roomie', 'private_room', 0, 0, '["/api/uploads/x.jpg"]'
       )`,
    ).run(roomId, propertyId);
  });

  afterAll(() => {
    process.env.AUTH_JWT_SECRET = prevSecret;
    if (prevGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevGemini;
    try {
      db.close();
    } catch {
      /* */
    }
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  function authCookie(): string {
    const token = signAuthToken(userId, 3600);
    return `${AUTH_COOKIE}=${encodeURIComponent(token)}; ${PUBLISHER_COOKIE}=${encodeURIComponent(publisherId)}`;
  }

  it("generates template share copy for property when Gemini is unset", async () => {
    const res = await request(app)
      .post("/api/share-copy/generate")
      .set("Cookie", authCookie())
      .set("Host", "dev.bestie.mx")
      .send({ scope: "property", propertyId })
      .expect(200);
    expect(res.body.scope).toBe("property");
    expect(res.body.source).toBe("template");
    expect(res.body.text).toContain("Revisa mi propiedad");
    expect(res.body.text).toContain("/propiedad/");
    expect(res.body.permalink).toMatch(/^https:\/\/dev\.bestie\.mx\/propiedad\//);
    expect(res.body.text).toContain("https://dev.bestie.mx/propiedad/");
    expect(String(res.body.text).length).toBeLessThanOrEqual(700);
  });

  it("persists edits via PATCH and returns stored text on next generate", async () => {
    const first = await request(app)
      .post("/api/share-copy/generate")
      .set("Cookie", authCookie())
      .send({ scope: "room", roomId })
      .expect(200);

    const edited = `Revisa mi cuarto editado\n\nTexto editado por el publisher\n\n${first.body.permalink}`;
    await request(app)
      .patch("/api/share-copy")
      .set("Cookie", authCookie())
      .send({ scope: "room", roomId, text: edited })
      .expect(200);

    const again = await request(app)
      .post("/api/share-copy/generate")
      .set("Cookie", authCookie())
      .send({ scope: "room", roomId })
      .expect(200);
    expect(again.body.source).toBe("stored");
    expect(again.body.userEdited).toBe(true);
    expect(again.body.text).toContain("Texto editado por el publisher");
  });

  it("rejects unauthenticated generate", async () => {
    await request(app)
      .post("/api/share-copy/generate")
      .send({ scope: "property", propertyId })
      .expect(401);
  });
});

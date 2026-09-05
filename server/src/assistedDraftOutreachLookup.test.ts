import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./appFactory.js";
import { openDb } from "./db.js";

describe("admin outreach duplicate check", () => {
  let dir: string;
  let dbPath: string;
  let db: DatabaseSync;
  let app: ReturnType<typeof createApp>;
  const bossEmail = `boss-outreach-dup-${Date.now()}@test.mx`;
  const prevAdmin = process.env.ADMIN_EMAILS;

  beforeAll(() => {
    process.env.ADMIN_EMAILS = bossEmail;
    dir = mkdtempSync(join(tmpdir(), "bestie-outreach-dup-"));
    dbPath = join(dir, "t.db");
    db = openDb(dbPath);
    app = createApp(db, { databaseLabel: "t.db", databasePath: dbPath });
  });

  afterAll(() => {
    db.close();
    process.env.ADMIN_EMAILS = prevAdmin;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  it("warns on the same Facebook post, the same listing phone, and a tied account", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ email: bossEmail, password: "longenough1" }).expect(201);
    await agent.post("/api/auth/login").send({ email: bossEmail, password: "longenough1" }).expect(200);

    const guestEmail = `guest-dup-${Date.now()}@test.mx`;
    await request(app)
      .post("/api/auth/register")
      .send({ email: guestEmail, password: "longenough1", displayName: "María Guest" })
      .expect(201);
    const guest = db.prepare(`SELECT id FROM users WHERE email = ?`).get(guestEmail) as { id: string };
    db.prepare(`UPDATE users SET phone_e164 = ?, phone_verified_at = ? WHERE id = ?`).run(
      "+523312349999",
      new Date().toISOString(),
      guest.id,
    );

    const created = await agent.post("/api/assisted-draft/admin/create").send({
      city: "Guadalajara",
      sourceFacebookUrl:
        "https://www.facebook.com/groups/829477243867011/posts/1234567890123456/?rdid=track",
      extraction: {
        propertyTitle: "Cuarto en Americana",
        neighborhood: "Americana",
        contactPhone: "3312348888",
      },
    });
    expect(created.status).toBe(201);
    expect(created.body.propertyId).toBeTruthy();

    const stored = db
      .prepare(
        `SELECT source_facebook_url, source_facebook_key, contact_whatsapp, hide_pricing FROM properties WHERE id = ?`,
      )
      .get(created.body.propertyId) as {
      source_facebook_url: string | null;
      source_facebook_key: string | null;
      contact_whatsapp: string;
      hide_pricing: number;
    };
    expect(stored.source_facebook_key).toBe("post:1234567890123456");
    expect(stored.source_facebook_url).not.toContain("rdid");
    expect(stored.hide_pricing).toBe(1);

    const samePost = await agent.post("/api/assisted-draft/admin/duplicate-check").send({
      sourceFacebookUrl: "https://m.facebook.com/groups/829477243867011/permalink/1234567890123456/",
    });
    expect(samePost.status).toBe(200);
    expect(samePost.body.facebookMatches).toHaveLength(1);
    expect(samePost.body.facebookMatches[0].propertyId).toBe(created.body.propertyId);
    expect(samePost.body.facebookMatches[0].listingPath).toMatch(/^\/anuncio\/A/i);

    const samePhone = await agent.post("/api/assisted-draft/admin/duplicate-check").send({
      phone: "3312348888",
    });
    expect(samePhone.status).toBe(200);
    expect(samePhone.body.phoneListings).toHaveLength(1);
    expect(samePhone.body.phoneListings[0].propertyId).toBe(created.body.propertyId);
    expect(samePhone.body.phoneAccount).toBeNull();

    const tied = await agent.post("/api/assisted-draft/admin/duplicate-check").send({
      phone: "3312349999",
    });
    expect(tied.status).toBe(200);
    expect(tied.body.phoneAccount).toMatchObject({
      userId: guest.id,
      phoneVerified: true,
    });
    expect(tied.body.phoneListings).toHaveLength(0);
  });

  it("leaves hide-pricing off when AI extracted a monthly rent", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ email: bossEmail, password: "longenough1" });
    await agent.post("/api/auth/login").send({ email: bossEmail, password: "longenough1" }).expect(200);

    const created = await agent.post("/api/assisted-draft/admin/create").send({
      city: "Guadalajara",
      extraction: {
        propertyTitle: "Cuarto con renta",
        neighborhood: "Americana",
        rentMxn: 5500,
      },
    });
    expect(created.status).toBe(201);
    const stored = db
      .prepare(`SELECT hide_pricing FROM properties WHERE id = ?`)
      .get(created.body.propertyId) as { hide_pricing: number };
    expect(stored.hide_pricing).toBe(0);
  });

  it("attaches already-uploaded photo URLs without a base64 body", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ email: bossEmail, password: "longenough1" });
    await agent.post("/api/auth/login").send({ email: bossEmail, password: "longenough1" }).expect(200);

    const photoUrl = "/api/uploads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg";
    const created = await agent.post("/api/assisted-draft/admin/create").send({
      city: "Guadalajara",
      extraction: { propertyTitle: "Cuarto con fotos" },
      photoUrls: [photoUrl],
    });
    expect(created.status).toBe(201);
    const stored = db
      .prepare(`SELECT image_urls_json FROM properties WHERE id = ?`)
      .get(created.body.propertyId) as { image_urls_json: string };
    expect(JSON.parse(stored.image_urls_json)).toEqual([photoUrl]);
  });

  it("rejects duplicate-check without admin", async () => {
    const res = await request(app).post("/api/assisted-draft/admin/duplicate-check").send({
      phone: "3312348888",
    });
    expect(res.status).toBeGreaterThanOrEqual(401);
  });
});

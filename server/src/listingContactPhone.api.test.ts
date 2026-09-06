import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./appFactory.js";
import { openDb } from "./db.js";

describe("listing contact phone events", () => {
  let dir: string;
  let dbPath: string;
  let db: DatabaseSync;
  let app: ReturnType<typeof createApp>;
  const propertyId = "prp__phone-evt-prop-01";
  const roomId = "phone-evt-room-01";
  const publisherId = "pub-phone-evt-01";

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-phone-evt-"));
    dbPath = join(dir, "t.db");
    db = openDb(dbPath);
    app = createApp(db, { databaseLabel: "t.db", databasePath: dbPath });
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO properties (
        id, publisher_id, status, post_mode, title, city, neighborhood,
        lat, lng, summary, contact_whatsapp, show_whatsapp, image_urls_json, created_at, published_at
      ) VALUES (?, ?, 'published', 'room', 'Cuarto Americana', 'Guadalajara', 'Americana',
        20.67, -103.35, 'Resumen', '523312345678', 1, '[]', ?, ?)`,
    ).run(propertyId, publisherId, now, now);
    db.prepare(
      `INSERT INTO rooms (
        id, property_id, status, title, rent_mxn, rooms_available, tags_json,
        roommate_gender_pref, age_min, age_max, summary
      ) VALUES (?, ?, 'published', 'Recámara 1', 5500, 1, '[]', 'any', 18, 35, 'Resumen')`,
    ).run(roomId, propertyId);
  });

  afterAll(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("logs reveal/call/whatsapp, notifies claimed publishers once, and skips the owner", async () => {
    const owner = request.agent(app);
    await owner
      .post("/api/auth/register")
      .send({ email: "owner-phone-evt@test.mx", password: "longenough1", displayName: "Ana" })
      .expect(201);
    const ownerMe = await owner.get("/api/auth/me").expect(200);
    const ownerId = String(ownerMe.body.id);
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO user_publishers (user_id, publisher_id, created_at) VALUES (?, ?, ?)`).run(
      ownerId,
      publisherId,
      now,
    );

    const seeker = request.agent(app);
    await seeker
      .post("/api/auth/register")
      .send({ email: "seeker-phone-evt@test.mx", password: "longenough1", displayName: "Luis" })
      .expect(201);

    const admin = request.agent(app);
    await admin
      .post("/api/auth/register")
      .send({ email: "batani.enrique@gmail.com", password: "longenough1", displayName: "Enrique" })
      .expect(201);

    await owner.post("/api/listings/phone-reveal/ack").send({ role: "publisher" }).expect(200);
    await seeker.post("/api/listings/phone-reveal/ack").send({ role: "seeker" }).expect(200);

    const ownerReveal = await owner.get(`/api/listings/${encodeURIComponent(roomId)}/contact-phone`).expect(200);
    expect(ownerReveal.body.phoneDigits).toBe("523312345678");
    expect(ownerReveal.body.listingTitle).toBeTruthy();

    let n = db.prepare(`SELECT COUNT(*) AS c FROM listing_contact_events`).get() as { c: number };
    expect(n.c).toBe(0);

    const reveal = await seeker.get(`/api/listings/${encodeURIComponent(roomId)}/contact-phone`).expect(200);
    expect(reveal.body.phoneDigits).toBe("523312345678");
    expect(reveal.body.listingTitle).toContain("Americana");
    expect(reveal.body.publisherDisplayName).toBe("Ana");

    await seeker.get(`/api/listings/${encodeURIComponent(roomId)}/contact-phone`).expect(200);
    await seeker.post(`/api/listings/${encodeURIComponent(roomId)}/contact-event`).send({ type: "call" }).expect(200);
    await seeker.post(`/api/listings/${encodeURIComponent(roomId)}/contact-event`).send({ type: "call" }).expect(200);
    await seeker
      .post(`/api/listings/${encodeURIComponent(roomId)}/contact-event`)
      .send({ type: "whatsapp" })
      .expect(200);

    n = db.prepare(`SELECT COUNT(*) AS c FROM listing_contact_events`).get() as { c: number };
    expect(n.c).toBe(5);

    const notes = await owner.get("/api/notifications").expect(200);
    const texts: string[] = (notes.body.notifications as { text: string }[]).map((row) => row.text);
    expect(texts.filter((t) => t.includes("consultó tu número")).length).toBe(1);
    expect(texts.filter((t) => t.includes("interés en llamar")).length).toBe(1);
    expect(texts.filter((t) => t.includes("WhatsApp")).length).toBe(1);
    expect(texts.some((t) => t.includes("usuario nuevo"))).toBe(false);

    const adminNotes = await admin.get("/api/notifications").expect(200);
    const adminTexts: string[] = (adminNotes.body.notifications as { text: string }[]).map((row) => row.text);
    expect(adminTexts.filter((t) => t.startsWith("Interés:")).length).toBe(5);
    expect(adminTexts.filter((t) => t.includes("consultó el teléfono")).length).toBe(2);
    expect(adminTexts.filter((t) => t.includes("quiere llamar")).length).toBe(2);
    expect(adminTexts.filter((t) => t.includes("abrió WhatsApp")).length).toBe(1);
  });
});

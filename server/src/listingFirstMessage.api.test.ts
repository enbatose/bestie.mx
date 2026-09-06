import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./appFactory.js";
import { openDb } from "./db.js";

describe("listing first in-app message admin notify", () => {
  let dir: string;
  let dbPath: string;
  let db: DatabaseSync;
  let app: ReturnType<typeof createApp>;
  const propertyId = "prp__msg-evt-prop-01";
  const roomId = "msg-evt-room-01";
  const publisherId = "pub-msg-evt-01";

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-msg-evt-"));
    dbPath = join(dir, "t.db");
    db = openDb(dbPath);
    app = createApp(db, { databaseLabel: "t.db", databasePath: dbPath });
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO properties (
        id, publisher_id, status, post_mode, title, city, neighborhood,
        lat, lng, summary, contact_whatsapp, show_whatsapp, image_urls_json, created_at, published_at
      ) VALUES (?, ?, 'published', 'room', 'Cuarto Lafayette', 'Guadalajara', 'Lafayette',
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

  it("notifies admins on the seeker's first listing message only", async () => {
    const owner = request.agent(app);
    await owner
      .post("/api/auth/register")
      .send({ email: "owner-msg-evt@test.mx", password: "longenough1", displayName: "Ana" })
      .expect(201);
    const ownerMe = await owner.get("/api/auth/me").expect(200);
    db.prepare(`INSERT INTO user_publishers (user_id, publisher_id, created_at) VALUES (?, ?, ?)`).run(
      String(ownerMe.body.id),
      publisherId,
      new Date().toISOString(),
    );

    const seeker = request.agent(app);
    await seeker
      .post("/api/auth/register")
      .send({ email: "seeker-msg-evt@test.mx", password: "longenough1", displayName: "Luis" })
      .expect(201);

    const admin = request.agent(app);
    await admin
      .post("/api/auth/register")
      .send({ email: "saava.iren@gmail.com", password: "longenough1", displayName: "Iren" })
      .expect(201);

    const started = await seeker
      .post("/api/messages/conversations/from-listing")
      .send({ listingRoomId: roomId })
      .expect(201);
    const conversationId = String(started.body.conversationId);
    expect(conversationId).toBeTruthy();

    await seeker
      .post(`/api/messages/conversations/${encodeURIComponent(conversationId)}/messages`)
      .send({ body: "Hola, ¿sigue disponible?" })
      .expect(201);

    const firstNotes = await admin.get("/api/notifications").expect(200);
    const firstTexts: string[] = (firstNotes.body.notifications as { text: string }[]).map((row) => row.text);
    expect(firstTexts.filter((t) => t.includes("primer mensaje")).length).toBe(1);
    expect(firstTexts[0]).toContain("Luis");

    const ownerNotes = await owner.get("/api/notifications").expect(200);
    const ownerTexts: string[] = (ownerNotes.body.notifications as { text: string }[]).map((row) => row.text);
    expect(ownerTexts.some((t) => t.includes("Luis") && t.includes("te escribió en Bestie"))).toBe(true);

    await seeker
      .post(`/api/messages/conversations/${encodeURIComponent(conversationId)}/messages`)
      .send({ body: "¿Puedo visitar mañana?" })
      .expect(201);

    const secondNotes = await admin.get("/api/notifications").expect(200);
    const secondTexts: string[] = (secondNotes.body.notifications as { text: string }[]).map((row) => row.text);
    expect(secondTexts.filter((t) => t.includes("primer mensaje")).length).toBe(1);

    db.prepare(
      `INSERT INTO rooms (
        id, property_id, status, title, rent_mxn, rooms_available, tags_json,
        roommate_gender_pref, age_min, age_max, summary
      ) VALUES (?, ?, 'published', 'Recámara 2', 5500, 1, '[]', 'any', 18, 35, 'Resumen')`,
    ).run("msg-evt-room-02", propertyId);
    const started2 = await seeker
      .post("/api/messages/conversations/from-listing")
      .send({ listingRoomId: "msg-evt-room-02" })
      .expect(201);
    await seeker
      .post(`/api/messages/conversations/${encodeURIComponent(String(started2.body.conversationId))}/messages`)
      .send({ body: "Hola, me interesa la otra recámara." })
      .expect(201);

    const ownerNotes2 = await owner.get("/api/notifications").expect(200);
    const ownerTexts2: string[] = (ownerNotes2.body.notifications as { text: string }[]).map((row) => row.text);
    expect(ownerTexts2.filter((t) => t.includes("te escribió en Bestie")).length).toBe(1);

    const adminNotes3 = await admin.get("/api/notifications").expect(200);
    const adminTexts3: string[] = (adminNotes3.body.notifications as { text: string }[]).map((row) => row.text);
    expect(adminTexts3.filter((t) => t.includes("primer mensaje")).length).toBe(2);
  });
});

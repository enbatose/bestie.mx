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
import { SUPPORT_BOT_USER_ID } from "./messagingSchema.js";

type ConversationRow = { id: string; listingRoomId: string | null; contextTitle: string };

function insertProperty(db: DatabaseSync, id: string): void {
  db.prepare(
    `INSERT INTO properties
       (id, publisher_id, status, post_mode, title, city, neighborhood, lat, lng, summary, contact_whatsapp)
     VALUES (?, ?, 'published', 'property', ?, 'Guadalajara', 'Americana', 20.67, -103.35, 'Resumen', '3300000000')`,
  ).run(id, `pub-${id}`, `Propiedad ${id}`);
}

function insertRoom(db: DatabaseSync, roomId: string, propertyId: string, title: string): void {
  db.prepare(
    `INSERT INTO rooms
       (id, property_id, status, title, rent_mxn, rooms_available, tags_json, roommate_gender_pref, age_min, age_max, summary)
     VALUES (?, ?, 'published', ?, 6000, 1, '[]', 'any', 18, 60, 'Resumen')`,
  ).run(roomId, propertyId, title);
}

function insertConversation(
  db: DatabaseSync,
  input: {
    roomId: string | null;
    title: string;
    ownerId: string;
    otherId: string;
    body: string;
    kind?: "listing" | "support";
  },
): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO conversations (id, listing_room_id, context_title, kind, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, input.roomId, input.title, input.kind ?? "listing", now, now);
  for (const userId of [input.ownerId, input.otherId]) {
    db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`).run(id, userId);
  }
  db.prepare(
    `INSERT INTO messages (id, conversation_id, sender_user_id, body, created_at, read_at)
     VALUES (?, ?, ?, ?, ?, NULL)`,
  ).run(randomUUID(), id, input.otherId, input.body, now);
  return id;
}

async function registerUser(app: Application): Promise<{ agent: request.SuperAgentTest; id: string }> {
  const agent = request.agent(app);
  await agent
    .post("/api/auth/register")
    .send({ email: `msgfilter-${randomUUID().slice(0, 12)}@test.mx`, password: "longenough1" })
    .expect(201);
  const me = await agent.get("/api/auth/me").expect(200);
  return { agent, id: (me.body as { id: string }).id };
}

describe("GET /api/messages/conversations — listing and property filters", () => {
  let dir: string;
  let db: DatabaseSync;
  let app: Application;
  let owner: { agent: request.SuperAgentTest; id: string };

  const propertyA = `prp__${randomUUID()}`;
  const propertyB = `prp__${randomUUID()}`;
  const roomA1 = randomUUID();
  const roomA2 = randomUUID();
  const roomB1 = randomUUID();

  const prevNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    dir = mkdtempSync(join(tmpdir(), "bestie-msg-filters-"));
    const dbPath = join(dir, "t.db");
    db = openDb(dbPath);
    app = createApp(db, { databaseLabel: "t.db" });

    owner = await registerUser(app);
    const renter = await registerUser(app);

    insertProperty(db, propertyA);
    insertProperty(db, propertyB);
    insertRoom(db, roomA1, propertyA, "Recámara A1");
    insertRoom(db, roomA2, propertyA, "Recámara A2");
    insertRoom(db, roomB1, propertyB, "Recámara B1");

    insertConversation(db, {
      roomId: roomA1,
      title: "Hilo A1",
      ownerId: owner.id,
      otherId: renter.id,
      body: "Interesado en A1",
    });
    insertConversation(db, {
      roomId: roomA2,
      title: "Hilo A2",
      ownerId: owner.id,
      otherId: renter.id,
      body: "Interesado en A2",
    });
    insertConversation(db, {
      roomId: roomB1,
      title: "Hilo B1",
      ownerId: owner.id,
      otherId: renter.id,
      body: "Interesado en B1",
    });
    insertConversation(db, {
      roomId: null,
      title: "Ticket de soporte",
      ownerId: owner.id,
      otherId: SUPPORT_BOT_USER_ID,
      body: "Ayuda por favor",
      kind: "support",
    });
  });

  afterAll(() => {
    db.close();
    process.env.NODE_ENV = prevNodeEnv;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  async function conversations(query: string): Promise<ConversationRow[]> {
    const res = await owner.agent.get(`/api/messages/conversations${query}`).expect(200);
    return (res.body as { conversations: ConversationRow[] }).conversations;
  }

  it("returns every conversation when no filter is supplied", async () => {
    const rows = await conversations("");
    expect(rows.map((r) => r.contextTitle).sort()).toEqual([
      "Hilo A1",
      "Hilo A2",
      "Hilo B1",
      "Ticket de soporte",
    ]);
  });

  it("filters to a single room listing", async () => {
    const rows = await conversations(`?listing=${encodeURIComponent(roomA1)}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.listingRoomId).toBe(roomA1);
    expect(rows[0]!.contextTitle).toBe("Hilo A1");
  });

  it("filters to every room of one property and excludes support threads", async () => {
    const rows = await conversations(`?property=${encodeURIComponent(propertyA)}`);
    expect(rows.map((r) => r.listingRoomId).sort()).toEqual([roomA1, roomA2].sort());
  });

  it("combines the property filter with the text search", async () => {
    const rows = await conversations(
      `?property=${encodeURIComponent(propertyA)}&q=${encodeURIComponent("Interesado en A2")}`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.listingRoomId).toBe(roomA2);
  });

  it("returns nothing when the property has no conversations", async () => {
    const emptyProperty = `prp__${randomUUID()}`;
    insertProperty(db, emptyProperty);
    expect(await conversations(`?property=${encodeURIComponent(emptyProperty)}`)).toEqual([]);
  });

  it("never leaks another user's conversations through the filters", async () => {
    const stranger = await registerUser(app);
    const res = await stranger.agent
      .get(`/api/messages/conversations?property=${encodeURIComponent(propertyA)}`)
      .expect(200);
    expect((res.body as { conversations: ConversationRow[] }).conversations).toEqual([]);
  });

  it("rejects malformed filter ids", async () => {
    await owner.agent.get("/api/messages/conversations?property=not-a-property").expect(400);
    await owner.agent.get("/api/messages/conversations?listing=bad%20id").expect(400);
  });
});

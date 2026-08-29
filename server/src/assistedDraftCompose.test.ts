import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./appFactory.js";
import { openDb } from "./db.js";

describe("assisted draft self compose", () => {
  let dir: string;
  let dbPath: string;
  let db: DatabaseSync;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-adraft-self-"));
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

  it("creates available and occupied room stubs for a property compose", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/register")
      .send({ email: `compose-${Date.now()}@test.mx`, password: "longenough1", displayName: "Compose" })
      .expect(201);
    const res = await agent
      .post("/api/assisted-draft/self/compose")
      .send({
        city: "Guadalajara",
        text: "Casa en Americana con tres recámaras, dos se rentan.",
        postMode: "property",
        hints: { roomsForRent: 2, roomsOccupied: 1 },
      })
      .expect(201);
    expect(res.body.propertyId).toBeTruthy();
    const prop = db.prepare("SELECT post_mode, bedrooms_total FROM properties WHERE id = ?").get(
      res.body.propertyId,
    ) as { post_mode: string; bedrooms_total: number };
    expect(prop.post_mode).toBe("property");
    expect(prop.bedrooms_total).toBe(3);
    const rooms = db
      .prepare("SELECT occupancy_status FROM rooms WHERE property_id = ? ORDER BY sort_order")
      .all(res.body.propertyId) as { occupancy_status: string }[];
    expect(rooms.map((r) => r.occupancy_status)).toEqual(["available", "available", "occupied"]);
  });

  it("rejects compose without login", async () => {
    const res = await request(app)
      .post("/api/assisted-draft/self/compose")
      .send({ city: "Guadalajara", text: "Casa en Americana." })
      .expect(401);
    expect(res.body.error).toBe("unauthorized");
  });

  it("rejects compose without text or infographic", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/register")
      .send({ email: `compose-empty-${Date.now()}@test.mx`, password: "longenough1", displayName: "Compose" })
      .expect(201);
    const res = await agent
      .post("/api/assisted-draft/self/compose")
      .send({ city: "Guadalajara", photos: [] })
      .expect(400);
    expect(res.body.error).toBe("text_or_infographic_required");
  });
});

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

  it("rejects compose without text or infographic", async () => {
    const res = await request(app)
      .post("/api/assisted-draft/self/compose")
      .send({ city: "Guadalajara", photos: [] })
      .expect(400);
    expect(res.body.error).toBe("text_or_infographic_required");
  });
});

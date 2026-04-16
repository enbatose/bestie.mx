import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./appFactory.js";
import { openDb } from "./db.js";

describe("SPA static from API process", () => {
  let dir: string;
  let dbPath: string;
  let db: DatabaseSync;
  let distDir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-webstatic-"));
    dbPath = join(dir, "test.db");
    db = openDb(dbPath);
    distDir = join(dir, "dist");
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, "index.html"), "<!doctype html><html><body>spa</body></html>\n");
    writeFileSync(join(distDir, "robots.txt"), "User-agent: *\nDisallow:\n");
  });

  afterAll(() => {
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

  it("GET /robots.txt serves a real file from dist", async () => {
    const app = createApp(db, { databaseLabel: "test.db", webDistDir: distDir });
    const res = await request(app).get("/robots.txt").expect(200);
    expect(res.text).toContain("User-agent");
  });
});

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./appFactory.js";
import { openDb } from "./db.js";
import { buildVanityRedirectUrl, VANITY_REDIRECTS } from "./vanityRedirects.js";

describe("buildVanityRedirectUrl", () => {
  it("attaches utm params to the destination path", () => {
    const entry = VANITY_REDIRECTS.find((e) => e.slug === "roomies-gdl")!;
    const url = buildVanityRedirectUrl(entry, "https://www.bestie.mx");
    expect(url).toBe(
      "https://www.bestie.mx/guadalajara?utm_source=facebook&utm_medium=group&utm_campaign=roomies_gdl_doria&utm_content=pinned_post",
    );
  });
});

describe("vanity redirect routes", () => {
  let dir: string;
  let dbPath: string;
  let db: DatabaseSync;
  let distDir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-vanity-"));
    dbPath = join(dir, "test.db");
    db = openDb(dbPath);
    distDir = join(dir, "dist");
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, "index.html"), "<!doctype html><html><body>spa</body></html>\n");
  });

  afterAll(() => {
    db.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  it("GET /roomies-gdl redirects to the GDL landing with pinned_post utm content", async () => {
    const app = createApp(db, { databaseLabel: "test.db", webDistDir: distDir });
    const res = await request(app).get("/roomies-gdl").set("Host", "www.bestie.mx");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("/guadalajara?");
    expect(res.headers.location).toContain("utm_content=pinned_post");
  });

  it("GET /gdl-grupo redirects with cover_photo utm content", async () => {
    const app = createApp(db, { databaseLabel: "test.db", webDistDir: distDir });
    const res = await request(app).get("/gdl-grupo").set("Host", "www.bestie.mx");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("utm_content=cover_photo");
  });

  it("respects the request host so Dev links point at dev.bestie.mx", async () => {
    const app = createApp(db, { databaseLabel: "test.db", webDistDir: distDir });
    const res = await request(app).get("/roomies-gdl").set("Host", "dev.bestie.mx");
    expect(res.status).toBe(302);
    expect(res.headers.location.startsWith("https://dev.bestie.mx/guadalajara?")).toBe(true);
  });
});

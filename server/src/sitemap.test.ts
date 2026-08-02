import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDb } from "./db.js";
import { buildSitemapXml, collectSitemapUrls, renderSitemapXml } from "./sitemap.js";

describe("sitemap", () => {
  let dir: string;
  let db: DatabaseSync;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-sitemap-"));
    db = openDb(join(dir, "test.db"));
  });

  afterAll(() => {
    db.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  it("always includes core marketing URLs", () => {
    const urls = collectSitemapUrls(db, "https://www.bestie.mx");
    const locs = urls.map((u) => u.loc);
    expect(locs).toContain("https://www.bestie.mx/");
    expect(locs).toContain("https://www.bestie.mx/buscar/gdl");
    expect(locs).toContain("https://www.bestie.mx/nosotros");
    expect(locs).toContain("https://www.bestie.mx/llms.txt");
  });

  it("renders valid-looking xml", () => {
    const xml = renderSitemapXml([
      { loc: "https://www.bestie.mx/", priority: 1, changefreq: "daily" },
    ]);
    expect(xml).toContain("<urlset");
    expect(xml).toContain("https://www.bestie.mx/");
    expect(buildSitemapXml(db, "https://dev.bestie.mx")).toContain("https://dev.bestie.mx/buscar/gdl");
  });
});

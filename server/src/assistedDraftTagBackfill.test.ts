import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { backfillOmittedAssistedDraftTags } from "./assistedDraftTagBackfill.js";

function memoryDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE properties (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      assisted_draft INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE rooms (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

describe("backfillOmittedAssistedDraftTags", () => {
  it("adds pets and other omitted yes-tags from stored copy, and does not remove existing tags", () => {
    const db = memoryDb();
    db.prepare(
      `INSERT INTO properties (id, status, title, summary, assisted_draft) VALUES (?, ?, ?, ?, 1)`,
    ).run("p1", "published", "Casa en coto", "Hay dos perritos. Eres pet friendly.");
    db.prepare(
      `INSERT INTO rooms (id, property_id, status, title, summary, tags_json, created_at, updated_at)
       VALUES (?, ?, 'published', '', ?, ?, ?, ?)`,
    ).run(
      "r1",
      "p1",
      "Cuenta con clóset. Sin amueblar. Baños compartidos.",
      JSON.stringify(["wifi"]),
      "2026-08-01T00:00:00.000Z",
      "2026-08-01T00:00:00.000Z",
    );

    const fixes = backfillOmittedAssistedDraftTags(db, { sinceIso: "2026-07-27T00:00:00.000Z" });
    expect(fixes).toHaveLength(1);
    expect(fixes[0]?.added).toEqual(expect.arrayContaining(["mascotas", "closet"]));
    expect(fixes[0]?.added).not.toContain("muebles");
    expect(fixes[0]?.added).not.toContain("baño-privado");

    const saved = JSON.parse(
      (db.prepare(`SELECT tags_json FROM rooms WHERE id = 'r1'`).get() as { tags_json: string }).tags_json,
    ) as string[];
    expect(saved).toEqual(expect.arrayContaining(["wifi", "mascotas", "closet"]));
  });

  it("does not mark an empty room furnished because the house is", () => {
    const db = memoryDb();
    db.prepare(
      `INSERT INTO properties (id, status, title, summary, assisted_draft) VALUES (?, ?, ?, ?, 1)`,
    ).run("p1", "published", "Casa", "Casa completamente amueblada en coto privado.");
    db.prepare(
      `INSERT INTO rooms (id, property_id, status, title, summary, tags_json, created_at, updated_at)
       VALUES ('r1', 'p1', 'published', 'Habitación 3', '', '[]', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')`,
    ).run();

    const fixes = backfillOmittedAssistedDraftTags(db, { sinceIso: "2026-07-27T00:00:00.000Z" });
    expect(fixes.flatMap((f) => f.added)).not.toContain("muebles");
  });

  it("skips listings outside the window and non-AI posts", () => {
    const db = memoryDb();
    db.prepare(
      `INSERT INTO properties (id, status, title, summary, assisted_draft) VALUES (?, ?, ?, ?, 0)`,
    ).run("p-manual", "published", "Manual", "Hay un perrito.");
    db.prepare(
      `INSERT INTO rooms (id, property_id, status, title, summary, tags_json, created_at, updated_at)
       VALUES ('r-manual', 'p-manual', 'published', '', '', '[]', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')`,
    ).run();
    db.prepare(
      `INSERT INTO properties (id, status, title, summary, assisted_draft) VALUES (?, ?, ?, ?, 1)`,
    ).run("p-old", "published", "Viejo", "Hay un perrito.");
    db.prepare(
      `INSERT INTO rooms (id, property_id, status, title, summary, tags_json, created_at, updated_at)
       VALUES ('r-old', 'p-old', 'published', '', '', '[]', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    ).run();

    const fixes = backfillOmittedAssistedDraftTags(db, { sinceIso: "2026-07-27T00:00:00.000Z" });
    expect(fixes).toEqual([]);
  });
});

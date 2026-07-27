import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { buildImageUploadAnalytics, recordImagePipelineDaily } from "./imageUploadAnalytics.js";

describe("imageUploadAnalytics", () => {
  it("aggregates daily counters and lists recent failures", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE client_events (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        publisher_id TEXT NOT NULL,
        user_id TEXT,
        name TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE analytics_daily (
        day TEXT NOT NULL,
        metric TEXT NOT NULL,
        dimension TEXT NOT NULL,
        value INTEGER NOT NULL,
        PRIMARY KEY (day, metric, dimension)
      );
    `);

    recordImagePipelineDaily(db, { ok: true, step: "upload", source: "camera" });
    recordImagePipelineDaily(db, {
      ok: false,
      step: "convert",
      source: "gallery",
      errorCode: "file_permission",
    });

    const now = Date.now();
    db.prepare(
      `INSERT INTO client_events (id, created_at, publisher_id, user_id, name, payload_json)
       VALUES (?, ?, ?, ?, 'image_pipeline', ?)`,
    ).run(
      "e1",
      now,
      "pub1",
      null,
      JSON.stringify({
        step: "convert",
        ok: false,
        errorCode: "file_permission",
        source: "gallery",
        mobileLike: true,
        declaredMime: "image/jpeg",
        sniffedMime: "image/jpeg",
        error: "The requested file could not be read",
      }),
    );

    const body = buildImageUploadAnalytics(db, { hours: 24, failuresOnly: true });
    expect(body.today.fail).toBe(1);
    expect(body.today.ok).toBe(1);
    expect(body.summary.fail).toBeGreaterThanOrEqual(1);
    expect(body.events[0]?.errorCode).toBe("file_permission");
    expect(body.events[0]?.source).toBe("gallery");
  });
});

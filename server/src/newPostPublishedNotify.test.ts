import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { isFirstPropertyPublish, notifyOpsNewPostPublished } from "./newPostPublishedNotify.js";
import * as mailer from "./mailer.js";

const PUBLIC_URL_KEYS = ["PUBLIC_BASE_URL", "SITE_URL", "WEB_ORIGIN", "PUBLIC_WEB_ORIGIN"] as const;
const prevPublicUrl: Record<string, string | undefined> = {};

function snapshotPublicUrlEnv() {
  for (const k of PUBLIC_URL_KEYS) prevPublicUrl[k] = process.env[k];
  for (const k of PUBLIC_URL_KEYS) delete process.env[k];
}

function restorePublicUrlEnv() {
  for (const k of PUBLIC_URL_KEYS) {
    if (prevPublicUrl[k] === undefined) delete process.env[k];
    else process.env[k] = prevPublicUrl[k];
  }
}

function setupDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE properties (
      id TEXT PRIMARY KEY,
      publisher_id TEXT,
      status TEXT,
      post_mode TEXT,
      title TEXT,
      city TEXT,
      neighborhood TEXT,
      posthog_session_id TEXT
    );
    CREATE TABLE rooms (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      status TEXT,
      sort_order INTEGER
    );
    CREATE TABLE user_publishers (
      user_id TEXT,
      publisher_id TEXT
    );
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT,
      display_name TEXT
    );
  `);
  return db;
}

describe("new post published notify", () => {
  beforeEach(() => {
    snapshotPublicUrlEnv();
  });

  afterEach(() => {
    restorePublicUrlEnv();
    vi.restoreAllMocks();
  });

  it("treats only first publish as new", () => {
    expect(isFirstPropertyPublish("draft", null, "published")).toBe(true);
    expect(isFirstPropertyPublish("paused", "2026-08-01T00:00:00.000Z", "published")).toBe(false);
    expect(isFirstPropertyPublish("published", null, "published")).toBe(false);
    expect(isFirstPropertyPublish("draft", null, "paused")).toBe(false);
  });

  it("emails contacto with post and replay URLs", async () => {
    process.env.PUBLIC_WEB_ORIGIN = "https://www.bestie.mx";
    const send = vi.spyOn(mailer, "sendTransactionalEmail").mockResolvedValue(true);
    const db = setupDb();
    db.prepare(
      `INSERT INTO properties (id, publisher_id, status, post_mode, title, city, neighborhood, posthog_session_id)
       VALUES ('prp__aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'pub1', 'published', 'room', 'Cuarto test', 'Guadalajara', 'Americana', 'sess-xyz')`,
    ).run();
    db.prepare(
      `INSERT INTO rooms (id, property_id, status, sort_order)
       VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'prp__aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'published', 0)`,
    ).run();
    db.prepare(`INSERT INTO users (id, email, display_name) VALUES ('u1', 'ana@test.mx', 'Ana')`).run();
    db.prepare(`INSERT INTO user_publishers (user_id, publisher_id) VALUES ('u1', 'pub1')`).run();

    const ok = await notifyOpsNewPostPublished(db, "prp__aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(ok).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    const args = send.mock.calls[0]![0];
    expect(args.to).toBe("contacto@bestie.mx");
    expect(args.html).toContain("/anuncio/");
    expect(args.html).toContain("sess-xyz");
    expect(args.tags?.some((t) => t.value === "new_post_alert")).toBe(true);
  });

  it("does not email ops on Dev", async () => {
    process.env.PUBLIC_WEB_ORIGIN = "https://dev.bestie.mx";
    const send = vi.spyOn(mailer, "sendTransactionalEmail").mockResolvedValue(true);
    const db = setupDb();
    db.prepare(
      `INSERT INTO properties (id, publisher_id, status, post_mode, title, city, neighborhood, posthog_session_id)
       VALUES ('prp__aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'pub1', 'published', 'room', 'Cuarto test', 'Guadalajara', 'Americana', 'sess-xyz')`,
    ).run();

    const ok = await notifyOpsNewPostPublished(db, "prp__aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});

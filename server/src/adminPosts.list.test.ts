import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { adminPostEditPath, listAdminPosts } from "./adminPosts.js";
import { propertyReferenceCode } from "./listingReference.js";

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
      created_at TEXT,
      published_at TEXT,
      wizard_step INTEGER,
      posthog_session_id TEXT,
      feedback_rating INTEGER,
      feedback_comment TEXT,
      feedback_at TEXT,
      assisted_draft INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE rooms (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      status TEXT,
      sort_order INTEGER
    );
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT,
      display_name TEXT
    );
    CREATE TABLE user_publishers (
      user_id TEXT,
      publisher_id TEXT,
      created_at TEXT
    );
    CREATE TABLE assisted_draft_claim_tokens (
      token TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      created_by_admin_id TEXT NOT NULL,
      orphan_publisher_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      activated_at INTEGER,
      claimed_by_user_id TEXT,
      claimed_at INTEGER,
      created_at INTEGER NOT NULL
    );
  `);
  return db;
}

const PROP_AI = "prp__aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PROP_MANUAL = "prp__bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const PROP_PUBLISHED_AI = "prp__cccccccc-cccc-cccc-cccc-cccccccccccc";
const ROOM_AI = "11111111-1111-1111-1111-111111111111";

describe("adminPostEditPath", () => {
  it("opens the AI claim preview for unclaimed AI drafts", () => {
    expect(
      adminPostEditPath({
        propertyId: PROP_AI,
        postMode: "room",
        status: "draft",
        assistedDraft: true,
        claimToken: "claimtok123",
      }),
    ).toBe("/borrador/claimtok123");
  });

  it("falls back to the review step when an AI draft has no live claim token", () => {
    expect(
      adminPostEditPath({
        propertyId: PROP_AI,
        postMode: "room",
        status: "draft",
        assistedDraft: true,
        claimToken: null,
      }),
    ).toBe(`/publicar?edit=${propertyReferenceCode(PROP_AI)}&paso=6`);
  });

  it("keeps the regular editor for published or manual posts", () => {
    expect(
      adminPostEditPath({
        propertyId: PROP_PUBLISHED_AI,
        postMode: "room",
        status: "published",
        assistedDraft: true,
        claimToken: "stale",
      }),
    ).toBe(`/publicar?edit=${encodeURIComponent(PROP_PUBLISHED_AI)}`);
    expect(
      adminPostEditPath({
        propertyId: PROP_MANUAL,
        postMode: "room",
        status: "draft",
        assistedDraft: false,
        claimToken: null,
      }),
    ).toBe(`/publicar?edit=${encodeURIComponent(PROP_MANUAL)}`);
  });
});

describe("listAdminPosts AI origin", () => {
  it("flags AI posts and points draft Editor at the claim preview", () => {
    const db = setupDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO properties (id, publisher_id, status, post_mode, title, city, neighborhood, created_at, assisted_draft)
       VALUES (?, 'pub-ai', 'draft', 'room', 'Cuarto IA', 'Guadalajara', 'Centro', ?, 1)`,
    ).run(PROP_AI, now);
    db.prepare(
      `INSERT INTO rooms (id, property_id, status, sort_order) VALUES (?, ?, 'draft', 0)`,
    ).run(ROOM_AI, PROP_AI);
    db.prepare(
      `INSERT INTO assisted_draft_claim_tokens (
        token, property_id, created_by_admin_id, orphan_publisher_id, expires_at, created_at
      ) VALUES ('live-claim-token', ?, 'admin', 'orphan', ?, ?)`,
    ).run(PROP_AI, Date.now() + 86_400_000, Date.now());

    db.prepare(
      `INSERT INTO properties (id, publisher_id, status, post_mode, title, city, neighborhood, created_at, assisted_draft)
       VALUES (?, 'pub-manual', 'draft', 'room', 'Cuarto manual', 'Guadalajara', 'Americana', ?, 0)`,
    ).run(PROP_MANUAL, now);

    db.prepare(
      `INSERT INTO properties (id, publisher_id, status, post_mode, title, city, neighborhood, created_at, published_at, assisted_draft)
       VALUES (?, 'pub-ai-pub', 'published', 'room', 'Cuarto IA publicado', 'Guadalajara', 'Lafayette', ?, ?, 1)`,
    ).run(PROP_PUBLISHED_AI, now, now);

    const all = listAdminPosts(db, { status: "all", limit: 25, offset: 0 });
    const aiDraft = all.posts.find((p) => p.propertyId === PROP_AI);
    const manual = all.posts.find((p) => p.propertyId === PROP_MANUAL);
    const aiPublished = all.posts.find((p) => p.propertyId === PROP_PUBLISHED_AI);

    expect(aiDraft?.assistedDraft).toBe(true);
    expect(aiDraft?.editPath).toBe("/borrador/live-claim-token");
    expect(manual?.assistedDraft).toBe(false);
    expect(manual?.editPath).toBe(`/publicar?edit=${encodeURIComponent(PROP_MANUAL)}`);
    expect(aiPublished?.assistedDraft).toBe(true);
    expect(aiPublished?.editPath).toBe(`/publicar?edit=${encodeURIComponent(PROP_PUBLISHED_AI)}`);

    const iaOnly = listAdminPosts(db, { q: "ia", status: "all", limit: 25, offset: 0 });
    expect(iaOnly.posts.map((p) => p.propertyId).sort()).toEqual(
      [PROP_AI, PROP_PUBLISHED_AI].sort(),
    );

    const published = listAdminPosts(db, { status: "published", limit: 25, offset: 0 });
    expect(published.total).toBe(1);
    expect(published.posts).toHaveLength(1);
    expect(published.posts[0]?.propertyId).toBe(PROP_PUBLISHED_AI);
    expect(published.posts[0]?.assistedDraft).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
  adminPostEditPath,
  listAdminPosts,
  resolveAdminPostCreateOrigin,
} from "./adminPosts.js";
import { propertyReferenceCode, roomReferenceCode } from "./listingReference.js";
import { SELF_SERVE_CREATOR_ID } from "./assistedDraftMerge.js";

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
      assisted_draft INTEGER NOT NULL DEFAULT 0,
      created_by_admin_id TEXT,
      admin_publish_evidence_url TEXT
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
    CREATE TABLE conversations (
      id TEXT PRIMARY KEY,
      listing_room_id TEXT,
      context_title TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'listing',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE post_reports (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL UNIQUE,
      target_type TEXT NOT NULL,
      target_room_id TEXT,
      target_property_id TEXT,
      target_chat_conversation_id TEXT,
      publisher_user_id TEXT,
      report_count INTEGER NOT NULL DEFAULT 1,
      reviewed_at TEXT,
      reviewed_by_admin_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

const PROP_AI = "prp__aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PROP_MANUAL = "prp__bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const PROP_PUBLISHED_AI = "prp__cccccccc-cccc-cccc-cccc-cccccccccccc";
const ROOM_AI = "11111111-1111-1111-1111-111111111111";

function previewEditPath(propertyId: string, roomId?: string): string {
  return adminPostEditPath({
    propertyId,
    postMode: "room",
    status: "draft",
    assistedDraft: true,
    claimToken: null,
    roomId: roomId ?? null,
  });
}

describe("adminPostEditPath", () => {
  it("opens the preview editor for unclaimed AI drafts", () => {
    expect(
      adminPostEditPath({
        propertyId: PROP_AI,
        postMode: "room",
        status: "draft",
        assistedDraft: true,
        claimToken: "claimtok123",
        roomId: ROOM_AI,
      }),
    ).toBe(previewEditPath(PROP_AI, ROOM_AI));
  });

  it("still uses the preview editor when an AI draft has no live claim token", () => {
    expect(
      adminPostEditPath({
        propertyId: PROP_AI,
        postMode: "room",
        status: "draft",
        assistedDraft: true,
        claimToken: null,
      }),
    ).toBe(previewEditPath(PROP_AI));
  });

  it("keeps the preview editor for published or manual posts", () => {
    expect(
      adminPostEditPath({
        propertyId: PROP_PUBLISHED_AI,
        postMode: "room",
        status: "published",
        assistedDraft: true,
        claimToken: "stale",
      }),
    ).toBe(previewEditPath(PROP_PUBLISHED_AI));
    expect(
      adminPostEditPath({
        propertyId: PROP_MANUAL,
        postMode: "room",
        status: "draft",
        assistedDraft: false,
        claimToken: null,
      }),
    ).toBe(previewEditPath(PROP_MANUAL));
  });

  it("never puts a raw adraft_ id in ?edit=", () => {
    const legacyId = "adraft_cd7aaefa7ed0433292f3994278053029";
    expect(
      adminPostEditPath({
        propertyId: legacyId,
        postMode: "room",
        status: "draft",
        assistedDraft: true,
        claimToken: null,
      }),
    ).toBe(previewEditPath(legacyId));
  });
});

describe("listAdminPosts AI origin", () => {
  it("flags AI posts and points draft Editor at the preview editor", () => {
    const db = setupDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO properties (id, publisher_id, status, post_mode, title, city, neighborhood, created_at, assisted_draft, created_by_admin_id)
       VALUES (?, 'pub-ai', 'draft', 'room', 'Cuarto IA', 'Guadalajara', 'Centro', ?, 1, 'admin')`,
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
      `INSERT INTO properties (id, publisher_id, status, post_mode, title, city, neighborhood, created_at, published_at, assisted_draft, created_by_admin_id)
       VALUES (?, 'pub-ai-pub', 'published', 'room', 'Cuarto IA publicado', 'Guadalajara', 'Lafayette', ?, ?, 1, 'admin')`,
    ).run(PROP_PUBLISHED_AI, now, now);

    const all = listAdminPosts(db, { status: "all", limit: 25, offset: 0 });
    const aiDraft = all.posts.find((p) => p.propertyId === PROP_AI);
    const manual = all.posts.find((p) => p.propertyId === PROP_MANUAL);
    const aiPublished = all.posts.find((p) => p.propertyId === PROP_PUBLISHED_AI);

    expect(aiDraft?.assistedDraft).toBe(true);
    expect(aiDraft?.createOrigin).toBe("ai_admin");
    expect(aiDraft?.unclaimedOutreach).toBe(true);
    expect(aiDraft?.editPath).toBe(previewEditPath(PROP_AI, ROOM_AI));
    expect(aiDraft?.viewPath).toBe(`/anuncio/${roomReferenceCode(ROOM_AI)}?claim=live-claim-token`);
    expect(manual?.assistedDraft).toBe(false);
    expect(manual?.createOrigin).toBe("manual");
    expect(manual?.editPath).toBe(previewEditPath(PROP_MANUAL));
    expect(aiPublished?.assistedDraft).toBe(true);
    expect(aiPublished?.createOrigin).toBe("ai_admin");
    expect(aiPublished?.editPath).toBe(previewEditPath(PROP_PUBLISHED_AI));

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

  it("exposes Ver session replay URL for any publish path when session id is stored", () => {
    const db = setupDb();
    const now = new Date().toISOString();
    const sessionId = "019abcde-session-replay-test-0001";
    db.prepare(
      `INSERT INTO properties (
         id, publisher_id, status, post_mode, title, city, neighborhood,
         created_at, published_at, assisted_draft, posthog_session_id
       ) VALUES (?, 'pub-replay', 'published', 'room', 'Con replay', 'Guadalajara', 'Centro', ?, ?, 1, ?)`,
    ).run(PROP_PUBLISHED_AI, now, now, sessionId);
    db.prepare(
      `INSERT INTO rooms (id, property_id, status, sort_order) VALUES (?, ?, 'published', 0)`,
    ).run(ROOM_AI, PROP_PUBLISHED_AI);

    const listed = listAdminPosts(db, { status: "published", limit: 10, offset: 0 });
    const row = listed.posts.find((p) => p.propertyId === PROP_PUBLISHED_AI);
    expect(row?.posthogSessionId).toBe(sessionId);
    expect(row?.posthogReplayUrl).toBe(
      `https://us.posthog.com/project/517444/replay/${encodeURIComponent(sessionId)}`,
    );
  });

  it("treats legacy adraft_ ids as AI even when assisted_draft is 0", () => {
    const db = setupDb();
    const now = new Date().toISOString();
    const legacyId = "adraft_cd7aaefa7ed0433292f3994278053029";
    db.prepare(
      `INSERT INTO properties (id, publisher_id, status, post_mode, title, city, neighborhood, created_at, assisted_draft)
       VALUES (?, 'pub-legacy', 'draft', 'room', 'Legacy IA', 'Guadalajara', 'Centro', ?, 0)`,
    ).run(legacyId, now);
    db.prepare(
      `INSERT INTO rooms (id, property_id, status, sort_order) VALUES (?, ?, 'draft', 0)`,
    ).run("legacy-room-1", legacyId);
    db.prepare(
      `INSERT INTO assisted_draft_claim_tokens (
        token, property_id, created_by_admin_id, orphan_publisher_id, expires_at, created_at
      ) VALUES ('legacy-claim', ?, 'admin', 'orphan', ?, ?)`,
    ).run(legacyId, Date.now() + 86_400_000, Date.now());

    const listed = listAdminPosts(db, { status: "draft", limit: 25, offset: 0 });
    expect(listed.posts).toHaveLength(1);
    expect(listed.posts[0]?.assistedDraft).toBe(true);
    expect(listed.posts[0]?.createOrigin).toBe("ai_admin");
    expect(listed.posts[0]?.editPath).toBe(previewEditPath(legacyId, "legacy-room-1"));
    expect(listed.posts[0]?.viewPath).toBe(
      `/anuncio/${roomReferenceCode("legacy-room-1")}?claim=legacy-claim`,
    );
  });

  it("labels self-serve AI as ia_user and filters ia admin vs ia usuario", () => {
    const db = setupDb();
    const now = new Date().toISOString();
    const propUser = "prp__dddddddd-dddd-dddd-dddd-dddddddddddd";
    db.prepare(
      `INSERT INTO properties (id, publisher_id, status, post_mode, title, city, neighborhood, created_at, assisted_draft, created_by_admin_id)
       VALUES (?, 'pub-ai', 'draft', 'room', 'Cuarto IA admin', 'Guadalajara', 'Centro', ?, 1, 'admin-1')`,
    ).run(PROP_AI, now);
    db.prepare(
      `INSERT INTO assisted_draft_claim_tokens (
        token, property_id, created_by_admin_id, orphan_publisher_id, expires_at, created_at
      ) VALUES ('admin-claim', ?, 'admin-1', 'orphan', ?, ?)`,
    ).run(PROP_AI, Date.now() + 86_400_000, Date.now());

    db.prepare(
      `INSERT INTO properties (id, publisher_id, status, post_mode, title, city, neighborhood, created_at, assisted_draft, created_by_admin_id)
       VALUES (?, 'pub-user', 'draft', 'room', 'Cuarto IA usuario', 'Guadalajara', 'Centro', ?, 1, ?)`,
    ).run(propUser, now, SELF_SERVE_CREATOR_ID);
    db.prepare(
      `INSERT INTO assisted_draft_claim_tokens (
        token, property_id, created_by_admin_id, orphan_publisher_id, expires_at, created_at
      ) VALUES ('user-claim', ?, ?, 'orphan', ?, ?)`,
    ).run(propUser, SELF_SERVE_CREATOR_ID, Date.now() + 86_400_000, Date.now());

    const all = listAdminPosts(db, { status: "draft", limit: 25, offset: 0 });
    expect(all.posts.find((p) => p.propertyId === PROP_AI)?.createOrigin).toBe("ai_admin");
    expect(all.posts.find((p) => p.propertyId === propUser)?.createOrigin).toBe("ai_user");

    const adminOnly = listAdminPosts(db, { q: "ia admin", status: "draft", limit: 25, offset: 0 });
    expect(adminOnly.posts.map((p) => p.propertyId)).toEqual([PROP_AI]);

    const userOnly = listAdminPosts(db, { q: "ia usuario", status: "draft", limit: 25, offset: 0 });
    expect(userOnly.posts.map((p) => p.propertyId)).toEqual([propUser]);
  });
});

describe("resolveAdminPostCreateOrigin", () => {
  it("maps assisted creator ids to admin vs user badges", () => {
    expect(resolveAdminPostCreateOrigin({ assistedDraft: false })).toBe("manual");
    expect(
      resolveAdminPostCreateOrigin({ assistedDraft: true, createdByAdminId: "admin-9" }),
    ).toBe("ai_admin");
    expect(
      resolveAdminPostCreateOrigin({
        assistedDraft: true,
        createdByAdminId: SELF_SERVE_CREATOR_ID,
      }),
    ).toBe("ai_user");
    expect(
      resolveAdminPostCreateOrigin({
        assistedDraft: true,
        createdByAdminId: null,
        claimCreatedByAdminId: SELF_SERVE_CREATOR_ID,
      }),
    ).toBe("ai_user");
    expect(
      resolveAdminPostCreateOrigin({
        assistedDraft: true,
        createdByAdminId: null,
        claimCreatedByAdminId: null,
      }),
    ).toBe("ai_admin");
  });
});

describe("listAdminPosts messageThreadCount", () => {
  it("counts listing threads per room under the property (same seeker on two rooms = 2)", () => {
    const db = setupDb();
    const now = new Date().toISOString();
    const roomA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const roomB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const otherProp = "prp__eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
    const otherRoom = "cccccccc-cccc-cccc-cccc-cccccccccccc";

    db.prepare(
      `INSERT INTO properties (id, publisher_id, status, post_mode, title, city, neighborhood, created_at, published_at, assisted_draft)
       VALUES (?, 'pub-1', 'published', 'property', 'Multi room', 'Guadalajara', 'Centro', ?, ?, 0)`,
    ).run(PROP_MANUAL, now, now);
    db.prepare(
      `INSERT INTO rooms (id, property_id, status, sort_order) VALUES (?, ?, 'published', 0)`,
    ).run(roomA, PROP_MANUAL);
    db.prepare(
      `INSERT INTO rooms (id, property_id, status, sort_order) VALUES (?, ?, 'published', 1)`,
    ).run(roomB, PROP_MANUAL);

    db.prepare(
      `INSERT INTO properties (id, publisher_id, status, post_mode, title, city, neighborhood, created_at, published_at, assisted_draft)
       VALUES (?, 'pub-2', 'published', 'room', 'Other', 'Guadalajara', 'Centro', ?, ?, 0)`,
    ).run(otherProp, now, now);
    db.prepare(
      `INSERT INTO rooms (id, property_id, status, sort_order) VALUES (?, ?, 'published', 0)`,
    ).run(otherRoom, otherProp);

    // Two threads on different rooms of PROP_MANUAL + one support (ignored) + one on other property.
    db.prepare(
      `INSERT INTO conversations (id, listing_room_id, context_title, kind, created_at, updated_at)
       VALUES ('c1', ?, 'Room A', 'listing', ?, ?)`,
    ).run(roomA, now, now);
    db.prepare(
      `INSERT INTO conversations (id, listing_room_id, context_title, kind, created_at, updated_at)
       VALUES ('c2', ?, 'Room B', 'listing', ?, ?)`,
    ).run(roomB, now, now);
    db.prepare(
      `INSERT INTO conversations (id, listing_room_id, context_title, kind, created_at, updated_at)
       VALUES ('c3', ?, 'Support', 'support', ?, ?)`,
    ).run(roomA, now, now);
    db.prepare(
      `INSERT INTO conversations (id, listing_room_id, context_title, kind, created_at, updated_at)
       VALUES ('c4', ?, 'Other prop', 'listing', ?, ?)`,
    ).run(otherRoom, now, now);

    const listed = listAdminPosts(db, { status: "published", limit: 25, offset: 0 });
    expect(listed.posts.find((p) => p.propertyId === PROP_MANUAL)?.messageThreadCount).toBe(2);
    expect(listed.posts.find((p) => p.propertyId === otherProp)?.messageThreadCount).toBe(1);
  });
});

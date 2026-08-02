import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
  attachPublishFeedbackToProperty,
  backfillPublishFeedbackFromMessages,
} from "./adminPosts.js";

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
      lat REAL,
      lng REAL,
      summary TEXT,
      contact_whatsapp TEXT,
      property_kind TEXT,
      bedrooms_total INTEGER,
      bathrooms REAL,
      show_whatsapp INTEGER,
      image_urls_json TEXT,
      is_approximate_location INTEGER,
      approximate_radius_m INTEGER,
      occupied_by_women INTEGER,
      occupied_by_men INTEGER,
      street_view_pov_json TEXT,
      created_at TEXT,
      published_at TEXT,
      wizard_step INTEGER,
      posthog_session_id TEXT,
      feedback_rating INTEGER,
      feedback_comment TEXT,
      feedback_at TEXT
    );
    CREATE TABLE rooms (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      status TEXT,
      sort_order INTEGER
    );
    CREATE TABLE conversations (
      id TEXT PRIMARY KEY,
      listing_room_id TEXT,
      context_title TEXT,
      kind TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_user_id TEXT,
      body TEXT,
      created_at TEXT,
      read_at TEXT,
      attachments_json TEXT
    );
  `);
  return db;
}

describe("publish feedback attach + backfill", () => {
  it("attaches rating via room UUID and does not overwrite when onlyIfEmpty", () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO properties (id, publisher_id, status, post_mode, title, city, neighborhood, lat, lng, summary, contact_whatsapp, show_whatsapp, image_urls_json)
       VALUES ('prp__aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'pub', 'published', 'room', 'Test', 'GDL', 'Centro', 0, 0, '', '', 0, '[]')`,
    ).run();
    db.prepare(
      `INSERT INTO rooms (id, property_id, status, sort_order)
       VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'prp__aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'published', 0)`,
    ).run();

    expect(
      attachPublishFeedbackToProperty(db, {
        listingRoomId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        rating: 5,
        comment: "Excelente",
      }),
    ).toBe(true);

    expect(
      attachPublishFeedbackToProperty(db, {
        listingRoomId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        rating: 1,
        comment: "malo",
        onlyIfEmpty: true,
      }),
    ).toBe(false);

    const row = db
      .prepare(`SELECT feedback_rating, feedback_comment FROM properties WHERE id = ?`)
      .get("prp__aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa") as {
      feedback_rating: number;
      feedback_comment: string;
    };
    expect(row.feedback_rating).toBe(5);
    expect(row.feedback_comment).toBe("Excelente");
  });

  it("backfills from publish-feedback message bodies without clobbering existing ratings", () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO properties (id, publisher_id, status, post_mode, title, city, neighborhood, lat, lng, summary, contact_whatsapp, show_whatsapp, image_urls_json)
       VALUES
         ('prp__11111111-1111-1111-1111-111111111111', 'pub', 'published', 'room', 'Yann room', 'GDL', 'Minerva', 0, 0, '', '', 0, '[]'),
         ('prp__22222222-2222-2222-2222-222222222222', 'pub', 'published', 'property', 'Casa', 'GDL', 'Centro', 0, 0, '', '', 0, '[]')`,
    ).run();
    db.prepare(
      `INSERT INTO rooms (id, property_id, status, sort_order) VALUES
         ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'prp__11111111-1111-1111-1111-111111111111', 'published', 0),
         ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'prp__22222222-2222-2222-2222-222222222222', 'published', 0)`,
    ).run();
    // Seed an already-attached rating on Casa.
    db.prepare(
      `UPDATE properties SET feedback_rating = 5, feedback_comment = 'Excelente', feedback_at = '2026-08-01T00:00:00.000Z'
       WHERE id = 'prp__22222222-2222-2222-2222-222222222222'`,
    ).run();

    db.prepare(
      `INSERT INTO conversations (id, listing_room_id, context_title, kind, created_at, updated_at) VALUES
         ('c1', NULL, 'Feedback · Publicación', 'feedback', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'),
         ('c2', NULL, 'Feedback · Publicación', 'feedback', '2026-08-01T20:00:00.000Z', '2026-08-01T20:00:00.000Z')`,
    ).run();
    db.prepare(
      `INSERT INTO messages (id, conversation_id, sender_user_id, body, created_at) VALUES
         ('m1', 'c1', 'u1', '★★★★☆  4/5\n\nMuy bien\n\nContexto:\n- Publicación: [Habitación](/anuncio/AAAAAAAAA)', '2026-08-01T00:00:00.000Z'),
         ('m2', 'c2', 'u2', '★★★★★  5/5\n\nExcelente\n\nContexto:\n- Publicación: [Casa](/anuncio/ACCCCCCCC)', '2026-08-01T20:00:00.000Z')`,
    ).run();

    const n = backfillPublishFeedbackFromMessages(db);
    expect(n).toBe(1);

    const yann = db
      .prepare(`SELECT feedback_rating, feedback_comment FROM properties WHERE id = ?`)
      .get("prp__11111111-1111-1111-1111-111111111111") as {
      feedback_rating: number;
      feedback_comment: string;
    };
    expect(yann.feedback_rating).toBe(4);
    expect(yann.feedback_comment).toBe("Muy bien");

    const casa = db
      .prepare(`SELECT feedback_rating, feedback_comment FROM properties WHERE id = ?`)
      .get("prp__22222222-2222-2222-2222-222222222222") as {
      feedback_rating: number;
      feedback_comment: string;
    };
    expect(casa.feedback_rating).toBe(5);
    expect(casa.feedback_comment).toBe("Excelente");
  });
});

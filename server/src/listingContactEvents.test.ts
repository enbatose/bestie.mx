import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb } from "./db.js";
import {
  listingContactAdminNotifyCopy,
  listingContactNotifyCopy,
  listingFirstMessagePublisherCopy,
  recordListingContactEvent,
} from "./listingContactEvents.js";

describe("listingContactEvents", () => {
  let dir: string;
  let db: DatabaseSync;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-lce-"));
    db = openDb(join(dir, "t.db"));
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("builds notify copy without calling the seeker 'nuevo'", () => {
    expect(
      listingContactNotifyCopy({
        eventType: "reveal",
        seekerName: "María",
        listingTitle: "Cuarto Chapalita",
      }),
    ).toBe("Un usuario, María, consultó tu número de teléfono en la publicación Cuarto Chapalita.");
    expect(
      listingContactNotifyCopy({
        eventType: "call",
        seekerName: "Luis",
        listingTitle: "Loft",
      }),
    ).toBe(
      "Un usuario, Luis, mostró interés en llamar a tu número de teléfono publicado en el anuncio Loft.",
    );
    expect(
      listingContactAdminNotifyCopy({
        eventType: "first_message",
        seekerName: "Luis",
        listingTitle: "Loft",
      }),
    ).toBe("Interés: Luis envió un primer mensaje en Bestie sobre Loft.");
    expect(
      listingFirstMessagePublisherCopy({
        seekerName: "Luis",
        listingTitle: "Loft",
      }),
    ).toBe("Un usuario, Luis, te escribió en Bestie sobre Loft.");
  });

  it("logs every click but notifies only the first unique seeker action", () => {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)`,
    ).run("admin1", "batani.enrique@gmail.com", "x", "Enrique", now);
    db.prepare(
      `INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)`,
    ).run("seeker1", "s@example.com", "x", "Luis", now);
    db.prepare(
      `INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)`,
    ).run("owner1", "o@example.com", "x", "Ana", now);
    db.prepare(`INSERT INTO user_publishers (user_id, publisher_id, created_at) VALUES (?, ?, ?)`).run(
      "owner1",
      "pub1",
      now,
    );
    db.prepare(
      `INSERT INTO properties (id, publisher_id, status, post_mode, title, city, neighborhood, lat, lng, summary, contact_whatsapp, show_whatsapp)
       VALUES (?, ?, 'published', 'room', 'Casa test', 'Guadalajara', 'Americana', 20.67, -103.35, 'Resumen', '523312345678', 1)`,
    ).run("prop1", "pub1");
    db.prepare(
      `INSERT INTO rooms (id, property_id, status, title, rent_mxn, rooms_available, tags_json, roommate_gender_pref, age_min, age_max, summary)
       VALUES (?, ?, 'published', 'Cuarto', 5000, 1, '[]', 'any', 18, 40, '')`,
    ).run("room1", "prop1");

    const first = recordListingContactEvent(db, {
      listingId: "room1",
      seekerUserId: "seeker1",
      eventType: "reveal",
      listingPublisherId: "pub1",
      listingTitle: "Casa test",
      viewerIsOwner: false,
    });
    const second = recordListingContactEvent(db, {
      listingId: "room1",
      seekerUserId: "seeker1",
      eventType: "reveal",
      listingPublisherId: "pub1",
      listingTitle: "Casa test",
      viewerIsOwner: false,
    });
    expect(first).toEqual({ logged: true, notified: true });
    expect(second).toEqual({ logged: true, notified: false });
    const n = db.prepare(`SELECT COUNT(*) AS c FROM notifications WHERE user_id = ?`).get("owner1") as {
      c: number;
    };
    expect(n.c).toBe(1);
    const adminN = db.prepare(`SELECT COUNT(*) AS c FROM notifications WHERE user_id = ?`).get("admin1") as {
      c: number;
    };
    expect(adminN.c).toBe(2);
    const adminText = db.prepare(`SELECT text FROM notifications WHERE user_id = ? LIMIT 1`).get("admin1") as {
      text: string;
    };
    expect(adminText.text).toContain("Interés:");
    expect(adminText.text).toContain("Luis");
    const ev = db.prepare(`SELECT COUNT(*) AS c FROM listing_contact_events`).get() as { c: number };
    expect(ev.c).toBe(2);
  });

  it("does not notify when the viewer owns the listing", () => {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)`,
    ).run("owner1", "o@example.com", "x", "Ana", now);
    db.prepare(`INSERT INTO user_publishers (user_id, publisher_id, created_at) VALUES (?, ?, ?)`).run(
      "owner1",
      "pub1",
      now,
    );
    db.prepare(
      `INSERT INTO properties (id, publisher_id, status, post_mode, title, city, neighborhood, lat, lng, summary, contact_whatsapp, show_whatsapp)
       VALUES (?, ?, 'published', 'room', 'Casa test', 'Guadalajara', 'Americana', 20.67, -103.35, 'Resumen', '523312345678', 1)`,
    ).run("prop1", "pub1");
    db.prepare(
      `INSERT INTO rooms (id, property_id, status, title, rent_mxn, rooms_available, tags_json, roommate_gender_pref, age_min, age_max, summary)
       VALUES (?, ?, 'published', 'Cuarto', 5000, 1, '[]', 'any', 18, 40, '')`,
    ).run("room1", "prop1");

    const out = recordListingContactEvent(db, {
      listingId: "room1",
      seekerUserId: "owner1",
      eventType: "call",
      listingPublisherId: "pub1",
      listingTitle: "Casa test",
      viewerIsOwner: true,
    });
    expect(out).toEqual({ logged: false, notified: false });
  });
});

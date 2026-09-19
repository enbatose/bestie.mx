import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb } from "./db.js";
import {
  addPhotosEditPath,
  addPhotosShortPath,
  roomGalleryIsEmpty,
  scheduleNotifyPublisherAddPhotos,
} from "./listingAddPhotosNotify.js";
import { buildAddPhotosEmail } from "./emails/addPhotosEmail.js";
import { buildAddPhotosSms } from "./listingAddPhotosSms.js";
import { SMS_NOTIFY_MAX_CHARS } from "./listingFirstSeekerSms.js";
import { nextNotifyQuietHoursResumeAt } from "./notifyQuietHours.js";
import { roomReferenceCode } from "./listingReference.js";

describe("add-photos nudge", () => {
  let dir: string;
  let db: DatabaseSync;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-add-photos-"));
    db = openDb(join(dir, "t.db"));
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function seedRoom(opts?: { images?: string[] }) {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)`,
    ).run("owner1", "owner@example.com", "x", "Ana", now);
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
      `INSERT INTO rooms (id, property_id, status, title, rent_mxn, rooms_available, tags_json, roommate_gender_pref, age_min, age_max, summary, image_urls_json)
       VALUES (?, ?, 'published', 'Cuarto soleado', 5000, 1, '[]', 'any', 18, 40, '', ?)`,
    ).run("room1", "prop1", JSON.stringify(opts?.images ?? []));
  }

  it("builds deep links that open the photo editor", () => {
    const path = addPhotosEditPath("prop1", "room1");
    expect(path).toMatch(/^\/publicar\?/);
    expect(path).toContain("vista=1");
    expect(path).toContain("fotos=1");
    expect(path).toContain("edit=");
    expect(path).toContain("room=");
    expect(addPhotosShortPath("room1")).toBe(`/f/${encodeURIComponent(roomReferenceCode("room1"))}`);
  });

  it("keeps SMS under the Masivos cap", () => {
    const body = buildAddPhotosSms({
      shortEditUrl: "https://www.bestie.mx/f/Axxxxxxxx",
    });
    expect(Array.from(body).length).toBeLessThanOrEqual(SMS_NOTIFY_MAX_CHARS);
    expect(body).toMatch(/fotos/i);
    expect(body).toContain("https://www.bestie.mx/f/");
  });

  it("email CTA points at the photo editor URL", () => {
    const built = buildAddPhotosEmail({
      publisherName: "Ana",
      title: "Cuarto soleado",
      editPhotosUrl: "https://www.bestie.mx/publicar?edit=P1&vista=1&room=A1&fotos=1",
      listingUrl: "https://www.bestie.mx/anuncio/A1",
    });
    expect(built.subject).toMatch(/fotos/i);
    expect(built.html).toContain("fotos=1");
    expect(built.text).toContain("Subir fotos:");
  });

  it("detects empty vs populated galleries", () => {
    seedRoom({ images: [] });
    expect(roomGalleryIsEmpty(db, "room1")).toBe(true);
    db.prepare(`UPDATE rooms SET image_urls_json = ? WHERE id = ?`).run(
      JSON.stringify(["/api/uploads/aaaaaaaa-bbbb-4ccc-8ddd-111111111111.jpg"]),
      "room1",
    );
    expect(roomGalleryIsEmpty(db, "room1")).toBe(false);
  });

  it("creates an in-app notification with the photo-editor link and does not repeat", () => {
    seedRoom();
    // Noon CDMX — outside quiet hours
    const noon = new Date("2026-09-07T18:00:00.000Z");
    scheduleNotifyPublisherAddPhotos(db, { roomId: "room1" }, noon);

    const n = db
      .prepare(`SELECT text, link FROM notifications WHERE user_id = ?`)
      .get("owner1") as { text: string; link: string };
    expect(n.text).toMatch(/fotos/i);
    expect(n.link).toContain("fotos=1");
    expect(n.link).toContain("vista=1");

    scheduleNotifyPublisherAddPhotos(db, { roomId: "room1" }, noon);
    const count = db
      .prepare(`SELECT COUNT(*) AS c FROM notifications WHERE user_id = ?`)
      .get("owner1") as { c: number };
    expect(count.c).toBe(1);
  });

  it("defers email/SMS during quiet hours", () => {
    seedRoom();
    // 01:00 CDMX
    const quiet = new Date("2026-09-07T07:00:00.000Z");
    scheduleNotifyPublisherAddPhotos(db, { roomId: "room1" }, quiet);

    const row = db
      .prepare(`SELECT add_photos_nudge_due_at, add_photos_nudge_sent_at FROM rooms WHERE id = ?`)
      .get("room1") as {
      add_photos_nudge_due_at: string | null;
      add_photos_nudge_sent_at: string | null;
    };
    expect(row.add_photos_nudge_sent_at).toBeNull();
    expect(row.add_photos_nudge_due_at).toBeTruthy();
    const due = new Date(row.add_photos_nudge_due_at!);
    expect(due.getTime()).toBe(nextNotifyQuietHoursResumeAt(quiet, "America/Mexico_City").getTime());

    // In-app still fires immediately
    const n = db
      .prepare(`SELECT COUNT(*) AS c FROM notifications WHERE user_id = ?`)
      .get("owner1") as { c: number };
    expect(n.c).toBe(1);
  });

  it("skips nudge when the gallery already has photos", () => {
    seedRoom({ images: ["/api/uploads/aaaaaaaa-bbbb-4ccc-8ddd-222222222222.jpg"] });
    scheduleNotifyPublisherAddPhotos(db, { roomId: "room1" }, new Date("2026-09-07T18:00:00.000Z"));
    const n = db
      .prepare(`SELECT COUNT(*) AS c FROM notifications WHERE user_id = ?`)
      .get("owner1") as { c: number };
    expect(n.c).toBe(0);
  });
});

describe("nextNotifyQuietHoursResumeAt", () => {
  it("lands at 06:01 local after overnight quiet", () => {
    const quiet = new Date("2026-09-07T07:00:00.000Z"); // 01:00 CDMX
    const resume = nextNotifyQuietHoursResumeAt(quiet, "America/Mexico_City");
    // 06:01 CDMX = 12:01 UTC
    expect(resume.toISOString()).toBe("2026-09-07T12:01:00.000Z");
  });
});

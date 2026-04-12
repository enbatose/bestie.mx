import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import seed from "./seedListings.json" with { type: "json" };
import type { ListingStatus, PropertyListing } from "./types.js";

function migrateListingsTable(db: DatabaseSync): void {
  const cols = db.prepare("PRAGMA table_info(listings)").all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("publisher_id")) {
    db.exec("ALTER TABLE listings ADD COLUMN publisher_id TEXT;");
  }
}

export function openDb(databasePath: string): DatabaseSync {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA journal_mode = WAL;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      city TEXT NOT NULL,
      neighborhood TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      rent_mxn INTEGER NOT NULL,
      rooms_available INTEGER NOT NULL,
      tags_json TEXT NOT NULL,
      roommate_gender_pref TEXT NOT NULL,
      age_min INTEGER NOT NULL,
      age_max INTEGER NOT NULL,
      summary TEXT NOT NULL,
      contact_whatsapp TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published'
    );
  `);

  migrateListingsTable(db);

  const countRow = db.prepare("SELECT COUNT(*) AS c FROM listings").get() as { c: number };
  if (countRow.c === 0) {
    const insert = db.prepare(
      `INSERT INTO listings (
        id, title, city, neighborhood, lat, lng, rent_mxn, rooms_available,
        tags_json, roommate_gender_pref, age_min, age_max, summary, contact_whatsapp, status
      ) VALUES (
        @id, @title, @city, @neighborhood, @lat, @lng, @rentMxn, @roomsAvailable,
        @tagsJson, @roommateGenderPref, @ageMin, @ageMax, @summary, @contactWhatsApp, 'published'
      )`,
    );

    db.exec("BEGIN IMMEDIATE;");
    try {
      for (const row of seed as PropertyListing[]) {
        insert.run({
          id: row.id,
          title: row.title,
          city: row.city,
          neighborhood: row.neighborhood,
          lat: row.lat,
          lng: row.lng,
          rentMxn: row.rentMxn,
          roomsAvailable: row.roomsAvailable,
          tagsJson: JSON.stringify(row.tags),
          roommateGenderPref: row.roommateGenderPref,
          ageMin: row.ageMin,
          ageMax: row.ageMax,
          summary: row.summary,
          contactWhatsApp: row.contactWhatsApp,
        });
      }
      db.exec("COMMIT;");
    } catch {
      db.exec("ROLLBACK;");
      throw new Error("Failed to seed listings table");
    }
  }

  return db;
}

function listingStatusFromRow(row: Record<string, unknown>): ListingStatus {
  const s = String(row.status ?? "published");
  if (s === "draft" || s === "published" || s === "paused" || s === "archived") return s;
  return "published";
}

export function rowToListing(row: Record<string, unknown>): PropertyListing {
  const publisherRaw = row.publisher_id;
  const publisherId =
    publisherRaw != null && String(publisherRaw).trim() !== ""
      ? String(publisherRaw)
      : undefined;

  return {
    id: String(row.id),
    title: String(row.title),
    city: String(row.city),
    neighborhood: String(row.neighborhood),
    lat: Number(row.lat),
    lng: Number(row.lng),
    rentMxn: Number(row.rent_mxn),
    roomsAvailable: Number(row.rooms_available),
    tags: JSON.parse(String(row.tags_json)) as PropertyListing["tags"],
    roommateGenderPref: String(row.roommate_gender_pref) as PropertyListing["roommateGenderPref"],
    ageMin: Number(row.age_min),
    ageMax: Number(row.age_max),
    summary: String(row.summary),
    contactWhatsApp: String(row.contact_whatsapp),
    status: listingStatusFromRow(row),
    ...(publisherId ? { publisherId } : {}),
  };
}

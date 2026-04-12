import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import seed from "./seedListings.json" with { type: "json" };
import type {
  ListingStatus,
  LodgingType,
  PropertyKind,
  PropertyListing,
  RoomDimension,
} from "./types.js";

const LISTING_EXTRA_COLUMNS: { name: string; ddl: string }[] = [
  { name: "publisher_id", ddl: "TEXT" },
  { name: "lodging_type", ddl: "TEXT" },
  { name: "property_kind", ddl: "TEXT" },
  { name: "available_from", ddl: "TEXT" },
  { name: "minimal_stay_months", ddl: "INTEGER" },
  { name: "room_dimension", ddl: "TEXT" },
  { name: "aval_required", ddl: "INTEGER" },
  { name: "sublet_allowed", ddl: "INTEGER" },
];

function migrateListingsTable(db: DatabaseSync): void {
  const cols = db.prepare("PRAGMA table_info(listings)").all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  for (const { name, ddl } of LISTING_EXTRA_COLUMNS) {
    if (!names.has(name)) {
      db.exec(`ALTER TABLE listings ADD COLUMN ${name} ${ddl};`);
    }
  }
}

function int01(v: unknown): boolean | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return n !== 0;
}

function optStr(row: Record<string, unknown>, key: string): string | undefined {
  const v = row[key];
  if (v == null || String(v).trim() === "") return undefined;
  return String(v);
}

function optLodging(v: unknown): LodgingType | undefined {
  const s = String(v ?? "");
  if (s === "whole_home" || s === "private_room" || s === "shared_room") return s;
  return undefined;
}

function optPropertyKind(v: unknown): PropertyKind | undefined {
  const s = String(v ?? "");
  if (s === "house" || s === "apartment") return s;
  return undefined;
}

function optDim(v: unknown): RoomDimension | undefined {
  const s = String(v ?? "");
  if (s === "small" || s === "medium" || s === "large") return s;
  return undefined;
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
        tags_json, roommate_gender_pref, age_min, age_max, summary, contact_whatsapp, status,
        lodging_type, property_kind, available_from, minimal_stay_months, room_dimension,
        aval_required, sublet_allowed
      ) VALUES (
        @id, @title, @city, @neighborhood, @lat, @lng, @rentMxn, @roomsAvailable,
        @tagsJson, @roommateGenderPref, @ageMin, @ageMax, @summary, @contactWhatsApp, 'published',
        @lodgingType, @propertyKind, @availableFrom, @minimalStayMonths, @roomDimension,
        @avalRequired, @subletAllowed
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
          lodgingType: row.lodgingType ?? null,
          propertyKind: row.propertyKind ?? null,
          availableFrom: row.availableFrom ?? null,
          minimalStayMonths: row.minimalStayMonths ?? null,
          roomDimension: row.roomDimension ?? null,
          avalRequired: row.avalRequired === true ? 1 : row.avalRequired === false ? 0 : null,
          subletAllowed: row.subletAllowed === true ? 1 : row.subletAllowed === false ? 0 : null,
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

  const lodgingType = optLodging(row.lodging_type);
  const propertyKind = optPropertyKind(row.property_kind);
  const availableFrom = optStr(row, "available_from");
  const minimalStayRaw = row.minimal_stay_months;
  const minimalStayMonths =
    minimalStayRaw != null && Number.isFinite(Number(minimalStayRaw))
      ? Number(minimalStayRaw)
      : undefined;
  const roomDimension = optDim(row.room_dimension);
  const avalRequired = int01(row.aval_required);
  const subletAllowed = int01(row.sublet_allowed);

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
    ...(lodgingType ? { lodgingType } : {}),
    ...(propertyKind ? { propertyKind } : {}),
    ...(availableFrom ? { availableFrom } : {}),
    ...(minimalStayMonths != null ? { minimalStayMonths } : {}),
    ...(roomDimension ? { roomDimension } : {}),
    ...(avalRequired !== undefined ? { avalRequired } : {}),
    ...(subletAllowed !== undefined ? { subletAllowed } : {}),
  };
}

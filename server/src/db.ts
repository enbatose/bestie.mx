import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import legacySeed from "./seedListings.json" with { type: "json" };
import type { ListingStatus } from "./types.js";
import { backfillUserEmailCanonical } from "./authEmail.js";
import { ensurePhaseCDSchema } from "./phaseCDSchema.js";
import { ensureMessagingSchema } from "./messagingSchema.js";

const SEED_PUBLISHER_ID = "__seed__";

/** Legacy flat row shape (pre–Phase B `listings` table). */
type LegacyListingRow = {
  id: string;
  title: string;
  city: string;
  neighborhood: string;
  lat: number;
  lng: number;
  rentMxn: number;
  roomsAvailable: number;
  tags: string[];
  roommateGenderPref: string;
  ageMin: number;
  ageMax: number;
  summary: string;
  contactWhatsApp: string;
  lodgingType?: string;
  propertyKind?: string;
  availableFrom?: string;
  minimalStayMonths?: number;
  roomDimension?: string;
  avalRequired?: boolean;
  subletAllowed?: boolean;
};

function migrateLegacyListingsTableIfPresent(db: DatabaseSync): void {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='listings'")
    .get() as { name: string } | undefined;
  if (!row) return;

  const insertProp = db.prepare(`
    INSERT INTO properties (
      id, publisher_id, status, title, city, neighborhood, lat, lng, summary, contact_whatsapp, property_kind,
      bedrooms_total, bathrooms, show_whatsapp, image_urls_json
    ) VALUES (
      @id, @publisherId, @status, @title, @city, @neighborhood, @lat, @lng, @summary, @contactWhatsApp, @propertyKind,
      @bedroomsTotal, @bathrooms, @showWhatsapp, @imageUrlsJson
    )
  `);
  const insertRoom = db.prepare(`
    INSERT INTO rooms (
      id, property_id, status, title, rent_mxn, rooms_available, tags_json, roommate_gender_pref,
      age_min, age_max, summary, lodging_type, available_from, minimal_stay_months, room_dimension,
      aval_required, sublet_allowed, sort_order, deposit_mxn, image_urls_json, created_at, updated_at
    ) VALUES (
      @id, @propertyId, @status, @title, @rentMxn, @roomsAvailable, @tagsJson, @roommateGenderPref,
      @ageMin, @ageMax, @summary, @lodgingType, @availableFrom, @minimalStayMonths, @roomDimension,
      @avalRequired, @subletAllowed, @sortOrder, @depositMxn, @imageUrlsJson, @createdAt, @updatedAt
    )
  `);

  const legacyRows = db.prepare("SELECT * FROM listings").all() as Record<string, unknown>[];
  db.exec("BEGIN IMMEDIATE;");
  try {
    for (const r of legacyRows) {
      const listingId = String(r.id);
      const propertyId = `prp__${listingId}`;
      const pub =
        r.publisher_id != null && String(r.publisher_id).trim() !== ""
          ? String(r.publisher_id).trim()
          : SEED_PUBLISHER_ID;
      const st = String(r.status ?? "published") as ListingStatus;
      const propertyStatus: ListingStatus =
        st === "draft" || st === "published" || st === "paused" || st === "archived" ? st : "published";

      insertProp.run({
        id: propertyId,
        publisherId: pub,
        status: propertyStatus,
        title: String(r.title),
        city: String(r.city),
        neighborhood: String(r.neighborhood),
        lat: Number(r.lat),
        lng: Number(r.lng),
        summary: String(r.summary),
        contactWhatsApp: String(r.contact_whatsapp),
        propertyKind: r.property_kind != null && String(r.property_kind) !== "" ? String(r.property_kind) : null,
        bedroomsTotal: 1,
        bathrooms: 1,
        showWhatsapp: 1,
        imageUrlsJson: "[]",
      });

      insertRoom.run({
        id: listingId,
        propertyId,
        status: propertyStatus,
        title: "Espacio en renta",
        rentMxn: Number(r.rent_mxn),
        roomsAvailable: Number(r.rooms_available),
        tagsJson: String(r.tags_json),
        roommateGenderPref: String(r.roommate_gender_pref),
        ageMin: Number(r.age_min),
        ageMax: Number(r.age_max),
        summary: String(r.summary),
        lodgingType: r.lodging_type != null ? String(r.lodging_type) : null,
        availableFrom: r.available_from != null ? String(r.available_from) : null,
        minimalStayMonths: r.minimal_stay_months != null ? Number(r.minimal_stay_months) : null,
        roomDimension: r.room_dimension != null ? String(r.room_dimension) : null,
        avalRequired:
          r.aval_required === 1 || r.aval_required === true
            ? 1
            : r.aval_required === 0 || r.aval_required === false
              ? 0
              : null,
        subletAllowed:
          r.sublet_allowed === 1 || r.sublet_allowed === true
            ? 1
            : r.sublet_allowed === 0 || r.sublet_allowed === false
              ? 0
              : null,
        sortOrder: 0,
        depositMxn: 0,
        imageUrlsJson: "[]",
        createdAt: String(r.created_at ?? new Date().toISOString()),
        updatedAt: String(r.updated_at ?? r.created_at ?? new Date().toISOString()),
      });
    }
    db.exec("DROP TABLE listings");
    db.exec("COMMIT;");
  } catch (e) {
    db.exec("ROLLBACK;");
    throw e instanceof Error ? e : new Error(String(e));
  }
}

function tableHasColumn(db: DatabaseSync, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

/** Extended property/room fields: bedrooms total, bathrooms, WhatsApp visibility; per-room deposit. */
function migratePhaseBExtendedPropertyColumns(db: DatabaseSync): void {
  if (!tableHasColumn(db, "properties", "bedrooms_total")) {
    db.exec("ALTER TABLE properties ADD COLUMN bedrooms_total INTEGER NOT NULL DEFAULT 1");
  }
  if (!tableHasColumn(db, "properties", "bathrooms")) {
    db.exec("ALTER TABLE properties ADD COLUMN bathrooms REAL NOT NULL DEFAULT 1");
  }
  if (!tableHasColumn(db, "properties", "show_whatsapp")) {
    db.exec("ALTER TABLE properties ADD COLUMN show_whatsapp INTEGER NOT NULL DEFAULT 1");
  }
  if (!tableHasColumn(db, "rooms", "deposit_mxn")) {
    db.exec("ALTER TABLE rooms ADD COLUMN deposit_mxn INTEGER NOT NULL DEFAULT 0");
  }
}

function migrateImageUrlsJson(db: DatabaseSync): void {
  if (!tableHasColumn(db, "properties", "image_urls_json")) {
    db.exec(`ALTER TABLE properties ADD COLUMN image_urls_json TEXT NOT NULL DEFAULT '[]'`);
  }
  if (!tableHasColumn(db, "rooms", "image_urls_json")) {
    db.exec(`ALTER TABLE rooms ADD COLUMN image_urls_json TEXT NOT NULL DEFAULT '[]'`);
  }
}

function migratePropertyPostMode(db: DatabaseSync): void {
  if (!tableHasColumn(db, "properties", "post_mode")) {
    db.exec(`ALTER TABLE properties ADD COLUMN post_mode TEXT NOT NULL DEFAULT 'property'`);
  }
}

function migratePropertyApproximateLocation(db: DatabaseSync): void {
  if (!tableHasColumn(db, "properties", "is_approximate_location")) {
    db.exec(`ALTER TABLE properties ADD COLUMN is_approximate_location INTEGER NOT NULL DEFAULT 0`);
  }
}

/** SQLite `ALTER TABLE ADD COLUMN` only allows constant DEFAULTs — not `CURRENT_TIMESTAMP`. */
const ROOM_TS_ALTER_PLACEHOLDER = "1970-01-01T00:00:00.000Z";

function migrateRoomTimestamps(db: DatabaseSync): void {
  if (!tableHasColumn(db, "rooms", "created_at")) {
    db.exec(
      `ALTER TABLE rooms ADD COLUMN created_at TEXT NOT NULL DEFAULT '${ROOM_TS_ALTER_PLACEHOLDER}'`,
    );
  }
  if (!tableHasColumn(db, "rooms", "updated_at")) {
    db.exec(
      `ALTER TABLE rooms ADD COLUMN updated_at TEXT NOT NULL DEFAULT '${ROOM_TS_ALTER_PLACEHOLDER}'`,
    );
  }
  db.prepare(`UPDATE rooms SET created_at = datetime('now') WHERE created_at = ?`).run(ROOM_TS_ALTER_PLACEHOLDER);
  db.prepare(`UPDATE rooms SET updated_at = datetime('now') WHERE updated_at = ?`).run(ROOM_TS_ALTER_PLACEHOLDER);
  db.prepare(
    `UPDATE rooms SET updated_at = created_at WHERE updated_at IS NULL OR trim(updated_at) = ''`,
  ).run();
}

function ensureUploadBlobSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS upload_blobs (
      filename TEXT PRIMARY KEY,
      mime_type TEXT NOT NULL,
      bytes BLOB NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function ensurePhaseBSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      publisher_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      post_mode TEXT NOT NULL DEFAULT 'property',
      title TEXT NOT NULL,
      city TEXT NOT NULL,
      neighborhood TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      contact_whatsapp TEXT NOT NULL,
      property_kind TEXT,
      bedrooms_total INTEGER NOT NULL DEFAULT 1,
      bathrooms REAL NOT NULL DEFAULT 1,
      show_whatsapp INTEGER NOT NULL DEFAULT 1,
      image_urls_json TEXT NOT NULL DEFAULT '[]',
      is_approximate_location INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      title TEXT NOT NULL,
      rent_mxn INTEGER NOT NULL,
      rooms_available INTEGER NOT NULL DEFAULT 1,
      tags_json TEXT NOT NULL,
      roommate_gender_pref TEXT NOT NULL,
      age_min INTEGER NOT NULL,
      age_max INTEGER NOT NULL,
      summary TEXT NOT NULL,
      lodging_type TEXT,
      available_from TEXT,
      minimal_stay_months INTEGER,
      room_dimension TEXT,
      aval_required INTEGER,
      sublet_allowed INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      deposit_mxn INTEGER NOT NULL DEFAULT 0,
      image_urls_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_rooms_property ON rooms(property_id);
    CREATE INDEX IF NOT EXISTS idx_rooms_status_rent ON rooms(status, rent_mxn);
    CREATE INDEX IF NOT EXISTS idx_properties_pub ON properties(publisher_id);
    CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
    CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
    CREATE INDEX IF NOT EXISTS idx_properties_lat_lng ON properties(lat, lng);
  `);
  migratePhaseBExtendedPropertyColumns(db);
  migrateImageUrlsJson(db);
  migratePropertyPostMode(db);
  migratePropertyApproximateLocation(db);
  migrateRoomTimestamps(db);
  ensureUploadBlobSchema(db);
}

function seedFromLegacyJson(db: DatabaseSync, rows: LegacyListingRow[]): void {
  const insertProp = db.prepare(`
    INSERT INTO properties (
      id, publisher_id, status, title, city, neighborhood, lat, lng, summary, contact_whatsapp, property_kind,
      bedrooms_total, bathrooms, show_whatsapp, image_urls_json, is_approximate_location
    ) VALUES (
      @id, @publisherId, 'published', @title, @city, @neighborhood, @lat, @lng, @summary, @contactWhatsApp, @propertyKind,
      @bedroomsTotal, @bathrooms, @showWhatsapp, @imageUrlsJson, 0
    )
  `);
  const insertRoom = db.prepare(`
    INSERT INTO rooms (
      id, property_id, status, title, rent_mxn, rooms_available, tags_json, roommate_gender_pref,
      age_min, age_max, summary, lodging_type, available_from, minimal_stay_months, room_dimension,
      aval_required, sublet_allowed, sort_order, deposit_mxn, image_urls_json, created_at, updated_at
    ) VALUES (
      @id, @propertyId, 'published', @title, @rentMxn, @roomsAvailable, @tagsJson, @roommateGenderPref,
      @ageMin, @ageMax, @summary, @lodgingType, @availableFrom, @minimalStayMonths, @roomDimension,
      @avalRequired, @subletAllowed, 0, @depositMxn, @imageUrlsJson, @createdAt, @updatedAt
    )
  `);

  db.exec("BEGIN IMMEDIATE;");
  try {
    for (const row of rows) {
      const propertyId = `prp__${row.id}`;
      const parts = row.title.split(/[—–-]/).map((s) => s.trim());
      const propertyTitle = parts[0] && parts[0].length > 0 ? parts[0]! : row.title;
      const roomTitle =
        parts.length > 1 && parts[1]!.length > 0 ? parts.slice(1).join(" · ") : "Cuarto disponible";

      insertProp.run({
        id: propertyId,
        publisherId: SEED_PUBLISHER_ID,
        title: propertyTitle,
        city: row.city,
        neighborhood: row.neighborhood,
        lat: row.lat,
        lng: row.lng,
        summary: row.summary,
        contactWhatsApp: row.contactWhatsApp,
        propertyKind: row.propertyKind ?? null,
        bedroomsTotal: 1,
        bathrooms: 1,
        showWhatsapp: 1,
        imageUrlsJson: "[]",
      });

      insertRoom.run({
        id: row.id,
        propertyId,
        title: roomTitle,
        rentMxn: row.rentMxn,
        roomsAvailable: row.roomsAvailable,
        tagsJson: JSON.stringify(row.tags),
        roommateGenderPref: row.roommateGenderPref,
        ageMin: row.ageMin,
        ageMax: row.ageMax,
        summary: row.summary,
        lodgingType: row.lodgingType ?? null,
        availableFrom: row.availableFrom ?? null,
        minimalStayMonths: row.minimalStayMonths ?? null,
        roomDimension: row.roomDimension ?? null,
        avalRequired: row.avalRequired === true ? 1 : row.avalRequired === false ? 0 : null,
        subletAllowed: row.subletAllowed === true ? 1 : row.subletAllowed === false ? 0 : null,
        depositMxn: 0,
        imageUrlsJson: "[]",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      });
    }

    // Demo: two published rooms under one Bucerías property (stable ids for tests / UI).
    const dupPropId = "prp__buc_duplex_demo";
    insertProp.run({
      id: dupPropId,
      publisherId: SEED_PUBLISHER_ID,
      title: "Casa playa — dos cuartos (demo)",
      city: "Bucerías",
      neighborhood: "La Cruz",
      lat: 20.746,
      lng: -105.326,
      summary: "Dos espacios en la misma casa; ideal roomies que ya se conocen.",
      contactWhatsApp: "523229292929",
      propertyKind: "house",
      bedroomsTotal: 2,
      bathrooms: 2,
      showWhatsapp: 1,
      imageUrlsJson: "[]",
    });
    insertRoom.run({
      id: "buc-demo-a",
      propertyId: dupPropId,
      title: "Cuarto planta baja",
      rentMxn: 4800,
      roomsAvailable: 1,
      tagsJson: JSON.stringify(["wifi", "mascotas"]),
      roommateGenderPref: "any",
      ageMin: 22,
      ageMax: 40,
      summary: "Acceso directo al patio.",
      lodgingType: "private_room",
      availableFrom: "2025-05-01",
      minimalStayMonths: 2,
      roomDimension: "medium",
      avalRequired: 0,
      subletAllowed: 1,
      depositMxn: 2400,
      imageUrlsJson: "[]",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });
    insertRoom.run({
      id: "buc-demo-b",
      propertyId: dupPropId,
      title: "Cuarto planta alta",
      rentMxn: 4600,
      roomsAvailable: 1,
      tagsJson: JSON.stringify(["wifi", "muebles"]),
      roommateGenderPref: "any",
      ageMin: 22,
      ageMax: 40,
      summary: "Más silencioso, ventilación cruzada.",
      lodgingType: "private_room",
      availableFrom: "2025-05-01",
      minimalStayMonths: 2,
      roomDimension: "small",
      avalRequired: 0,
      subletAllowed: 0,
      depositMxn: 2300,
      imageUrlsJson: "[]",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });

    db.exec("COMMIT;");
  } catch (e) {
    db.exec("ROLLBACK;");
    throw e instanceof Error ? e : new Error(String(e));
  }
}

export function openDb(databasePath: string): DatabaseSync {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  ensurePhaseBSchema(db);
  migrateLegacyListingsTableIfPresent(db);
  ensurePhaseCDSchema(db);
  backfillUserEmailCanonical(db);
  ensureMessagingSchema(db);

  const countRow = db.prepare("SELECT COUNT(*) AS c FROM properties").get() as { c: number };
  if (countRow.c === 0) {
    seedFromLegacyJson(db, legacySeed as LegacyListingRow[]);
  }

  return db;
}

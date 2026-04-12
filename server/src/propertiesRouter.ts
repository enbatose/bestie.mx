import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import express, { type Request, type Response } from "express";
import { joinRowToPropertyListing, ROOM_PROPERTY_JOIN_SQL } from "./listingDto.js";
import { createSlidingWindowLimiter } from "./rateLimit.js";
import { getOrCreatePublisherId, readPublisherIdFromRequest } from "./session.js";
import {
  CITY_MAX_LEN,
  clampAge,
  clampRentMxn,
  clampRoomsAvailable,
  clampStr,
  isSafePropertyId,
  isSafeRoomOrListingId,
  NEIGHBORHOOD_MAX_LEN,
  normalizeWhatsAppDigits,
  ROOM_TITLE_MAX_LEN,
  SUMMARY_MAX_LEN,
  TITLE_MAX_LEN,
  validLatLng,
} from "./validation.js";
import type {
  ListingStatus,
  ListingTag,
  LodgingType,
  Property,
  PropertyKind,
  PropertyWithRooms,
  Room,
  RoomDimension,
  RoommateGenderPref,
} from "./types.js";

function isListingTag(t: string): t is ListingTag {
  return (
    t === "wifi" ||
    t === "mascotas" ||
    t === "estacionamiento" ||
    t === "muebles" ||
    t === "baño-privado" ||
    t === "fumar" ||
    t === "fiestas"
  );
}

function isListingStatus(s: string): s is ListingStatus {
  return s === "draft" || s === "published" || s === "paused" || s === "archived";
}

function isRoommateGenderPref(s: string): s is RoommateGenderPref {
  return s === "any" || s === "female" || s === "male";
}

function optLodging(v: unknown): LodgingType | undefined {
  if (v !== "whole_home" && v !== "private_room" && v !== "shared_room") return undefined;
  return v;
}

function optPropertyKind(v: unknown): PropertyKind | undefined {
  if (v !== "house" && v !== "apartment") return undefined;
  return v;
}

function optIsoDate(v: unknown): string | undefined {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return undefined;
  return v.trim();
}

function optPositiveInt(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return undefined;
  return Math.floor(v);
}

function optDim(v: unknown): RoomDimension | undefined {
  if (v !== "small" && v !== "medium" && v !== "large") return undefined;
  return v;
}

function optBool(v: unknown): boolean | undefined {
  if (typeof v !== "boolean") return undefined;
  return v;
}

function rowToProperty(row: Record<string, unknown>): Property {
  const pk = optPropertyKind(row.property_kind);
  const st = String(row.status ?? "draft");
  const status: ListingStatus = isListingStatus(st) ? st : "draft";
  return {
    id: String(row.id),
    publisherId: String(row.publisher_id),
    status,
    title: String(row.title),
    city: String(row.city),
    neighborhood: String(row.neighborhood),
    lat: Number(row.lat),
    lng: Number(row.lng),
    summary: String(row.summary ?? ""),
    contactWhatsApp: String(row.contact_whatsapp),
    ...(pk ? { propertyKind: pk } : {}),
  };
}

function rowToRoom(row: Record<string, unknown>): Room {
  const tags = JSON.parse(String(row.tags_json)) as Room["tags"];
  const lodgingType = optLodging(row.lodging_type);
  const availableFrom =
    row.available_from != null && String(row.available_from).trim() !== ""
      ? String(row.available_from).trim()
      : undefined;
  const minimalStayMonths =
    row.minimal_stay_months != null && Number.isFinite(Number(row.minimal_stay_months))
      ? Number(row.minimal_stay_months)
      : undefined;
  const roomDimension = optDim(row.room_dimension);
  const aval =
    row.aval_required === 1 || row.aval_required === true
      ? true
      : row.aval_required === 0 || row.aval_required === false
        ? false
        : undefined;
  const sub =
    row.sublet_allowed === 1 || row.sublet_allowed === true
      ? true
      : row.sublet_allowed === 0 || row.sublet_allowed === false
        ? false
        : undefined;

  const rst = String(row.status ?? "draft");
  const rstatus: ListingStatus = isListingStatus(rst) ? rst : "draft";
  return {
    id: String(row.id),
    propertyId: String(row.property_id),
    status: rstatus,
    title: String(row.title),
    rentMxn: Number(row.rent_mxn),
    roomsAvailable: Number(row.rooms_available),
    tags,
    roommateGenderPref: String(row.roommate_gender_pref) as RoommateGenderPref,
    ageMin: Number(row.age_min),
    ageMax: Number(row.age_max),
    summary: String(row.summary),
    sortOrder: Number(row.sort_order ?? 0),
    ...(lodgingType ? { lodgingType } : {}),
    ...(availableFrom ? { availableFrom } : {}),
    ...(minimalStayMonths != null ? { minimalStayMonths } : {}),
    ...(roomDimension ? { roomDimension } : {}),
    ...(aval !== undefined ? { avalRequired: aval } : {}),
    ...(sub !== undefined ? { subletAllowed: sub } : {}),
  };
}

function canTransitionProperty(from: ListingStatus, to: ListingStatus): boolean {
  if (from === to) return true;
  if (from === "draft") return to === "published";
  if (from === "published") return to === "paused" || to === "archived";
  if (from === "paused") return to === "published" || to === "archived";
  return false;
}

function rateLimitKey(req: Request): string {
  const ip = req.ip ?? "unknown";
  const fp = (req.get("x-device-fingerprint") ?? "").trim().slice(0, 64);
  return `${ip}|${fp}`;
}

function parsePostLimit(): { windowMs: number; max: number } {
  const windowMs = Number(process.env.RATE_LIMIT_POST_LISTINGS_WINDOW_MS);
  const max = Number(process.env.RATE_LIMIT_POST_LISTINGS_MAX);
  return {
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 3_600_000,
    max: Number.isFinite(max) && max > 0 ? max : 30,
  };
}

const publishLimiter = createSlidingWindowLimiter(parsePostLimit());

export function propertiesRouter(db: DatabaseSync) {
  const r = express.Router();
  const jsonMw = express.json({ limit: "512kb" });

  /**
   * Wizard publish: one property + ≥1 rooms in a transaction.
   * Body: { legalAccepted: true, property: {...}, rooms: [...] }
   * Registered before `/:id` so the path `/publish-bundle` is not captured as an id.
   */
  r.post("/publish-bundle", jsonMw, (req: Request, res: Response) => {
    const lim = publishLimiter(rateLimitKey(req));
    if (!lim.ok) {
      const retryAfterSec = Math.ceil(lim.retryAfterMs / 1000);
      res.status(429).set("Retry-After", String(retryAfterSec)).json({
        error: "rate_limited",
        retryAfterSec,
      });
      return;
    }

    const body = req.body as {
      legalAccepted?: unknown;
      property?: Partial<Property> & Record<string, unknown>;
      rooms?: unknown[];
    };
    if (body.legalAccepted !== true) {
      res.status(400).json({ error: "legal_required", message: "Must accept legal acknowledgment." });
      return;
    }
    const p = body.property;
    const roomsIn = Array.isArray(body.rooms) ? body.rooms : [];
    if (
      !p ||
      typeof p.title !== "string" ||
      typeof p.city !== "string" ||
      typeof p.neighborhood !== "string" ||
      typeof p.lat !== "number" ||
      typeof p.lng !== "number" ||
      typeof p.contactWhatsApp !== "string" ||
      roomsIn.length < 1
    ) {
      res.status(400).json({ error: "invalid_body", message: "property + at least one room required." });
      return;
    }

    for (const raw of roomsIn) {
      const rm = raw as Partial<Room>;
      if (
        typeof rm.title !== "string" ||
        typeof rm.rentMxn !== "number" ||
        typeof rm.roomsAvailable !== "number" ||
        !Array.isArray(rm.tags) ||
        typeof rm.roommateGenderPref !== "string" ||
        typeof rm.ageMin !== "number" ||
        typeof rm.ageMax !== "number" ||
        typeof rm.summary !== "string"
      ) {
        res.status(400).json({ error: "invalid_room" });
        return;
      }
    }

    const contactDigits = normalizeWhatsAppDigits(p.contactWhatsApp);
    if (contactDigits == null) {
      res.status(400).json({ error: "invalid_whatsapp" });
      return;
    }
    if (!validLatLng(p.lat, p.lng)) {
      res.status(400).json({ error: "invalid_geo" });
      return;
    }
    const propSummaryRaw = typeof p.summary === "string" ? p.summary : "";
    const pt = clampStr(p.title, TITLE_MAX_LEN);
    const pc = clampStr(p.city, CITY_MAX_LEN);
    const pn = clampStr(p.neighborhood, NEIGHBORHOOD_MAX_LEN);
    const ps = clampStr(propSummaryRaw, SUMMARY_MAX_LEN);
    if (!pt || !pc || !pn) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }

    const publisherId = getOrCreatePublisherId(req, res);
    const propertyId = `prp__${randomUUID()}`;
    const propertyKind = optPropertyKind(p.propertyKind);

    const insertProp = db.prepare(`
      INSERT INTO properties (
        id, publisher_id, status, title, city, neighborhood, lat, lng, summary, contact_whatsapp, property_kind
      ) VALUES (?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertRoom = db.prepare(`
      INSERT INTO rooms (
        id, property_id, status, title, rent_mxn, rooms_available, tags_json, roommate_gender_pref,
        age_min, age_max, summary, lodging_type, available_from, minimal_stay_months, room_dimension,
        aval_required, sublet_allowed, sort_order
      ) VALUES (?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      db.exec("BEGIN IMMEDIATE;");
      insertProp.run(
        propertyId,
        publisherId,
        pt,
        pc,
        pn,
        p.lat,
        p.lng,
        ps,
        contactDigits,
        propertyKind ?? null,
      );

      let order = 0;
      for (const raw of roomsIn) {
        const rm = raw as Partial<Room> & { id?: string };
        if (!isRoommateGenderPref(String(rm.roommateGenderPref))) {
          throw new Error("bad_pref");
        }
        const tags = (rm.tags as unknown[]).filter(
          (t): t is ListingTag => typeof t === "string" && isListingTag(t),
        );
        if (tags.length !== (rm.tags as unknown[]).length) throw new Error("bad_tags");
        const roomIdRaw = typeof rm.id === "string" && rm.id.trim() ? rm.id.trim() : randomUUID();
        const roomId = isSafeRoomOrListingId(roomIdRaw) ? roomIdRaw : randomUUID();
        const title = clampStr(String(rm.title), ROOM_TITLE_MAX_LEN);
        const summary = clampStr(String(rm.summary), SUMMARY_MAX_LEN);
        if (!title || !summary) throw new Error("bad_room_text");
        const rentMxn = clampRentMxn(Number(rm.rentMxn));
        const roomsAvailable = clampRoomsAvailable(Number(rm.roomsAvailable));
        const pref = String(rm.roommateGenderPref) as RoommateGenderPref;
        const ageMin = clampAge(Number(rm.ageMin), 18);
        const ageMax = clampAge(Number(rm.ageMax), 99);
        if (ageMin > ageMax) throw new Error("bad_age");
        insertRoom.run(
          roomId,
          propertyId,
          title,
          rentMxn,
          roomsAvailable,
          JSON.stringify(tags),
          pref,
          ageMin,
          ageMax,
          summary,
          optLodging(rm.lodgingType) ?? null,
          optIsoDate(rm.availableFrom) ?? null,
          optPositiveInt(rm.minimalStayMonths) ?? null,
          optDim(rm.roomDimension) ?? null,
          optBool(rm.avalRequired) === true ? 1 : optBool(rm.avalRequired) === false ? 0 : null,
          optBool(rm.subletAllowed) === true ? 1 : optBool(rm.subletAllowed) === false ? 0 : null,
          order++,
        );
      }
      db.exec("COMMIT;");
    } catch {
      db.exec("ROLLBACK;");
      res.status(400).json({ error: "invalid_body" });
      return;
    }

    const rows = db
      .prepare(`${ROOM_PROPERTY_JOIN_SQL} WHERE p.id = ? ORDER BY r.sort_order ASC, r.id ASC`)
      .all(propertyId) as Record<string, unknown>[];
    res.status(201).json({
      propertyId,
      rooms: rows.map(joinRowToPropertyListing),
    });
  });

  /** Public: property + published rooms only. Owner cookie: all rooms for that property. */
  r.get("/:id", (req: Request, res: Response) => {
    const propertyId = req.params.id;
    if (!isSafePropertyId(propertyId)) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const propRow = db.prepare("SELECT * FROM properties WHERE id = ?").get(propertyId) as
      | Record<string, unknown>
      | undefined;
    if (!propRow) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const publisherId = readPublisherIdFromRequest(req);
    const owner = publisherId != null && String(propRow.publisher_id) === publisherId;

    const roomSql = owner
      ? "SELECT * FROM rooms WHERE property_id = ? ORDER BY sort_order ASC, id ASC"
      : "SELECT * FROM rooms WHERE property_id = ? AND status = 'published' ORDER BY sort_order ASC, id ASC";
    const roomRows = db.prepare(roomSql).all(propertyId) as Record<string, unknown>[];

    if (!owner && String(propRow.status) !== "published") {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const property = rowToProperty(propRow);
    const rooms = roomRows.map(rowToRoom);
    const payload: PropertyWithRooms = { property, rooms };
    res.json(payload);
  });

  /** Create empty draft property (address shell). */
  r.post("/", jsonMw, (req: Request, res: Response) => {
    const lim = publishLimiter(rateLimitKey(req));
    if (!lim.ok) {
      const retryAfterSec = Math.ceil(lim.retryAfterMs / 1000);
      res.status(429).set("Retry-After", String(retryAfterSec)).json({
        error: "rate_limited",
        retryAfterSec,
      });
      return;
    }
    const publisherId = getOrCreatePublisherId(req, res);
    const body = req.body as Partial<Property>;
    if (
      typeof body.title !== "string" ||
      typeof body.city !== "string" ||
      typeof body.neighborhood !== "string" ||
      typeof body.lat !== "number" ||
      typeof body.lng !== "number" ||
      typeof body.contactWhatsApp !== "string"
    ) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const wa = normalizeWhatsAppDigits(body.contactWhatsApp);
    if (wa == null) {
      res.status(400).json({ error: "invalid_whatsapp" });
      return;
    }
    if (!validLatLng(body.lat, body.lng)) {
      res.status(400).json({ error: "invalid_geo" });
      return;
    }
    const title = clampStr(body.title, TITLE_MAX_LEN);
    const city = clampStr(body.city, CITY_MAX_LEN);
    const neighborhood = clampStr(body.neighborhood, NEIGHBORHOOD_MAX_LEN);
    const summary = clampStr(typeof body.summary === "string" ? body.summary : "", SUMMARY_MAX_LEN);
    if (!title || !city || !neighborhood) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const propertyKind = optPropertyKind(body.propertyKind);
    const id = randomUUID();
    const propertyId = `prp__${id}`;
    db.prepare(
      `INSERT INTO properties (
        id, publisher_id, status, title, city, neighborhood, lat, lng, summary, contact_whatsapp, property_kind
      ) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      propertyId,
      publisherId,
      title,
      city,
      neighborhood,
      body.lat,
      body.lng,
      summary,
      wa,
      propertyKind ?? null,
    );
    const created = db.prepare("SELECT * FROM properties WHERE id = ?").get(propertyId) as Record<string, unknown>;
    res.status(201).json(rowToProperty(created));
  });

  /** Add a draft room to a property you own. */
  r.post("/:id/rooms", jsonMw, (req: Request, res: Response) => {
    const lim = publishLimiter(rateLimitKey(req));
    if (!lim.ok) {
      const retryAfterSec = Math.ceil(lim.retryAfterMs / 1000);
      res.status(429).set("Retry-After", String(retryAfterSec)).json({
        error: "rate_limited",
        retryAfterSec,
      });
      return;
    }
    const publisherId = readPublisherIdFromRequest(req);
    if (!publisherId) {
      res.status(401).json({ error: "publisher_session_required" });
      return;
    }
    const propertyId = req.params.id;
    if (!isSafePropertyId(propertyId)) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const prop = db.prepare("SELECT * FROM properties WHERE id = ?").get(propertyId) as Record<string, unknown> | undefined;
    if (!prop || String(prop.publisher_id) !== publisherId) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const body = req.body as Partial<Room>;
    if (
      typeof body.title !== "string" ||
      typeof body.rentMxn !== "number" ||
      typeof body.roomsAvailable !== "number" ||
      !Array.isArray(body.tags) ||
      typeof body.roommateGenderPref !== "string" ||
      typeof body.ageMin !== "number" ||
      typeof body.ageMax !== "number" ||
      typeof body.summary !== "string"
    ) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    if (!isRoommateGenderPref(body.roommateGenderPref)) {
      res.status(400).json({ error: "invalid_gender_pref" });
      return;
    }
    const tags = body.tags.filter((t): t is ListingTag => typeof t === "string" && isListingTag(t));
    if (tags.length !== body.tags.length) {
      res.status(400).json({ error: "invalid_tags" });
      return;
    }

    const rTitle = clampStr(body.title, ROOM_TITLE_MAX_LEN);
    const rSummary = clampStr(body.summary, SUMMARY_MAX_LEN);
    if (!rTitle || !rSummary) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const rentMxn = clampRentMxn(body.rentMxn);
    const roomsAvailable = clampRoomsAvailable(body.roomsAvailable);
    const ageMin = clampAge(body.ageMin, 18);
    const ageMax = clampAge(body.ageMax, 99);
    if (ageMin > ageMax) {
      res.status(400).json({ error: "invalid_age_range" });
      return;
    }

    const maxSort =
      (db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM rooms WHERE property_id = ?").get(propertyId) as {
        m: number;
      }).m + 1;

    const roomIdRaw = typeof body.id === "string" && body.id.trim() ? body.id.trim() : randomUUID();
    const roomId = isSafeRoomOrListingId(roomIdRaw) ? roomIdRaw : randomUUID();
    const lodgingType = optLodging(body.lodgingType);
    const availableFrom = optIsoDate(body.availableFrom);
    const minimalStayMonths = optPositiveInt(body.minimalStayMonths);
    const roomDimension = optDim(body.roomDimension);
    const avalRequired = optBool(body.avalRequired);
    const subletAllowed = optBool(body.subletAllowed);

    try {
      db.prepare(
        `INSERT INTO rooms (
          id, property_id, status, title, rent_mxn, rooms_available, tags_json, roommate_gender_pref,
          age_min, age_max, summary, lodging_type, available_from, minimal_stay_months, room_dimension,
          aval_required, sublet_allowed, sort_order
        ) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        roomId,
        propertyId,
        rTitle,
        rentMxn,
        roomsAvailable,
        JSON.stringify(tags),
        body.roommateGenderPref,
        ageMin,
        ageMax,
        rSummary,
        lodgingType ?? null,
        availableFrom ?? null,
        minimalStayMonths ?? null,
        roomDimension ?? null,
        avalRequired === true ? 1 : avalRequired === false ? 0 : null,
        subletAllowed === true ? 1 : subletAllowed === false ? 0 : null,
        maxSort,
      );
    } catch {
      res.status(409).json({ error: "conflict" });
      return;
    }

    const row = db.prepare("SELECT * FROM rooms WHERE id = ?").get(roomId) as Record<string, unknown>;
    res.status(201).json(rowToRoom(row));
  });

  /** Update property fields and/or status (pause cascades to rooms). */
  r.patch("/:id", jsonMw, (req: Request, res: Response) => {
    const publisherId = readPublisherIdFromRequest(req);
    if (!publisherId) {
      res.status(401).json({ error: "publisher_session_required" });
      return;
    }
    const propertyId = req.params.id;
    if (!isSafePropertyId(propertyId)) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const prop = db.prepare("SELECT * FROM properties WHERE id = ?").get(propertyId) as Record<string, unknown> | undefined;
    if (!prop || String(prop.publisher_id) !== publisherId) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const patch = req.body as {
      status?: unknown;
      title?: unknown;
      summary?: unknown;
      neighborhood?: unknown;
      lat?: unknown;
      lng?: unknown;
      contactWhatsApp?: unknown;
      propertyKind?: unknown;
    };

    const curStatus = String(prop.status) as ListingStatus;
    if (patch.status != null) {
      if (typeof patch.status !== "string" || !isListingStatus(patch.status)) {
        res.status(400).json({ error: "invalid_body" });
        return;
      }
      if (!canTransitionProperty(curStatus, patch.status)) {
        res.status(400).json({ error: "invalid_transition" });
        return;
      }
    }

    const nextTitle = clampStr(
      typeof patch.title === "string" ? patch.title : String(prop.title),
      TITLE_MAX_LEN,
    );
    const nextSummary = clampStr(
      typeof patch.summary === "string" ? patch.summary : String(prop.summary ?? ""),
      SUMMARY_MAX_LEN,
    );
    const nextHood = clampStr(
      typeof patch.neighborhood === "string" ? patch.neighborhood : String(prop.neighborhood),
      NEIGHBORHOOD_MAX_LEN,
    );
    const nextLat = typeof patch.lat === "number" ? patch.lat : Number(prop.lat);
    const nextLng = typeof patch.lng === "number" ? patch.lng : Number(prop.lng);
    if (patch.lat != null || patch.lng != null) {
      if (!validLatLng(nextLat, nextLng)) {
        res.status(400).json({ error: "invalid_geo" });
        return;
      }
    }
    const nextWaRaw =
      typeof patch.contactWhatsApp === "string" ? patch.contactWhatsApp : String(prop.contact_whatsapp);
    const nextWaDigits = normalizeWhatsAppDigits(nextWaRaw);
    if (nextWaDigits == null) {
      res.status(400).json({ error: "invalid_whatsapp" });
      return;
    }
    const nextWa = nextWaDigits;
    const nextPk = patch.propertyKind != null ? optPropertyKind(patch.propertyKind) : optPropertyKind(prop.property_kind);

    if (!nextTitle || !nextHood) {
      res.status(400).json({ error: "invalid_body", message: "Title and neighborhood cannot be empty." });
      return;
    }

    const nextStatus = patch.status != null ? (patch.status as ListingStatus) : curStatus;

    if (patch.status === "published" && curStatus === "draft") {
      const cnt = (
        db.prepare("SELECT COUNT(*) AS c FROM rooms WHERE property_id = ?").get(propertyId) as {
          c: number;
        }
      ).c;
      if (cnt < 1) {
        res.status(400).json({
          error: "rooms_required",
          message: "Add at least one room before publishing this property.",
        });
        return;
      }
    }

    db.prepare(
      `UPDATE properties SET
        status = ?,
        title = ?, summary = ?, neighborhood = ?, lat = ?, lng = ?,
        contact_whatsapp = ?, property_kind = ?
      WHERE id = ?`,
    ).run(
      nextStatus,
      nextTitle,
      nextSummary,
      nextHood,
      nextLat,
      nextLng,
      nextWa,
      nextPk ?? null,
      propertyId,
    );

    if (patch.status === "published" && curStatus === "draft") {
      db.prepare(`UPDATE rooms SET status = 'published' WHERE property_id = ? AND status = 'draft'`).run(
        propertyId,
      );
    }

    if (patch.status === "paused" || patch.status === "archived") {
      const rStatus = patch.status === "archived" ? "archived" : "paused";
      db.prepare("UPDATE rooms SET status = ? WHERE property_id = ? AND status != 'archived'").run(
        rStatus,
        propertyId,
      );
    }
    if (patch.status === "published" && curStatus === "paused") {
      db.prepare("UPDATE rooms SET status = 'published' WHERE property_id = ? AND status = 'paused'").run(
        propertyId,
      );
    }

    const updated = db.prepare("SELECT * FROM properties WHERE id = ?").get(propertyId) as Record<string, unknown>;
    res.json(rowToProperty(updated));
  });

  return r;
}

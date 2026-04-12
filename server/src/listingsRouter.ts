import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import express, { type Request, type Response } from "express";
import { joinRowToPropertyListing, ROOM_PROPERTY_JOIN_SQL } from "./listingDto.js";
import { createSlidingWindowLimiter } from "./rateLimit.js";
import { filterListings, parseFilters } from "./searchFilters.js";
import { getOrCreatePublisherId, readPublisherIdFromRequest } from "./session.js";
import {
  CITY_MAX_LEN,
  clampAge,
  clampBathrooms,
  clampBedroomsTotal,
  clampDepositMxn,
  clampRentMxn,
  clampRoomsAvailable,
  clampStr,
  isSafeRoomOrListingId,
  minimalPropertySummaryOk,
  NEIGHBORHOOD_MAX_LEN,
  normalizeWhatsAppDigits,
  PROPERTY_SUMMARY_MIN_LEN,
  SUMMARY_MAX_LEN,
  TITLE_MAX_LEN,
  validLatLng,
  clampListingImageUrls,
} from "./validation.js";
import type {
  ListingStatus,
  ListingTag,
  LodgingType,
  PropertyKind,
  PropertyListing,
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

function isRoommateGenderPref(s: string): s is RoommateGenderPref {
  return s === "any" || s === "female" || s === "male";
}

function isListingStatus(s: string): s is ListingStatus {
  return s === "draft" || s === "published" || s === "paused" || s === "archived";
}

function listingForPublic(l: PropertyListing): PropertyListing {
  const { publisherId: _p, ...rest } = l;
  return rest;
}

function rateLimitKey(req: Request): string {
  const ip = req.ip ?? "unknown";
  const fp = (req.get("x-device-fingerprint") ?? "").trim().slice(0, 64);
  return `${ip}|${fp}`;
}

function parsePostListingsLimit(): { windowMs: number; max: number } {
  const windowMs = Number(process.env.RATE_LIMIT_POST_LISTINGS_WINDOW_MS);
  const max = Number(process.env.RATE_LIMIT_POST_LISTINGS_MAX);
  return {
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 3_600_000,
    max: Number.isFinite(max) && max > 0 ? max : 30,
  };
}

const postListingLimiter = createSlidingWindowLimiter(parsePostListingsLimit());

function canTransitionStatus(from: ListingStatus, to: ListingStatus): boolean {
  if (from === to) return true;
  if (from === "draft") return to === "published";
  if (from === "published") return to === "paused" || to === "archived";
  if (from === "paused") return to === "published" || to === "archived";
  return false;
}

const PUBLISHED_JOIN_WHERE = ` WHERE r.status = 'published' AND p.status = 'published' `;

export function listingsRouter(db: DatabaseSync) {
  const r = express.Router();
  const jsonMw = express.json({ limit: "512kb" });

  r.get("/", (req: Request, res: Response) => {
    const mark = req.originalUrl.indexOf("?");
    const qs = mark >= 0 ? req.originalUrl.slice(mark + 1) : "";
    const filters = parseFilters(new URLSearchParams(qs));
    const sql = `${ROOM_PROPERTY_JOIN_SQL} ${PUBLISHED_JOIN_WHERE} ORDER BY r.rent_mxn ASC, r.id ASC`;
    const rows = db.prepare(sql).all() as Record<string, unknown>[];
    const all = rows.map(joinRowToPropertyListing).map(listingForPublic);
    res.json(filterListings(all, filters));
  });

  r.get("/:id", (req: Request, res: Response) => {
    if (!isSafeRoomOrListingId(req.params.id)) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const publisherId = readPublisherIdFromRequest(req);
    const row = publisherId
      ? (db
          .prepare(
            `${ROOM_PROPERTY_JOIN_SQL}
             WHERE r.id = ? AND p.publisher_id = ?`,
          )
          .get(req.params.id, publisherId) as Record<string, unknown> | undefined)
      : (db
          .prepare(`${ROOM_PROPERTY_JOIN_SQL} ${PUBLISHED_JOIN_WHERE} AND r.id = ?`)
          .get(req.params.id) as Record<string, unknown> | undefined);
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(listingForPublic(joinRowToPropertyListing(row)));
  });

  r.post("/", jsonMw, (req: Request, res: Response) => {
    const lim = postListingLimiter(rateLimitKey(req));
    if (!lim.ok) {
      const retryAfterSec = Math.ceil(lim.retryAfterMs / 1000);
      res
        .status(429)
        .type("json")
        .set("Retry-After", String(retryAfterSec))
        .json({
          error: "rate_limited",
          message: "Too many listing publishes from this device or network. Try again later.",
          retryAfterSec,
        });
      return;
    }

    const body = req.body as Partial<PropertyListing> & { id?: string };
    if (
      typeof body.title !== "string" ||
      typeof body.city !== "string" ||
      typeof body.neighborhood !== "string" ||
      typeof body.lat !== "number" ||
      typeof body.lng !== "number" ||
      typeof body.rentMxn !== "number" ||
      typeof body.roomsAvailable !== "number" ||
      !Array.isArray(body.tags) ||
      typeof body.roommateGenderPref !== "string" ||
      typeof body.ageMin !== "number" ||
      typeof body.ageMax !== "number" ||
      typeof body.summary !== "string" ||
      typeof body.contactWhatsApp !== "string"
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

    const contactDigits = normalizeWhatsAppDigits(body.contactWhatsApp);
    if (contactDigits == null) {
      res.status(400).json({ error: "invalid_whatsapp", message: "WhatsApp must be 10–15 digits." });
      return;
    }
    if (!validLatLng(body.lat, body.lng)) {
      res.status(400).json({ error: "invalid_geo" });
      return;
    }
    const title = clampStr(body.title, TITLE_MAX_LEN);
    const city = clampStr(body.city, CITY_MAX_LEN);
    const neighborhood = clampStr(body.neighborhood, NEIGHBORHOOD_MAX_LEN);
    const summary = clampStr(body.summary, SUMMARY_MAX_LEN);
    if (!title || !city || !neighborhood || !summary) {
      res.status(400).json({ error: "invalid_body", message: "Title, city, neighborhood, and summary are required." });
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

    const rawStatus =
      typeof body.status === "string" && isListingStatus(body.status) ? body.status : "published";
    const status: ListingStatus =
      rawStatus === "draft" || rawStatus === "published" ? rawStatus : "published";

    if (status === "published" && !minimalPropertySummaryOk(summary)) {
      res.status(400).json({
        error: "invalid_body",
        message: `Property summary must be at least ${PROPERTY_SUMMARY_MIN_LEN} characters.`,
      });
      return;
    }

    const publisherId = getOrCreatePublisherId(req, res);
    const roomIdRaw = typeof body.id === "string" && body.id.trim() ? body.id.trim() : randomUUID();
    const roomId = isSafeRoomOrListingId(roomIdRaw) ? roomIdRaw : randomUUID();
    const propertyId = `prp__${randomUUID()}`;

    const lodgingType = optLodging(body.lodgingType);
    const propertyKind = optPropertyKind(body.propertyKind);
    const availableFrom = optIsoDate(body.availableFrom);
    const minimalStayMonths = optPositiveInt(body.minimalStayMonths);
    const roomDimension = optDim(body.roomDimension);
    const avalRequired = optBool(body.avalRequired);
    const subletAllowed = optBool(body.subletAllowed);

    const bedTotal = clampBedroomsTotal(Number((body as { bedroomsTotal?: unknown }).bedroomsTotal ?? 1));
    const bathTotal = clampBathrooms(Number((body as { bathrooms?: unknown }).bathrooms ?? 1));
    const showWa = (body as { showWhatsApp?: unknown }).showWhatsApp;
    const showWhatsappInt = showWa === false ? 0 : 1;
    const depositMxn = clampDepositMxn(Number((body as { depositMxn?: unknown }).depositMxn ?? 0));
    const propImagesJson = JSON.stringify(
      clampListingImageUrls((body as { propertyImageUrls?: unknown }).propertyImageUrls),
    );
    const roomImagesJson = JSON.stringify(
      clampListingImageUrls((body as { roomImageUrls?: unknown }).roomImageUrls),
    );

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
        aval_required, sublet_allowed, sort_order, deposit_mxn, image_urls_json
      ) VALUES (
        @id, @propertyId, @status, @title, @rentMxn, @roomsAvailable, @tagsJson, @roommateGenderPref,
        @ageMin, @ageMax, @summary, @lodgingType, @availableFrom, @minimalStayMonths, @roomDimension,
        @avalRequired, @subletAllowed, 0, @depositMxn, @imageUrlsJson
      )
    `);

    try {
      db.exec("BEGIN IMMEDIATE;");
      insertProp.run({
        id: propertyId,
        publisherId,
        status,
        title,
        city,
        neighborhood,
        lat: body.lat,
        lng: body.lng,
        summary,
        contactWhatsApp: contactDigits,
        propertyKind: propertyKind ?? null,
        bedroomsTotal: bedTotal,
        bathrooms: bathTotal,
        showWhatsapp: showWhatsappInt,
        imageUrlsJson: propImagesJson,
      });
      insertRoom.run({
        id: roomId,
        propertyId,
        status,
        title,
        rentMxn,
        roomsAvailable,
        tagsJson: JSON.stringify(tags),
        roommateGenderPref: body.roommateGenderPref,
        ageMin,
        ageMax,
        summary,
        lodgingType: lodgingType ?? null,
        availableFrom: availableFrom ?? null,
        minimalStayMonths: minimalStayMonths ?? null,
        roomDimension: roomDimension ?? null,
        avalRequired: avalRequired === true ? 1 : avalRequired === false ? 0 : null,
        subletAllowed: subletAllowed === true ? 1 : subletAllowed === false ? 0 : null,
        depositMxn,
        imageUrlsJson: roomImagesJson,
      });
      db.exec("COMMIT;");
    } catch {
      db.exec("ROLLBACK;");
      res.status(409).json({ error: "conflict" });
      return;
    }

    const created = db
      .prepare(`${ROOM_PROPERTY_JOIN_SQL} WHERE r.id = ?`)
      .get(roomId) as Record<string, unknown>;
    res.status(201).json(listingForPublic(joinRowToPropertyListing(created)));
  });

  r.patch("/:id", jsonMw, (req: Request, res: Response) => {
    if (!isSafeRoomOrListingId(req.params.id)) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const publisherId = readPublisherIdFromRequest(req);
    if (!publisherId) {
      res.status(401).json({ error: "publisher_session_required", message: "Missing publisher session cookie." });
      return;
    }

    const row = db
      .prepare(
        `${ROOM_PROPERTY_JOIN_SQL}
         WHERE r.id = ? AND p.publisher_id = ?`,
      )
      .get(req.params.id, publisherId) as Record<string, unknown> | undefined;
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const listing = joinRowToPropertyListing(row);
    const patch = req.body as { status?: unknown };
    if (typeof patch.status !== "string" || !isListingStatus(patch.status)) {
      res.status(400).json({ error: "invalid_body", message: "Expected { status } with a valid status value." });
      return;
    }

    const next = patch.status;
    if (!canTransitionStatus(listing.status, next)) {
      res.status(400).json({
        error: "invalid_transition",
        message: `Cannot change status from ${listing.status} to ${next}.`,
      });
      return;
    }

    if (next === "published") {
      const propStatus = String(row.property_status ?? "");
      if (propStatus !== "published") {
        res.status(400).json({
          error: "property_not_published",
          message: "Publish the property before publishing this room.",
        });
        return;
      }
    }

    db.prepare("UPDATE rooms SET status = ? WHERE id = ?").run(next, listing.id);
    const updated = db.prepare(`${ROOM_PROPERTY_JOIN_SQL} WHERE r.id = ?`).get(listing.id) as Record<string, unknown>;
    res.json(listingForPublic(joinRowToPropertyListing(updated)));
  });

  return r;
}

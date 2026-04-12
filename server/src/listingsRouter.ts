import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import express, { type Request, type Response } from "express";
import { rowToListing } from "./db.js";
import { createSlidingWindowLimiter } from "./rateLimit.js";
import { filterListings, parseFilters } from "./searchFilters.js";
import { getOrCreatePublisherId, readPublisherIdFromRequest } from "./session.js";
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

export function listingsRouter(db: DatabaseSync) {
  const r = express.Router();
  const jsonMw = express.json({ limit: "256kb" });

  r.get("/", (req: Request, res: Response) => {
    const mark = req.originalUrl.indexOf("?");
    const qs = mark >= 0 ? req.originalUrl.slice(mark + 1) : "";
    const filters = parseFilters(new URLSearchParams(qs));
    const rows = db
      .prepare("SELECT * FROM listings WHERE status = ? ORDER BY rent_mxn ASC")
      .all("published") as Record<string, unknown>[];
    const all = rows.map(rowToListing).map(listingForPublic);
    res.json(filterListings(all, filters));
  });

  r.get("/:id", (req: Request, res: Response) => {
    const row = db
      .prepare("SELECT * FROM listings WHERE id = ? AND status = ?")
      .get(req.params.id, "published") as Record<string, unknown> | undefined;
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(listingForPublic(rowToListing(row)));
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

    const rawStatus =
      typeof body.status === "string" && isListingStatus(body.status) ? body.status : "published";
    const status: ListingStatus =
      rawStatus === "draft" || rawStatus === "published" ? rawStatus : "published";

    const publisherId = getOrCreatePublisherId(req, res);
    const id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : randomUUID();

    const lodgingType = optLodging(body.lodgingType);
    const propertyKind = optPropertyKind(body.propertyKind);
    const availableFrom = optIsoDate(body.availableFrom);
    const minimalStayMonths = optPositiveInt(body.minimalStayMonths);
    const roomDimension = optDim(body.roomDimension);
    const avalRequired = optBool(body.avalRequired);
    const subletAllowed = optBool(body.subletAllowed);

    try {
      db.prepare(
        `INSERT INTO listings (
          id, title, city, neighborhood, lat, lng, rent_mxn, rooms_available,
          tags_json, roommate_gender_pref, age_min, age_max, summary, contact_whatsapp,
          publisher_id, status,
          lodging_type, property_kind, available_from, minimal_stay_months, room_dimension,
          aval_required, sublet_allowed
        ) VALUES (
          @id, @title, @city, @neighborhood, @lat, @lng, @rentMxn, @roomsAvailable,
          @tagsJson, @roommateGenderPref, @ageMin, @ageMax, @summary, @contactWhatsApp,
          @publisherId, @status,
          @lodgingType, @propertyKind, @availableFrom, @minimalStayMonths, @roomDimension,
          @avalRequired, @subletAllowed
        )`,
      ).run({
        id,
        title: body.title,
        city: body.city,
        neighborhood: body.neighborhood,
        lat: body.lat,
        lng: body.lng,
        rentMxn: body.rentMxn,
        roomsAvailable: body.roomsAvailable,
        tagsJson: JSON.stringify(tags),
        roommateGenderPref: body.roommateGenderPref,
        ageMin: body.ageMin,
        ageMax: body.ageMax,
        summary: body.summary,
        contactWhatsApp: body.contactWhatsApp,
        publisherId,
        status,
        lodgingType: lodgingType ?? null,
        propertyKind: propertyKind ?? null,
        availableFrom: availableFrom ?? null,
        minimalStayMonths: minimalStayMonths ?? null,
        roomDimension: roomDimension ?? null,
        avalRequired: avalRequired === true ? 1 : avalRequired === false ? 0 : null,
        subletAllowed: subletAllowed === true ? 1 : subletAllowed === false ? 0 : null,
      });
    } catch {
      res.status(409).json({ error: "conflict" });
      return;
    }

    const created = db.prepare("SELECT * FROM listings WHERE id = ?").get(id) as Record<string, unknown>;
    res.status(201).json(listingForPublic(rowToListing(created)));
  });

  r.patch("/:id", jsonMw, (req: Request, res: Response) => {
    const publisherId = readPublisherIdFromRequest(req);
    if (!publisherId) {
      res.status(401).json({ error: "publisher_session_required", message: "Missing publisher session cookie." });
      return;
    }

    const row = db.prepare("SELECT * FROM listings WHERE id = ?").get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const listing = rowToListing(row);
    if (listing.publisherId !== publisherId) {
      res.status(403).json({ error: "forbidden", message: "You can only update your own listings." });
      return;
    }

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

    db.prepare("UPDATE listings SET status = ? WHERE id = ?").run(next, listing.id);
    const updated = db.prepare("SELECT * FROM listings WHERE id = ?").get(listing.id) as Record<string, unknown>;
    res.json(rowToListing(updated));
  });

  return r;
}

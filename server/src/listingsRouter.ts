import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import express, { type Request, type Response } from "express";
import { rowToListing } from "./db.js";
import { filterListings, parseFilters } from "./searchFilters.js";
import type { ListingTag, PropertyListing, RoommateGenderPref } from "./types.js";

function isListingTag(t: string): t is ListingTag {
  return (
    t === "wifi" ||
    t === "mascotas" ||
    t === "estacionamiento" ||
    t === "muebles" ||
    t === "baño-privado"
  );
}

function isRoommateGenderPref(s: string): s is RoommateGenderPref {
  return s === "any" || s === "female" || s === "male";
}

export function listingsRouter(db: DatabaseSync) {
  const r = express.Router();

  r.get("/", (req: Request, res: Response) => {
    const mark = req.originalUrl.indexOf("?");
    const qs = mark >= 0 ? req.originalUrl.slice(mark + 1) : "";
    const filters = parseFilters(new URLSearchParams(qs));
    const rows = db
      .prepare("SELECT * FROM listings WHERE status = ? ORDER BY rent_mxn ASC")
      .all("published") as Record<string, unknown>[];
    const all = rows.map(rowToListing);
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
    res.json(rowToListing(row));
  });

  r.post("/", express.json({ limit: "256kb" }), (req: Request, res: Response) => {
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

    const id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : randomUUID();

    try {
      db.prepare(
        `INSERT INTO listings (
          id, title, city, neighborhood, lat, lng, rent_mxn, rooms_available,
          tags_json, roommate_gender_pref, age_min, age_max, summary, contact_whatsapp, status
        ) VALUES (
          @id, @title, @city, @neighborhood, @lat, @lng, @rentMxn, @roomsAvailable,
          @tagsJson, @roommateGenderPref, @ageMin, @ageMax, @summary, @contactWhatsApp, 'published'
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
      });
    } catch {
      res.status(409).json({ error: "conflict" });
      return;
    }

    const created = db
      .prepare("SELECT * FROM listings WHERE id = ?")
      .get(id) as Record<string, unknown>;
    res.status(201).json(rowToListing(created));
  });

  return r;
}

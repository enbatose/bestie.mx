import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import express, { type NextFunction, type Request, type Response } from "express";
import { readAuthUserId } from "./jwtSession.js";
import { isAdminUser } from "./adminAuth.js";
import { issuePublisherCookie } from "./session.js";
import { extractListingDataWithGemini, type ExtractionInput, type AssistedDraftExtraction } from "./assistedDraftGemini.js";
import { extForUploadMime, normalizeDeclaredImageMime } from "./imageMime.js";
import { publicWebOrigin } from "./handoffTokens.js";

const CLAIM_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

type AssistedDraftClaimRow = {
  token: string;
  property_id: string;
  created_by_admin_id: string;
  orphan_publisher_id: string;
  expires_at: number;
  activated_at: number | null;
  claimed_by_user_id: string | null;
  claimed_at: number | null;
  created_at: number;
};

type PropertyRow = {
  id: string;
  publisher_id: string;
  status: string;
  title: string;
  city: string;
  neighborhood: string;
  lat: number;
  lng: number;
  summary: string;
  post_mode: string;
  property_kind: string | null;
  bedrooms_total: number;
  bathrooms: number;
  show_whatsapp: number;
  image_urls_json: string;
  is_approximate_location: number;
  approximate_radius_m: number | null;
  assisted_draft: number;
  created_by_admin_id: string | null;
};

/** Save a base64-encoded image to the uploads directory and return the URL path. */
function saveBase64Image(
  data: string,
  mimeType: string,
  uploadDir: string,
): string | null {
  try {
    const buf = Buffer.from(data, "base64");
    if (buf.byteLength > IMAGE_MAX_BYTES) return null;
    const normalized = normalizeDeclaredImageMime(mimeType) ?? "image/jpeg";
    const ext = extForUploadMime(normalized);
    const name = `${randomUUID()}${ext}`;
    const dest = path.join(uploadDir, name);
    fs.writeFileSync(dest, buf);
    return `/api/uploads/${name}`;
  } catch {
    return null;
  }
}

export function assistedDraftRouter(db: DatabaseSync, uploadDir: string) {
  const r = express.Router();
  const resolvedUploadDir = path.resolve(uploadDir);
  fs.mkdirSync(resolvedUploadDir, { recursive: true });

  function requireAdmin(req: Request, res: Response, next: NextFunction): void {
    const uid = readAuthUserId(req);
    if (!uid) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!isAdminUser(db, uid)) { res.status(403).json({ error: "forbidden" }); return; }
    next();
  }

  // ── Admin: AI extraction ──────────────────────────────────────────────────
  r.post(
    "/admin/extract",
    requireAdmin,
    express.json({ limit: "30mb" }),
    (req: Request, res: Response): void => {
      void (async () => {
        try {
          const body = req.body as {
            text?: string;
            images?: Array<{ mimeType: string; data: string }>;
            city?: string;
          };
          const input: ExtractionInput = {
            text: typeof body.text === "string" ? body.text : undefined,
            images: Array.isArray(body.images) ? body.images : undefined,
            city: typeof body.city === "string" ? body.city : "Guadalajara",
          };
          const result = await extractListingDataWithGemini(input);
          res.json({ ok: true, extraction: result });
        } catch (err) {
          console.error("[assisted-draft] extract error", err);
          res.status(500).json({ error: "extraction_failed" });
        }
      })();
    },
  );

  // ── Admin: create assisted draft + claim token ────────────────────────────
  r.post(
    "/admin/create",
    requireAdmin,
    express.json({ limit: "30mb" }),
    (req: Request, res: Response): void => {
      const adminId = readAuthUserId(req)!;
      const body = req.body as {
        city?: string;
        extraction?: AssistedDraftExtraction;
        photos?: Array<{ mimeType: string; data: string }>;
        infographicPhotos?: Array<{ mimeType: string; data: string }>;
      };

      const city = typeof body.city === "string" && body.city.trim() ? body.city.trim() : "Guadalajara";
      const ext = body.extraction ?? {};

      // Upload photos
      const photoUrls: string[] = [];
      const allPhotoInputs = [
        ...(body.photos ?? []),
        ...(body.infographicPhotos ?? []),
      ];
      for (const img of allPhotoInputs) {
        const url = saveBase64Image(img.data, img.mimeType, resolvedUploadDir);
        if (url) photoUrls.push(url);
      }

      // Determine location
      const loc = ext.location;
      let lat = 20.675_138;
      let lng = -103.347_345;
      let isApproximate = 1;
      let approximateRadius: number | null = 200;

      if (loc?.type === "precise" && loc.lat != null && loc.lng != null) {
        lat = loc.lat;
        lng = loc.lng;
        isApproximate = 0;
        approximateRadius = null;
      } else if (loc?.type === "approximate" && loc.lat != null && loc.lng != null) {
        lat = loc.lat;
        lng = loc.lng;
        isApproximate = 1;
        approximateRadius = loc.radiusMeters ?? 500;
      }
      // type === "none" → keep city anchor, mark approximate with 1km radius
      if (loc?.type === "none") {
        approximateRadius = 1000;
      }

      // Build property fields
      const propertyId = `prp__adraft_${randomUUID().replace(/-/g, "")}`;
      const roomId = `adraft_room__${randomUUID().replace(/-/g, "")}`;
      const orphanPublisherId = randomUUID();
      const now = new Date().toISOString();

      const title = ext.propertyTitle ?? "";
      const neighborhood = ext.neighborhood ?? "";
      const summary = "";
      const propertyKind = ext.propertyKind ?? null;

      // Assign all images to property for room-mode posts
      const imageUrlsJson = JSON.stringify(photoUrls);

      db.prepare(`
        INSERT INTO properties (
          id, publisher_id, status, post_mode, title, city, neighborhood,
          lat, lng, summary, contact_whatsapp, property_kind,
          bedrooms_total, bathrooms, show_whatsapp, image_urls_json,
          is_approximate_location, approximate_radius_m,
          created_at, assisted_draft, created_by_admin_id
        ) VALUES (
          @id, @publisherId, 'draft', 'room', @title, @city, @neighborhood,
          @lat, @lng, @summary, '', @propertyKind,
          1, 1, 0, @imageUrlsJson,
          @isApproximate, @approximateRadius,
          @createdAt, 1, @adminId
        )
      `).run({
        id: propertyId,
        publisherId: orphanPublisherId,
        title,
        city,
        neighborhood,
        lat,
        lng,
        summary,
        propertyKind,
        imageUrlsJson,
        isApproximate,
        approximateRadius,
        createdAt: now,
        adminId,
      });

      // Room-level fields
      const rentMxn = ext.rentMxn ?? 0;
      const depositMxn = ext.depositMxn ?? 0;
      const roommateGenderPref = ext.roommateGenderPref ?? "any";
      const ageMin = ext.ageMin ?? 18;
      const ageMax = ext.ageMax ?? 99;
      const lodgingType = ext.lodgingType ?? "private_room";
      const availableFrom = ext.availableFrom ?? now.slice(0, 10);
      const minimalStayMonths = ext.minimalStayMonths ?? 1;
      const roomDimension = ext.roomDimension ?? "medium";
      const roomSummary = ext.roomSummary ?? "";
      const tags = ext.tags ?? [];
      const tagsJson = JSON.stringify(tags);

      db.prepare(`
        INSERT INTO rooms (
          id, property_id, status, title, rent_mxn, rooms_available, tags_json,
          roommate_gender_pref, age_min, age_max, summary, lodging_type,
          available_from, minimal_stay_months, room_dimension,
          aval_required, sublet_allowed, sort_order, deposit_mxn,
          image_urls_json, created_at, updated_at
        ) VALUES (
          @id, @propertyId, 'draft', '', @rentMxn, 1, @tagsJson,
          @roommateGenderPref, @ageMin, @ageMax, @roomSummary, @lodgingType,
          @availableFrom, @minimalStayMonths, @roomDimension,
          0, 0, 0, @depositMxn,
          '[]', @now, @now
        )
      `).run({
        id: roomId,
        propertyId,
        rentMxn,
        tagsJson,
        roommateGenderPref,
        ageMin,
        ageMax,
        roomSummary,
        lodgingType,
        availableFrom,
        minimalStayMonths,
        roomDimension,
        depositMxn,
        now,
      });

      // Create claim token
      const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 8);
      const expiresAt = Date.now() + CLAIM_TOKEN_TTL_MS;

      db.prepare(`
        INSERT INTO assisted_draft_claim_tokens (
          token, property_id, created_by_admin_id, orphan_publisher_id,
          expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(token, propertyId, adminId, orphanPublisherId, expiresAt, Date.now());

      const claimUrl = `${publicWebOrigin()}/borrador/${token}`;

      res.status(201).json({ ok: true, propertyId, roomId, claimUrl, token });
    },
  );

  // ── Public: get draft info by claim token ─────────────────────────────────
  r.get("/claim/:token", (req: Request, res: Response): void => {
    const token = String(req.params.token ?? "").trim();
    if (!token) { res.status(400).json({ error: "bad_token" }); return; }

    const row = db.prepare(
      `SELECT * FROM assisted_draft_claim_tokens WHERE token = ?`
    ).get(token) as AssistedDraftClaimRow | undefined;

    if (!row) { res.status(404).json({ error: "not_found" }); return; }
    if (Date.now() > row.expires_at) { res.status(410).json({ error: "expired" }); return; }

    const prop = db.prepare(
      `SELECT * FROM properties WHERE id = ?`
    ).get(row.property_id) as PropertyRow | undefined;

    if (!prop) { res.status(404).json({ error: "property_not_found" }); return; }

    const rooms = db.prepare(
      `SELECT * FROM rooms WHERE property_id = ? ORDER BY sort_order`
    ).all(row.property_id) as Record<string, unknown>[];

    const isClaimed = row.claimed_by_user_id != null;

    res.json({
      ok: true,
      isClaimed,
      propertyId: prop.id,
      property: {
        id: prop.id,
        publisherId: prop.publisher_id,
        status: prop.status,
        postMode: prop.post_mode,
        title: prop.title,
        city: prop.city,
        neighborhood: prop.neighborhood,
        lat: prop.lat,
        lng: prop.lng,
        summary: prop.summary,
        propertyKind: prop.property_kind,
        bedroomsTotal: prop.bedrooms_total,
        bathrooms: prop.bathrooms,
        showWhatsApp: prop.show_whatsapp === 1,
        imageUrls: JSON.parse(prop.image_urls_json || "[]") as string[],
        isApproximateLocation: prop.is_approximate_location === 1,
        approximateRadiusMeters: prop.approximate_radius_m ?? undefined,
      },
      rooms: rooms.map((r) => ({
        id: r.id,
        title: r.title,
        rentMxn: r.rent_mxn,
        depositMxn: r.deposit_mxn,
        roommateGenderPref: r.roommate_gender_pref,
        ageMin: r.age_min,
        ageMax: r.age_max,
        summary: r.summary,
        lodgingType: r.lodging_type,
        availableFrom: r.available_from,
        minimalStayMonths: r.minimal_stay_months,
        roomDimension: r.room_dimension,
        tags: JSON.parse(typeof r.tags_json === "string" ? r.tags_json : "[]") as string[],
        imageUrls: JSON.parse(typeof r.image_urls_json === "string" ? r.image_urls_json : "[]") as string[],
      })),
    });
  });

  // ── Public: activate claim token (sets orphan publisher cookie) ────────────
  r.post(
    "/claim/:token/activate",
    express.json({ limit: "4kb" }),
    (req: Request, res: Response): void => {
      const token = String(req.params.token ?? "").trim();
      if (!token) { res.status(400).json({ error: "bad_token" }); return; }

      const row = db.prepare(
        `SELECT * FROM assisted_draft_claim_tokens WHERE token = ?`
      ).get(token) as AssistedDraftClaimRow | undefined;

      if (!row) { res.status(404).json({ error: "not_found" }); return; }
      if (Date.now() > row.expires_at) { res.status(410).json({ error: "expired" }); return; }
      if (row.claimed_by_user_id != null) {
        res.status(409).json({ error: "already_claimed" }); return;
      }

      // Set the orphan publisher cookie so the user can edit as that publisher
      issuePublisherCookie(res, row.orphan_publisher_id);

      db.prepare(
        `UPDATE assisted_draft_claim_tokens SET activated_at = ? WHERE token = ? AND activated_at IS NULL`
      ).run(Date.now(), token);

      res.json({ ok: true, propertyId: row.property_id, publisherId: row.orphan_publisher_id });
    },
  );

  // ── Auth-gated: claim + publish ──────────────────────────────────────────
  r.post(
    "/claim/:token/publish",
    express.json({ limit: "4kb" }),
    (req: Request, res: Response): void => {
      const token = String(req.params.token ?? "").trim();
      const userId = readAuthUserId(req);
      if (!userId) { res.status(401).json({ error: "unauthorized" }); return; }
      if (!token) { res.status(400).json({ error: "bad_token" }); return; }

      const row = db.prepare(
        `SELECT * FROM assisted_draft_claim_tokens WHERE token = ?`
      ).get(token) as AssistedDraftClaimRow | undefined;

      if (!row) { res.status(404).json({ error: "not_found" }); return; }
      if (Date.now() > row.expires_at) { res.status(410).json({ error: "expired" }); return; }

      // If already claimed by this same user, idempotent OK
      if (row.claimed_by_user_id != null && row.claimed_by_user_id !== userId) {
        res.status(409).json({ error: "already_claimed_by_other" }); return;
      }

      const orphanPub = row.orphan_publisher_id;

      // Check if orphan publisher is already linked to a different user
      const existingLink = db.prepare(
        `SELECT user_id FROM user_publishers WHERE publisher_id = ?`
      ).get(orphanPub) as { user_id: string } | undefined;

      if (existingLink && existingLink.user_id !== userId) {
        res.status(409).json({ error: "publisher_taken" }); return;
      }

      const rentRows = db.prepare(
        `SELECT rent_mxn FROM rooms WHERE property_id = ?`
      ).all(row.property_id) as { rent_mxn: number }[];
      if (
        rentRows.length === 0 ||
        rentRows.some((r) => !Number.isFinite(Number(r.rent_mxn)) || Number(r.rent_mxn) <= 0)
      ) {
        res.status(400).json({ error: "rent_required" });
        return;
      }

      // Link orphan publisher to user if not already linked
      if (!existingLink) {
        db.prepare(
          `INSERT INTO user_publishers (user_id, publisher_id, created_at) VALUES (?, ?, ?)`
        ).run(userId, orphanPub, new Date().toISOString());
      }

      // Publish the property and its rooms
      const now = new Date().toISOString();
      db.prepare(
        `UPDATE properties SET status = 'published', published_at = ? WHERE id = ? AND publisher_id = ?`
      ).run(now, row.property_id, orphanPub);
      db.prepare(
        `UPDATE rooms SET status = 'published', updated_at = ? WHERE property_id = ?`
      ).run(now, row.property_id);

      // Mark token claimed
      db.prepare(
        `UPDATE assisted_draft_claim_tokens SET claimed_by_user_id = ?, claimed_at = ? WHERE token = ?`
      ).run(userId, Date.now(), token);

      // Set publisher cookie for the new owner
      issuePublisherCookie(res, orphanPub);

      res.json({ ok: true, propertyId: row.property_id });
    },
  );

  return r;
}

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { DatabaseSync } from "node:sqlite";
import express, { type NextFunction, type Request, type Response } from "express";
import { readAuthUserId } from "./jwtSession.js";
import { isAdminUser } from "./adminAuth.js";
import { issuePublisherCookie } from "./session.js";
import { extractListingDataWithGemini, type ExtractionInput, type AssistedDraftExtraction } from "./assistedDraftGemini.js";
import { recordAssistedDraftGenerate } from "./usageAnalytics.js";
import { createSlidingWindowLimiter } from "./rateLimit.js";
import {
  mergeExtractionWithHints,
  isSelfServeCreator,
  SELF_SERVE_CREATOR_ID,
  clampComposeRoomCount,
  planComposeRooms,
  COMPOSE_BEDROOMS_MAX,
  sanitizeHintsForPostMode,
  DEFAULT_LISTING_AGE_MIN,
  DEFAULT_LISTING_AGE_MAX,
  type SelfServeHints,
  type HintTagSlug,
  type PlannedComposeRoom,
} from "./assistedDraftMerge.js";
import {
  SELF_SERVE_COMPOSE_IP_MAX_PER_HOUR,
  SELF_SERVE_COMPOSE_WINDOW_MS,
  SELF_SERVE_MAX_INFOGRAPHICS,
  SELF_SERVE_MAX_PHOTOS,
  SELF_SERVE_MAX_TEXT_CHARS,
} from "./assistedDraftLimits.js";
import { claimPublishMissingRent, outreachHidePricingForMissingRent, RENT_REQUIRED_PUBLISH_MESSAGE } from "./claimPublishRent.js";
import {
  CLAIM_PUBLISHER_TAKEN_MESSAGE,
  CLAIM_ALREADY_CLAIMED_BY_OTHER_MESSAGE,
  ADMIN_OUTREACH_EVIDENCE_REQUIRED_MESSAGE,
  claimWriteBlock,
} from "./assistedDraftClaimAccess.js";
import { resolveClaimSaveRoomTargets } from "./claimSaveRoomMatch.js";
import { extForUploadMime, normalizeDeclaredImageMime } from "./imageMime.js";
import { publicWebOrigin } from "./handoffTokens.js";
import { roomReferenceCode } from "./listingReference.js";
import {
  assignOutreachPostsForVerifiedPhone,
  claimAssistedDraftForUser,
  evaluateOutreachClaimGate,
  findUserIdByVerifiedPhone,
  isRealListingPhone,
  isUnclaimedAdminOutreach,
  listingPhoneToE164,
  setUserPhoneVerified,
} from "./phoneAuth.js";
import { verifyPhoneOtp, requestPhoneOtp } from "./phoneOtp.js";
import { isListingTag } from "./listingTags.js";
import {
  clampAge,
  clampApproximateRadiusMeters,
  clampBathrooms,
  clampBedroomsTotal,
  clampDepositMxn,
  clampListingImageUrls,
  clampRentMxn,
  clampStr,
  NEIGHBORHOOD_MAX_LEN,
  ROOM_TITLE_MAX_LEN,
  SUMMARY_MAX_LEN,
  TITLE_MAX_LEN,
  isSafeRoomOrListingId,
  storedContactWhatsApp,
  validLatLng,
} from "./validation.js";

import {
  ADMIN_OUTREACH_CLAIM_TTL_MS,
  SELF_SERVE_CLAIM_TTL_MS,
} from "./assistedDraftPurge.js";
import { normalizeSourceFacebookUrl } from "./facebookPostUrl.js";
import { checkOutreachDuplicates } from "./outreachDuplicateCheck.js";

const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const CLAIM_SAVE_OCCUPANT_MAX = 50;

/** Match frontend CITY_ANCHOR.Guadalajara so a city-center pin is a real map pin. */
const GDL_CITY_ANCHOR = { lat: 20.674_39, lng: -103.387_39 };

const HINT_TAG_SET = new Set<HintTagSlug>([
  "mascotas",
  "lgbt-friendly",
  "baño-privado",
  "estacionamiento",
  "muebles",
]);

function composeRateLimitKey(req: Request): string {
  const ip = req.ip ?? "unknown";
  const fp = (req.get("x-device-fingerprint") ?? "").trim().slice(0, 64);
  return `${ip}|${fp}`;
}

type ImageInput = { mimeType?: string; data?: string; url?: string };

function parseHints(raw: unknown): SelfServeHints {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const lodging =
    o.lodgingType === "private_room" || o.lodgingType === "shared_room" ? o.lodgingType : null;
  const gender = o.gender === "female" || o.gender === "male" ? o.gender : null;
  const tagsOn = Array.isArray(o.tagsOn)
    ? o.tagsOn.filter((t): t is HintTagSlug => typeof t === "string" && HINT_TAG_SET.has(t as HintTagSlug))
    : [];
  return {
    lodgingType: lodging,
    loft: o.loft === true,
    tagsOn,
    gender,
    roomsForRent: typeof o.roomsForRent === "number" ? clampComposeRoomCount(o.roomsForRent, 1) : null,
    roomsOccupied: typeof o.roomsOccupied === "number" ? clampComposeRoomCount(o.roomsOccupied, 0) : null,
  };
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function occupantCountOrNull(value: unknown): number | null {
  const n = asFiniteNumber(value);
  if (n == null) return null;
  return Math.max(0, Math.min(CLAIM_SAVE_OCCUPANT_MAX, Math.floor(n)));
}

function inventoryFromHints(postMode: "room" | "property", hints: SelfServeHints): {
  roomsForRent: number;
  roomsOccupied: number;
} {
  if (postMode !== "property") return { roomsForRent: 1, roomsOccupied: 0 };
  let roomsForRent = Math.max(1, hints.roomsForRent ?? 1);
  let roomsOccupied = Math.max(0, hints.roomsOccupied ?? 0);
  if (roomsForRent + roomsOccupied > COMPOSE_BEDROOMS_MAX) {
    if (roomsForRent >= COMPOSE_BEDROOMS_MAX) {
      roomsForRent = COMPOSE_BEDROOMS_MAX;
      roomsOccupied = 0;
    } else {
      roomsOccupied = COMPOSE_BEDROOMS_MAX - roomsForRent;
    }
  }
  return { roomsForRent, roomsOccupied };
}

function assistedDraftPhoneFields(
  extraction: AssistedDraftExtraction,
  showPublic = true,
): {
  contactWhatsApp: string;
  showWhatsApp: 0 | 1;
} {
  if (extraction.contactPhone) {
    return {
      contactWhatsApp: storedContactWhatsApp(true, extraction.contactPhone),
      showWhatsApp: showPublic ? 1 : 0,
    };
  }
  return {
    contactWhatsApp: storedContactWhatsApp(false, ""),
    showWhatsApp: 0,
  };
}

function insertPlannedComposeRoom(
  db: DatabaseSync,
  opts: {
    id: string;
    propertyId: string;
    sortOrder: number;
    planned: PlannedComposeRoom;
    imageUrlsJson: string;
    now: string;
  },
): void {
  db.prepare(`
    INSERT INTO rooms (
      id, property_id, status, title, rent_mxn, rooms_available, tags_json,
      roommate_gender_pref, age_min, age_max, summary, lodging_type,
      available_from, minimal_stay_months, room_dimension,
      aval_required, sublet_allowed, sort_order, deposit_mxn,
      occupancy_status, occupant_women_count, occupant_men_count,
      image_urls_json, created_at, updated_at
    ) VALUES (
      @id, @propertyId, 'draft', @title, @rentMxn, 1, @tagsJson,
      @roommateGenderPref, @ageMin, @ageMax, @roomSummary, @lodgingType,
      @availableFrom, @minimalStayMonths, @roomDimension,
      0, 0, @sortOrder, @depositMxn,
      @occupancyStatus, 0, 0,
      @imageUrlsJson, @now, @now
    )
  `).run({
    id: opts.id,
    propertyId: opts.propertyId,
    title: opts.planned.title,
    rentMxn: opts.planned.rentMxn,
    tagsJson: JSON.stringify(opts.planned.tags),
    roommateGenderPref: opts.planned.roommateGenderPref,
    ageMin: opts.planned.ageMin,
    ageMax: opts.planned.ageMax,
    roomSummary: opts.planned.summary,
    lodgingType: opts.planned.lodgingType,
    availableFrom: opts.planned.availableFrom,
    minimalStayMonths: opts.planned.minimalStayMonths,
    roomDimension: opts.planned.roomDimension,
    sortOrder: opts.sortOrder,
    depositMxn: opts.planned.depositMxn,
    occupancyStatus: opts.planned.occupancyStatus,
    imageUrlsJson: opts.imageUrlsJson,
    now: opts.now,
  });
}

function replaceComposeRooms(
  db: DatabaseSync,
  propertyId: string,
  planned: PlannedComposeRoom[],
  roomImageUrlsJson: string,
  now: string,
): string[] {
  db.prepare(`DELETE FROM rooms WHERE property_id = ?`).run(propertyId);
  return planned.map((room, index) => {
    const id = randomUUID();
    insertPlannedComposeRoom(db, {
      id,
      propertyId,
      sortOrder: index,
      planned: room,
      imageUrlsJson: roomImageUrlsJson,
      now,
    });
    return id;
  });
}

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
  contact_whatsapp: string;
  property_kind: string | null;
  bedrooms_total: number;
  bathrooms: number;
  show_whatsapp: number;
  hide_pricing: number;
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

function keptComposeImagePath(url: string): string | null {
  let pathname = url.trim();
  if (pathname.startsWith("http://") || pathname.startsWith("https://")) {
    try {
      pathname = new URL(pathname).pathname;
    } catch {
      return null;
    }
  }
  if (pathname.includes("..") || pathname.includes("\\")) return null;
  if (pathname.startsWith("/api/uploads/")) return pathname;
  if (/^\/admin-seed\/[A-Za-z0-9._-]+$/.test(pathname)) return pathname;
  return null;
}

function adminSeedFilePath(filename: string): string | null {
  if (!/^[A-Za-z0-9._-]+$/.test(filename)) return null;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), "../dist/admin-seed", filename),
    path.resolve(process.cwd(), "dist/admin-seed", filename),
    path.resolve(process.cwd(), "../public/admin-seed", filename),
    path.resolve(process.cwd(), "public/admin-seed", filename),
    path.resolve(here, "../../../dist/admin-seed", filename),
    path.resolve(here, "../../../public/admin-seed", filename),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** Persist `/admin-seed/…` Autopoblar photos as real uploads so preview/publish keep them. */
function materializeComposeImageUrl(url: string, uploadDir: string): string | null {
  const kept = keptComposeImagePath(url);
  if (!kept) return null;
  if (kept.startsWith("/api/uploads/")) return kept;
  const filename = kept.slice("/admin-seed/".length);
  const src = adminSeedFilePath(filename);
  if (!src) return kept;
  const ext = path.extname(filename) || ".png";
  const destName = `${randomUUID()}${ext}`;
  fs.copyFileSync(src, path.join(uploadDir, destName));
  return `/api/uploads/${destName}`;
}

function resolveImageUrls(inputs: ImageInput[] | undefined, uploadDir: string, max: number): string[] {
  const urls: string[] = [];
  for (const img of inputs ?? []) {
    if (urls.length >= max) break;
    if (typeof img.url === "string") {
      const kept = materializeComposeImageUrl(img.url, uploadDir);
      if (kept?.startsWith("/api/uploads/")) {
        urls.push(kept);
        continue;
      }
    }
    if (typeof img.data === "string" && img.data.length > 0) {
      const url = saveBase64Image(img.data, img.mimeType ?? "image/jpeg", uploadDir);
      if (url) urls.push(url);
    }
  }
  return urls;
}

function locationFromExtraction(ext: AssistedDraftExtraction): {
  lat: number;
  lng: number;
  isApproximate: number;
  approximateRadius: number | null;
} {
  const loc = ext.location;
  let lat = GDL_CITY_ANCHOR.lat;
  let lng = GDL_CITY_ANCHOR.lng;
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
  if (loc?.type === "none" || loc == null) {
    lat = GDL_CITY_ANCHOR.lat;
    lng = GDL_CITY_ANCHOR.lng;
    isApproximate = 1;
    approximateRadius = 1000;
  }
  return { lat, lng, isApproximate, approximateRadius };
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

  const composeLimiter = createSlidingWindowLimiter({
    windowMs: SELF_SERVE_COMPOSE_WINDOW_MS,
    max: SELF_SERVE_COMPOSE_IP_MAX_PER_HOUR,
  });

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
          recordAssistedDraftGenerate(result.promptTokens, result.outputTokens, result.model);
          res.json({ ok: true, extraction: result.extraction });
        } catch (err) {
          console.error("[assisted-draft] extract error", err);
          res.status(500).json({ error: "extraction_failed" });
        }
      })();
    },
  );

  // ── Admin: duplicate check (Facebook post URL + phone) ───────────────────
  r.post(
    "/admin/duplicate-check",
    requireAdmin,
    express.json({ limit: "32kb" }),
    (req: Request, res: Response): void => {
      const body = req.body as { sourceFacebookUrl?: unknown; phone?: unknown };
      const sourceFacebookUrl =
        typeof body.sourceFacebookUrl === "string" ? body.sourceFacebookUrl : "";
      const phone = typeof body.phone === "string" ? body.phone : "";
      res.json({ ok: true, ...checkOutreachDuplicates(db, { sourceFacebookUrl, phone }) });
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
        photos?: ImageInput[];
        infographicPhotos?: ImageInput[];
        photoUrls?: unknown;
        showWhatsApp?: boolean;
        sourceFacebookUrl?: string;
      };

      const city = typeof body.city === "string" && body.city.trim() ? body.city.trim() : "Guadalajara";
      const ext = body.extraction ?? {};
      const showPhone = body.showWhatsApp !== false;

      const urlInputs: ImageInput[] = [];
      if (Array.isArray(body.photoUrls)) {
        for (const raw of body.photoUrls) {
          if (typeof raw === "string" && raw.trim()) urlInputs.push({ url: raw.trim() });
        }
      }
      const photoUrls = resolveImageUrls(
        [...urlInputs, ...(body.photos ?? []), ...(body.infographicPhotos ?? [])],
        resolvedUploadDir,
        SELF_SERVE_MAX_PHOTOS + SELF_SERVE_MAX_INFOGRAPHICS,
      );

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
      const propertyId = `prp__${randomUUID()}`;
      const roomId = randomUUID();
      const orphanPublisherId = randomUUID();
      const now = new Date().toISOString();

      const title = ext.propertyTitle ?? "";
      const neighborhood = ext.neighborhood ?? "";
      const summary = "";
      const propertyKind = ext.propertyKind ?? null;
      const phone = assistedDraftPhoneFields(ext, showPhone);
      const sourceFb =
        typeof body.sourceFacebookUrl === "string" ? normalizeSourceFacebookUrl(body.sourceFacebookUrl) : null;

      // Room-mode gallery lives on the room; mirror onto the property for API/OG.
      const imageUrlsJson = JSON.stringify(photoUrls);

      // Room-level fields
      const rentMxn = ext.rentMxn ?? 0;
      const hidePricing = outreachHidePricingForMissingRent(rentMxn);
      const depositMxn = ext.depositMxn ?? 0;
      const roommateGenderPref = ext.roommateGenderPref ?? "any";
      const ageMin = ext.ageMin ?? DEFAULT_LISTING_AGE_MIN;
      const ageMax = ext.ageMax ?? DEFAULT_LISTING_AGE_MAX;
      const lodgingType = ext.lodgingType ?? "private_room";
      const availableFrom = ext.availableFrom ?? now.slice(0, 10);
      const minimalStayMonths = ext.minimalStayMonths ?? 1;
      const roomDimension = ext.roomDimension ?? "medium";
      const roomSummary = ext.roomSummary ?? "";
      const tags = ext.tags ?? [];
      const tagsJson = JSON.stringify(tags);

      db.prepare(`
        INSERT INTO properties (
          id, publisher_id, status, post_mode, title, city, neighborhood,
          lat, lng, summary, contact_whatsapp, property_kind,
          bedrooms_total, bathrooms, show_whatsapp, hide_pricing, image_urls_json,
          is_approximate_location, approximate_radius_m,
          created_at, assisted_draft, created_by_admin_id,
          source_facebook_url, source_facebook_key
        ) VALUES (
          @id, @publisherId, 'draft', 'room', @title, @city, @neighborhood,
          @lat, @lng, @summary, @contactWhatsApp, @propertyKind,
          1, 1, @showWhatsApp, @hidePricing, @imageUrlsJson,
          @isApproximate, @approximateRadius,
          @createdAt, 1, @adminId,
          @sourceFacebookUrl, @sourceFacebookKey
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
        contactWhatsApp: phone.contactWhatsApp,
        propertyKind,
        showWhatsApp: phone.showWhatsApp,
        hidePricing: hidePricing ? 1 : 0,
        imageUrlsJson,
        isApproximate,
        approximateRadius,
        createdAt: now,
        adminId,
        sourceFacebookUrl: sourceFb?.url ?? null,
        sourceFacebookKey: sourceFb?.key ?? null,
      });

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
          @imageUrlsJson, @now, @now
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
        imageUrlsJson,
        now,
      });

      // Create claim token
      const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 8);
      const expiresAt = Date.now() + ADMIN_OUTREACH_CLAIM_TTL_MS;

      db.prepare(`
        INSERT INTO assisted_draft_claim_tokens (
          token, property_id, created_by_admin_id, orphan_publisher_id,
          expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(token, propertyId, adminId, orphanPublisherId, expiresAt, Date.now());

      const claimUrl = `${publicWebOrigin()}/anuncio/${roomReferenceCode(roomId)}?claim=${encodeURIComponent(token)}`;
      const listingUrl = `${publicWebOrigin()}/anuncio/${roomReferenceCode(roomId)}`;

      const listingE164 = listingPhoneToE164(phone.contactWhatsApp);
      let assignedUserId: string | null = null;
      if (listingE164) {
        const existing = findUserIdByVerifiedPhone(db, listingE164);
        if (existing) {
          const assigned = assignOutreachPostsForVerifiedPhone(db, existing, listingE164);
          if (assigned.assigned > 0) assignedUserId = existing;
        }
      }

      res.status(201).json({
        ok: true,
        propertyId,
        roomId,
        claimUrl,
        listingUrl,
        token,
        ...(assignedUserId ? { assignedUserId } : {}),
      });
    },
  );

  // ── Public: extract + create/update self-serve assisted draft ─────────────
  r.post(
    "/self/compose",
    express.json({ limit: "30mb" }),
    (req: Request, res: Response): void => {
      void (async () => {
        const uid = readAuthUserId(req);
        if (!uid) {
          res.status(401).json({ error: "unauthorized", message: "Inicia sesión para armar el anuncio con IA." });
          return;
        }
        const lim = composeLimiter(composeRateLimitKey(req));
        if (!lim.ok) {
          res.status(429).json({ error: "rate_limited", retryAfterMs: lim.retryAfterMs });
          return;
        }
        try {
          const body = req.body as {
            text?: string;
            city?: string;
            postMode?: string;
            hints?: unknown;
            infographicPhotos?: ImageInput[];
            photos?: ImageInput[];
            existingToken?: string;
          };
          const text = typeof body.text === "string" ? body.text.trim().slice(0, SELF_SERVE_MAX_TEXT_CHARS) : "";
          const infographics = Array.isArray(body.infographicPhotos)
            ? body.infographicPhotos.slice(0, SELF_SERVE_MAX_INFOGRAPHICS)
            : [];
          const photos = Array.isArray(body.photos) ? body.photos.slice(0, SELF_SERVE_MAX_PHOTOS) : [];
          const hasInfographicData = infographics.some(
            (img) => (typeof img.data === "string" && img.data.length > 0) || (typeof img.url === "string" && img.url),
          );
          if (!text && !hasInfographicData) {
            res.status(400).json({ error: "text_or_infographic_required" });
            return;
          }

          const city = typeof body.city === "string" && body.city.trim() ? body.city.trim() : "Guadalajara";
          const postMode = body.postMode === "property" ? "property" : "room";
          const hints = sanitizeHintsForPostMode(parseHints(body.hints), postMode);
          const inventory = inventoryFromHints(postMode, hints);
          const existingToken = typeof body.existingToken === "string" ? body.existingToken.trim() : "";

          const geminiImages = infographics
            .filter((img) => typeof img.data === "string" && img.data.length > 0 && typeof img.mimeType === "string")
            .map((img) => ({ mimeType: img.mimeType as string, data: img.data as string }));

          const result = await extractListingDataWithGemini({
            text: text || undefined,
            images: geminiImages.length > 0 ? geminiImages : undefined,
            city,
          });
          recordAssistedDraftGenerate(result.promptTokens, result.outputTokens, result.model);

          const merged = mergeExtractionWithHints(result.extraction, hints, text);
          const ext = merged.extraction;
          const photoUrls = [
            ...resolveImageUrls(photos, resolvedUploadDir, SELF_SERVE_MAX_PHOTOS),
            ...resolveImageUrls(infographics, resolvedUploadDir, SELF_SERVE_MAX_INFOGRAPHICS),
          ];
          const loc = locationFromExtraction(ext);
          const now = new Date().toISOString();
          const title = ext.propertyTitle ?? "";
          const neighborhood = ext.neighborhood ?? "";
          const propertyKind = ext.propertyKind ?? null;
          const imageUrlsJson = JSON.stringify(photoUrls);
          const roomImageUrlsJson = postMode === "property" ? "[]" : imageUrlsJson;
          const propertySummary =
            postMode === "property" ? (ext.propertySummary ?? ext.roomSummary ?? "") : "";
          const bathrooms = clampBathrooms(ext.bathrooms ?? 1);
          const phone = assistedDraftPhoneFields(ext);
          const bedroomsTotal =
            postMode === "property"
              ? inventory.roomsForRent + inventory.roomsOccupied
              : propertyKind === "loft"
                ? 1
                : 1;
          const plannedRooms = planComposeRooms({
            postMode,
            roomsForRent: inventory.roomsForRent,
            roomsOccupied: inventory.roomsOccupied,
            extraction: ext,
            nowIso: now,
          });

          let token = existingToken;
          let propertyId = "";
          let roomIds: string[] = [];

          if (token) {
            const row = db.prepare(
              `SELECT * FROM assisted_draft_claim_tokens WHERE token = ?`,
            ).get(token) as AssistedDraftClaimRow | undefined;
            const canReuse =
              row &&
              Date.now() <= row.expires_at &&
              isSelfServeCreator(row.created_by_admin_id) &&
              (row.claimed_by_user_id == null || row.claimed_by_user_id === uid);
            if (!canReuse) {
              token = "";
            } else {
              propertyId = row.property_id;
              db.prepare(`
                UPDATE properties SET
                  post_mode = @postMode, title = @title, city = @city, neighborhood = @neighborhood,
                  lat = @lat, lng = @lng, summary = @summary, contact_whatsapp = @contactWhatsApp,
                  property_kind = @propertyKind,
                  bedrooms_total = @bedroomsTotal, bathrooms = @bathrooms,
                  show_whatsapp = @showWhatsApp, image_urls_json = @imageUrlsJson,
                  is_approximate_location = @isApproximate,
                  approximate_radius_m = @approximateRadius
                WHERE id = @id
              `).run({
                id: propertyId,
                postMode,
                title,
                city,
                neighborhood,
                lat: loc.lat,
                lng: loc.lng,
                summary: propertySummary,
                contactWhatsApp: phone.contactWhatsApp,
                propertyKind,
                bedroomsTotal,
                bathrooms,
                showWhatsApp: phone.showWhatsApp,
                imageUrlsJson,
                isApproximate: loc.isApproximate,
                approximateRadius: loc.approximateRadius,
              });
              roomIds = replaceComposeRooms(db, propertyId, plannedRooms, roomImageUrlsJson, now);
            }
          }

          if (!token) {
            propertyId = `prp__${randomUUID()}`;
            const orphanPublisherId = randomUUID();
            token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 8);
            db.prepare(`
              INSERT INTO properties (
                id, publisher_id, status, post_mode, title, city, neighborhood,
                lat, lng, summary, contact_whatsapp, property_kind,
                bedrooms_total, bathrooms, show_whatsapp, image_urls_json,
                is_approximate_location, approximate_radius_m,
                created_at, assisted_draft, created_by_admin_id
              ) VALUES (
                @id, @publisherId, 'draft', @postMode, @title, @city, @neighborhood,
                @lat, @lng, @summary, @contactWhatsApp, @propertyKind,
                @bedroomsTotal, @bathrooms, @showWhatsApp, @imageUrlsJson,
                @isApproximate, @approximateRadius,
                @createdAt, 1, @adminId
              )
            `).run({
              id: propertyId,
              publisherId: orphanPublisherId,
              postMode,
              title,
              city,
              neighborhood,
              lat: loc.lat,
              lng: loc.lng,
              summary: propertySummary,
              contactWhatsApp: phone.contactWhatsApp,
              propertyKind,
              bedroomsTotal,
              bathrooms,
              showWhatsApp: phone.showWhatsApp,
              imageUrlsJson,
              isApproximate: loc.isApproximate,
              approximateRadius: loc.approximateRadius,
              createdAt: now,
              adminId: SELF_SERVE_CREATOR_ID,
            });
            roomIds = replaceComposeRooms(db, propertyId, plannedRooms, roomImageUrlsJson, now);
            db.prepare(`
              INSERT INTO assisted_draft_claim_tokens (
                token, property_id, created_by_admin_id, orphan_publisher_id,
                expires_at, created_at
              ) VALUES (?, ?, ?, ?, ?, ?)
            `).run(token, propertyId, SELF_SERVE_CREATOR_ID, orphanPublisherId, Date.now() + SELF_SERVE_CLAIM_TTL_MS, Date.now());
          }

          claimAssistedDraftForUser(db, uid, propertyId);

          res.status(201).json({
            ok: true,
            token,
            propertyId,
            roomId: roomIds[0] ?? "",
            source: "self_serve",
            conflicts: merged.conflicts,
            extraction: ext,
          });
        } catch (err) {
          console.error("[assisted-draft] self compose error", err);
          res.status(500).json({ error: "compose_failed" });
        }
      })();
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
    const unclaimedAdminOutreach = isUnclaimedAdminOutreach(db, prop.id);

    const propImages = JSON.parse(prop.image_urls_json || "[]") as string[];
    const isRoomPost = prop.post_mode === "room";
    const firstRoomId = rooms[0]?.id != null ? String(rooms[0].id) : "";
    const listingPath = firstRoomId
      ? `/anuncio/${roomReferenceCode(firstRoomId)}?claim=${encodeURIComponent(token)}`
      : `/borrador/${encodeURIComponent(token)}`;
    const viewerId = readAuthUserId(req);
    const revealPhone = Boolean(viewerId);

    res.json({
      ok: true,
      isClaimed,
      unclaimedAdminOutreach,
      source: isSelfServeCreator(row.created_by_admin_id) ? "self_serve" : "admin",
      propertyId: prop.id,
      listingPath,
      hasDraftPhone: isRealListingPhone(prop.contact_whatsapp),
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
        contactWhatsApp: revealPhone ? prop.contact_whatsapp : "",
        propertyKind: prop.property_kind,
        bedroomsTotal: prop.bedrooms_total,
        bathrooms: prop.bathrooms,
        showWhatsApp: prop.show_whatsapp === 1,
        hidePricing: Number(prop.hide_pricing) === 1,
        imageUrls: propImages,
        isApproximateLocation: prop.is_approximate_location === 1,
        approximateRadiusMeters: prop.approximate_radius_m ?? undefined,
      },
      rooms: rooms.map((r) => {
        const roomImages = JSON.parse(
          typeof r.image_urls_json === "string" ? r.image_urls_json : "[]",
        ) as string[];
        return {
          id: r.id,
          title: r.title,
          rentMxn: r.rent_mxn,
          depositMxn: r.deposit_mxn,
          roommateGenderPref: r.roommate_gender_pref,
          ageMin: r.age_min,
          ageMax: r.age_max,
          summary: r.summary,
          lodgingType: r.lodging_type,
          occupancyStatus: r.occupancy_status === "occupied" ? "occupied" : "available",
          occupantWomenCount:
            r.occupant_women_count != null && Number.isFinite(Number(r.occupant_women_count))
              ? Math.max(0, Math.floor(Number(r.occupant_women_count)))
              : 0,
          occupantMenCount:
            r.occupant_men_count != null && Number.isFinite(Number(r.occupant_men_count))
              ? Math.max(0, Math.floor(Number(r.occupant_men_count)))
              : 0,
          availableFrom: r.available_from,
          minimalStayMonths: r.minimal_stay_months,
          roomDimension: r.room_dimension,
          tags: JSON.parse(typeof r.tags_json === "string" ? r.tags_json : "[]") as string[],
          imageUrls: roomImages.length > 0 || !isRoomPost ? roomImages : propImages,
        };
      }),
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
      const activateBlocked = claimWriteBlock(row.claimed_by_user_id, readAuthUserId(req));
      if (activateBlocked) {
        res.status(activateBlocked.status).json({
          error: activateBlocked.error,
          message: activateBlocked.message,
        });
        return;
      }

      // Set the orphan publisher cookie so the user can edit as that publisher
      issuePublisherCookie(res, row.orphan_publisher_id);

      db.prepare(
        `UPDATE assisted_draft_claim_tokens SET activated_at = ? WHERE token = ? AND activated_at IS NULL`
      ).run(Date.now(), token);

      res.json({ ok: true, propertyId: row.property_id, publisherId: row.orphan_publisher_id });
    },
  );

  r.post(
    "/claim/:token/confirm",
    express.json({ limit: "8kb" }),
    (req: Request, res: Response): void => {
      void (async () => {
        const token = String(req.params.token ?? "").trim();
        const userId = readAuthUserId(req);
        if (!userId) {
          res.status(401).json({ error: "unauthorized", message: "Inicia sesión para reclamar este anuncio." });
          return;
        }
        if (!token) {
          res.status(400).json({ error: "bad_token" });
          return;
        }
        const row = db.prepare(`SELECT * FROM assisted_draft_claim_tokens WHERE token = ?`).get(token) as
          | AssistedDraftClaimRow
          | undefined;
        if (!row) {
          res.status(404).json({ error: "not_found" });
          return;
        }
        if (Date.now() > row.expires_at) {
          res.status(410).json({ error: "expired" });
          return;
        }
        if (row.claimed_by_user_id != null && row.claimed_by_user_id !== userId) {
          res.status(409).json({
            error: "already_claimed_by_other",
            message: CLAIM_ALREADY_CLAIMED_BY_OTHER_MESSAGE,
          });
          return;
        }
        const prop = db.prepare(`SELECT contact_whatsapp FROM properties WHERE id = ?`).get(row.property_id) as
          | { contact_whatsapp: string | null }
          | undefined;
        const admin = isAdminUser(db, userId);
        const gate = evaluateOutreachClaimGate(db, userId, prop?.contact_whatsapp, { isAdmin: admin });
        if (!gate.ok) {
          res.status(gate.status).json({ error: gate.error, message: gate.message });
          return;
        }
        if (!gate.skipOtp) {
          const code = typeof (req.body as { code?: unknown })?.code === "string" ? String((req.body as { code: string }).code).trim() : "";
          if (!gate.listingE164 || !code) {
            res.status(400).json({
              error: "otp_required",
              message: "Confirma el celular del anuncio con el código SMS.",
            });
            return;
          }
          const verified = await verifyPhoneOtp(db, gate.listingE164, code);
          if (!verified.ok) {
            res.status(400).json({ error: verified.error, message: "Código incorrecto o vencido." });
            return;
          }
          setUserPhoneVerified(db, userId, gate.listingE164);
        }
        if (!admin) {
          claimAssistedDraftForUser(db, userId, row.property_id);
        }
        issuePublisherCookie(res, row.orphan_publisher_id);
        res.json({ ok: true, propertyId: row.property_id, skippedClaim: Boolean(admin) });
      })();
    },
  );

  r.post(
    "/claim/:token/otp",
    express.json({ limit: "4kb" }),
    (req: Request, res: Response): void => {
      void (async () => {
        const token = String(req.params.token ?? "").trim();
        const userId = readAuthUserId(req);
        if (!userId) {
          res.status(401).json({ error: "unauthorized" });
          return;
        }
        const row = db.prepare(`SELECT * FROM assisted_draft_claim_tokens WHERE token = ?`).get(token) as
          | AssistedDraftClaimRow
          | undefined;
        if (!row) {
          res.status(404).json({ error: "not_found" });
          return;
        }
        if (Date.now() > row.expires_at) {
          res.status(410).json({ error: "expired" });
          return;
        }
        const prop = db.prepare(`SELECT contact_whatsapp FROM properties WHERE id = ?`).get(row.property_id) as
          | { contact_whatsapp: string | null }
          | undefined;
        const gate = evaluateOutreachClaimGate(db, userId, prop?.contact_whatsapp, {
          isAdmin: isAdminUser(db, userId),
        });
        if (!gate.ok) {
          res.status(gate.status).json({ error: gate.error, message: gate.message });
          return;
        }
        if (gate.skipOtp) {
          res.json({ ok: true, skipOtp: true });
          return;
        }
        if (!gate.listingE164) {
          res.status(400).json({ error: "otp_required" });
          return;
        }
        const sent = await requestPhoneOtp(db, gate.listingE164);
        if (!sent.ok) {
          res.status(400).json({ error: sent.error, message: "No se pudo enviar el código." });
          return;
        }
        res.json({
          ok: true,
          skipOtp: false,
          ...(sent.devCode ? { devCode: sent.devCode } : {}),
          resendAvailableIn: sent.resendAvailableIn,
        });
      })();
    },
  );

  // ── Public: persist recipient edits before sign-in / refresh ─────────────
  r.put(
    "/claim/:token",
    express.json({ limit: "1mb" }),
    (req: Request, res: Response): void => {
      const token = String(req.params.token ?? "").trim();
      if (!token) { res.status(400).json({ error: "bad_token" }); return; }

      const row = db.prepare(
        `SELECT * FROM assisted_draft_claim_tokens WHERE token = ?`
      ).get(token) as AssistedDraftClaimRow | undefined;

      if (!row) { res.status(404).json({ error: "not_found" }); return; }
      if (Date.now() > row.expires_at) { res.status(410).json({ error: "expired" }); return; }
      const saveBlocked = claimWriteBlock(row.claimed_by_user_id, readAuthUserId(req));
      if (saveBlocked) {
        res.status(saveBlocked.status).json({
          error: saveBlocked.error,
          message: saveBlocked.message,
        });
        return;
      }

      const prop = db.prepare(
        `SELECT * FROM properties WHERE id = ?`
      ).get(row.property_id) as PropertyRow | undefined;
      if (!prop || Number(prop.assisted_draft) !== 1) {
        res.status(404).json({ error: "property_not_found" }); return;
      }
      if (prop.status !== "draft") {
        res.status(409).json({ error: "not_draft", message: "Este anuncio ya no es un borrador." }); return;
      }

      const body = req.body as {
        property?: Record<string, unknown>;
        rooms?: Array<Record<string, unknown>>;
      };
      const propertyPatch = body.property && typeof body.property === "object" ? body.property : {};
      const roomsPatch = Array.isArray(body.rooms) ? body.rooms : [];

      const nextTitle =
        asTrimmedString(propertyPatch.title) != null
          ? clampStr(String(propertyPatch.title), TITLE_MAX_LEN)
          : prop.title;
      const nextNeighborhood =
        asTrimmedString(propertyPatch.neighborhood) != null
          ? clampStr(String(propertyPatch.neighborhood), NEIGHBORHOOD_MAX_LEN)
          : prop.neighborhood;
      const nextSummary =
        asTrimmedString(propertyPatch.summary) != null
          ? clampStr(String(propertyPatch.summary), SUMMARY_MAX_LEN)
          : prop.summary;
      const nextShowWhatsapp =
        propertyPatch.showWhatsApp === undefined
          ? (prop.show_whatsapp === 0 ? 0 : 1)
          : propertyPatch.showWhatsApp
            ? 1
            : 0;
      const nextHidePricing =
        propertyPatch.hidePricing === undefined
          ? Number(prop.hide_pricing) === 1
          : Boolean(propertyPatch.hidePricing);
      const nextContactWhatsApp =
        propertyPatch.contactWhatsApp !== undefined
          ? storedContactWhatsApp(nextShowWhatsapp === 1, String(propertyPatch.contactWhatsApp ?? ""))
          : String(prop.contact_whatsapp ?? "");
      const kindRaw = propertyPatch.propertyKind;
      const nextKind =
        kindRaw === "house" || kindRaw === "apartment" || kindRaw === "loft"
          ? kindRaw
          : prop.property_kind;
      const nextBedrooms =
        asFiniteNumber(propertyPatch.bedroomsTotal) != null
          ? clampBedroomsTotal(Number(propertyPatch.bedroomsTotal))
          : prop.bedrooms_total;
      const nextBathrooms =
        asFiniteNumber(propertyPatch.bathrooms) != null
          ? clampBathrooms(Number(propertyPatch.bathrooms))
          : prop.bathrooms;
      const nextWomen =
        propertyPatch.occupiedByWomenCount !== undefined
          ? occupantCountOrNull(propertyPatch.occupiedByWomenCount)
          : null;
      const nextMen =
        propertyPatch.occupiedByMenCount !== undefined
          ? occupantCountOrNull(propertyPatch.occupiedByMenCount)
          : null;
      let nextLat = prop.lat;
      let nextLng = prop.lng;
      const lat = asFiniteNumber(propertyPatch.lat);
      const lng = asFiniteNumber(propertyPatch.lng);
      if (lat != null && lng != null && validLatLng(lat, lng)) {
        nextLat = lat;
        nextLng = lng;
      }
      const nextApprox =
        propertyPatch.isApproximateLocation === undefined
          ? prop.is_approximate_location
          : propertyPatch.isApproximateLocation ? 1 : 0;
      const nextRadius =
        nextApprox === 0
          ? null
          : clampApproximateRadiusMeters(
              propertyPatch.approximateRadiusMeters !== undefined
                ? propertyPatch.approximateRadiusMeters
                : prop.approximate_radius_m,
            );
      const nextImagesJson =
        propertyPatch.imageUrls !== undefined
          ? JSON.stringify(clampListingImageUrls(propertyPatch.imageUrls))
          : prop.image_urls_json;

      db.prepare(`
        UPDATE properties SET
          title = ?, neighborhood = ?, summary = ?, contact_whatsapp = ?, show_whatsapp = ?, hide_pricing = ?, property_kind = ?,
          bedrooms_total = ?, bathrooms = ?,
          occupied_by_women = COALESCE(?, occupied_by_women),
          occupied_by_men = COALESCE(?, occupied_by_men),
          lat = ?, lng = ?,
          is_approximate_location = ?, approximate_radius_m = ?,
          image_urls_json = ?
        WHERE id = ?
      `).run(
        nextTitle,
        nextNeighborhood,
        nextSummary,
        nextContactWhatsApp,
        nextShowWhatsapp,
        nextHidePricing ? 1 : 0,
        nextKind,
        nextBedrooms,
        nextBathrooms,
        nextWomen,
        nextMen,
        nextLat,
        nextLng,
        nextApprox,
        nextRadius,
        nextImagesJson,
        prop.id,
      );

      const existingRooms = db.prepare(
        `SELECT id FROM rooms WHERE property_id = ? ORDER BY sort_order`
      ).all(prop.id) as { id: string }[];
      const now = new Date().toISOString();
      const validRoomPatches = roomsPatch.filter(
        (roomPatch): roomPatch is Record<string, unknown> => Boolean(roomPatch) && typeof roomPatch === "object",
      );
      const targets = resolveClaimSaveRoomTargets(
        existingRooms.map((room) => room.id),
        validRoomPatches.map((roomPatch) => asTrimmedString(roomPatch.id)),
      );
      const savedRoomIds: string[] = [];

      for (let roomIndex = 0; roomIndex < validRoomPatches.length; roomIndex++) {
        const roomPatch = validRoomPatches[roomIndex]!;
        let roomId = targets[roomIndex]?.existingId ?? null;
        if (!roomId) {
          const requestedId = asTrimmedString(roomPatch.id);
          roomId =
            requestedId && isSafeRoomOrListingId(requestedId) ? requestedId : randomUUID();
          db.prepare(`
            INSERT INTO rooms (
              id, property_id, status, title, rent_mxn, rooms_available, tags_json,
              roommate_gender_pref, age_min, age_max, summary, lodging_type,
              available_from, minimal_stay_months, room_dimension,
              aval_required, sublet_allowed, sort_order, deposit_mxn,
              occupancy_status, occupant_women_count, occupant_men_count,
              image_urls_json, created_at, updated_at
            ) VALUES (
              ?, ?, 'draft', '', 0, 1, '[]',
              'any', 18, 99, '', 'private_room',
              ?, 1, 'medium',
              0, 0, ?, 0,
              'available', 0, 0,
              '[]', ?, ?
            )
          `).run(roomId, prop.id, now.slice(0, 10), roomIndex, now, now);
        }

        const roomRow = db.prepare(
          `SELECT * FROM rooms WHERE id = ? AND property_id = ?`
        ).get(roomId, prop.id) as Record<string, unknown> | undefined;
        if (!roomRow) continue;

        const title =
          asTrimmedString(roomPatch.title) != null
            ? clampStr(String(roomPatch.title), ROOM_TITLE_MAX_LEN) || String(roomRow.title ?? "")
            : String(roomRow.title ?? "");
        const summary =
          asTrimmedString(roomPatch.summary) != null
            ? clampStr(String(roomPatch.summary), SUMMARY_MAX_LEN)
            : String(roomRow.summary ?? "");
        const rentMxn =
          asFiniteNumber(roomPatch.rentMxn) != null
            ? clampRentMxn(Number(roomPatch.rentMxn))
            : clampRentMxn(Number(roomRow.rent_mxn));
        const depositMxn =
          asFiniteNumber(roomPatch.depositMxn) != null
            ? clampDepositMxn(Number(roomPatch.depositMxn))
            : clampDepositMxn(Number(roomRow.deposit_mxn ?? 0));
        const prefRaw = roomPatch.roommateGenderPref;
        const roommateGenderPref =
          prefRaw === "any" || prefRaw === "female" || prefRaw === "male"
            ? prefRaw
            : String(roomRow.roommate_gender_pref ?? "any");
        const ageMin =
          asFiniteNumber(roomPatch.ageMin) != null
            ? clampAge(Number(roomPatch.ageMin), 18)
            : clampAge(Number(roomRow.age_min), 18);
        const ageMaxRaw =
          asFiniteNumber(roomPatch.ageMax) != null
            ? clampAge(Number(roomPatch.ageMax), 99)
            : clampAge(Number(roomRow.age_max), 99);
        const ageMax = ageMaxRaw < ageMin ? ageMin : ageMaxRaw;
        let tagsJson = String(roomRow.tags_json ?? "[]");
        if (Array.isArray(roomPatch.tags)) {
          const tags = roomPatch.tags.filter((tag): tag is string => typeof tag === "string" && isListingTag(tag));
          tagsJson = JSON.stringify(tags);
        }
        const lodgingRaw = roomPatch.lodgingType;
        const lodgingType: string | null =
          lodgingRaw === "private_room" || lodgingRaw === "shared_room" || lodgingRaw === "whole_home"
            ? lodgingRaw
            : roomRow.lodging_type == null
              ? null
              : String(roomRow.lodging_type);
        const availableFrom: string | null =
          asTrimmedString(roomPatch.availableFrom) != null
            ? String(roomPatch.availableFrom).slice(0, 10)
            : roomRow.available_from == null
              ? null
              : String(roomRow.available_from);
        const minimalStayMonths =
          asFiniteNumber(roomPatch.minimalStayMonths) != null
            ? Math.max(0, Math.min(36, Math.floor(Number(roomPatch.minimalStayMonths))))
            : Number(roomRow.minimal_stay_months ?? 1);
        const dimRaw = roomPatch.roomDimension;
        const roomDimension: string | null =
          dimRaw === "small" || dimRaw === "medium" || dimRaw === "large"
            ? dimRaw
            : roomRow.room_dimension == null
              ? null
              : String(roomRow.room_dimension);
        const avalRequired =
          roomPatch.avalRequired === undefined
            ? Number(roomRow.aval_required ?? 0)
            : roomPatch.avalRequired ? 1 : 0;
        const occupancyStatus =
          roomPatch.occupancyStatus === "occupied" || roomPatch.occupancyStatus === "available"
            ? roomPatch.occupancyStatus
            : String(roomRow.occupancy_status ?? "available") === "occupied"
              ? "occupied"
              : "available";
        const occupantWomenCount =
          asFiniteNumber(roomPatch.occupantWomenCount) != null
            ? occupantCountOrNull(roomPatch.occupantWomenCount)
            : occupantCountOrNull(roomRow.occupant_women_count);
        const occupantMenCount =
          asFiniteNumber(roomPatch.occupantMenCount) != null
            ? occupantCountOrNull(roomPatch.occupantMenCount)
            : occupantCountOrNull(roomRow.occupant_men_count);
        const imageUrlsJson =
          roomPatch.imageUrls !== undefined
            ? JSON.stringify(clampListingImageUrls(roomPatch.imageUrls))
            : String(roomRow.image_urls_json ?? "[]");

        db.prepare(`
          UPDATE rooms SET
            title = ?, rent_mxn = ?, deposit_mxn = ?, summary = ?, tags_json = ?,
            roommate_gender_pref = ?, age_min = ?, age_max = ?, lodging_type = ?,
            available_from = ?, minimal_stay_months = ?, room_dimension = ?,
            aval_required = ?, occupancy_status = ?, occupant_women_count = ?, occupant_men_count = ?,
            image_urls_json = ?, updated_at = ?
          WHERE id = ? AND property_id = ?
        `).run(
          title,
          rentMxn,
          depositMxn,
          summary,
          tagsJson,
          roommateGenderPref,
          ageMin,
          ageMax,
          lodgingType,
          availableFrom,
          minimalStayMonths,
          roomDimension,
          avalRequired,
          occupancyStatus,
          occupantWomenCount,
          occupantMenCount,
          imageUrlsJson,
          now,
          roomId,
          prop.id,
        );
        savedRoomIds.push(roomId);
      }

      issuePublisherCookie(res, row.orphan_publisher_id);
      res.json({
        ok: true,
        propertyId: prop.id,
        rooms: savedRoomIds.map((id) => ({ id })),
      });
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
        res.status(409).json({
          error: "already_claimed_by_other",
          message: CLAIM_ALREADY_CLAIMED_BY_OTHER_MESSAGE,
        });
        return;
      }

      const orphanPub = row.orphan_publisher_id;

      // Check if orphan publisher is already linked to a different user
      const existingLink = db.prepare(
        `SELECT user_id FROM user_publishers WHERE publisher_id = ?`
      ).get(orphanPub) as { user_id: string } | undefined;

      if (existingLink && existingLink.user_id !== userId) {
        res.status(409).json({ error: "publisher_taken", message: CLAIM_PUBLISHER_TAKEN_MESSAGE }); return;
      }

      if (isAdminUser(db, userId) && isUnclaimedAdminOutreach(db, row.property_id)) {
        res.status(409).json({
          error: "evidence_required",
          message: ADMIN_OUTREACH_EVIDENCE_REQUIRED_MESSAGE,
        });
        return;
      }

      const prop = db.prepare(`SELECT contact_whatsapp, hide_pricing FROM properties WHERE id = ?`).get(row.property_id) as
        | { contact_whatsapp: string | null; hide_pricing?: number }
        | undefined;
      const gate = evaluateOutreachClaimGate(db, userId, prop?.contact_whatsapp, {
        isAdmin: isAdminUser(db, userId),
      });
      if (!gate.ok) {
        res.status(gate.status).json({ error: gate.error, message: gate.message });
        return;
      }
      if (!gate.skipOtp) {
        res.status(400).json({
          error: "otp_required",
          message: "Confirma el celular del anuncio con el código SMS antes de publicar.",
        });
        return;
      }

      const rentRows = db.prepare(
        `SELECT rent_mxn, occupancy_status FROM rooms WHERE property_id = ?`
      ).all(row.property_id) as { rent_mxn: number; occupancy_status?: string }[];
      if (claimPublishMissingRent(rentRows, Number(prop?.hide_pricing) === 1)) {
        res.status(400).json({
          error: "rent_required",
          message: RENT_REQUIRED_PUBLISH_MESSAGE,
        });
        return;
      }

      // Link orphan publisher to user if not already linked
      if (!existingLink) {
        db.prepare(
          `INSERT INTO user_publishers (user_id, publisher_id, created_at) VALUES (?, ?, ?)`
        ).run(userId, orphanPub, new Date().toISOString());
      }

      // Publish the property and its rooms. Persist PostHog session when provided so
      // admin "Ver session replay" works for assisted / AI-claim paths too.
      const now = new Date().toISOString();
      const body = (req.body ?? {}) as { posthogSessionId?: unknown };
      const incomingSession =
        typeof body.posthogSessionId === "string" ? body.posthogSessionId.trim().slice(0, 128) : "";
      const existingSessionRow = db.prepare(
        `SELECT posthog_session_id FROM properties WHERE id = ? AND publisher_id = ?`,
      ).get(row.property_id, orphanPub) as { posthog_session_id?: string | null } | undefined;
      const existingSession =
        existingSessionRow?.posthog_session_id != null &&
        String(existingSessionRow.posthog_session_id).trim()
          ? String(existingSessionRow.posthog_session_id).trim()
          : null;
      const posthogSessionId = existingSession ?? (incomingSession || null);

      db.prepare(
        `UPDATE properties
         SET status = 'published', published_at = ?, posthog_session_id = COALESCE(?, posthog_session_id)
         WHERE id = ? AND publisher_id = ?`,
      ).run(now, posthogSessionId, row.property_id, orphanPub);
      db.prepare(
        `UPDATE rooms SET status = 'published', updated_at = ? WHERE property_id = ?`,
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

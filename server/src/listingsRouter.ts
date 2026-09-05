import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import express, { type Request, type Response } from "express";
import { joinRowToPropertyListing, ROOM_PROPERTY_JOIN_SQL } from "./listingDto.js";
import { redactHiddenPublicPricing } from "./listingPricing.js";
import { isListingTag } from "./listingTags.js";
import { createSlidingWindowLimiter } from "./rateLimit.js";
import { filterListings, parseFilters } from "./searchFilters.js";
import { canWritePropertyByRequest, isAdminRequest, viewerOwnsProperty } from "./propertyRequestAccess.js";
import {
  DIRECT_LINK_JOIN_WHERE,
  isListingJoinRowArchived,
  PUBLISHED_JOIN_WHERE,
} from "./publishedListingsQuery.js";
import { getOrCreatePublisherId, readPublisherIdFromRequest } from "./session.js";
import { resolveRoomIdFromRouteParam } from "./resolveListingRouteId.js";
import { scheduleNotifyOpsNewPostPublished } from "./newPostPublishedNotify.js";
import { readAuthUserId } from "./jwtSession.js";
import {
  hasAcceptedPhoneRevealSafety,
  PHONE_REVEAL_SAFETY_NOTICE_VERSION,
  propertyHasPublicPhone,
  recordPhoneRevealSafetyAcknowledgment,
  type PhoneRevealSafetyRole,
} from "./phoneRevealSafety.js";
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
  contactWhatsAppOkForPublish,
  PROPERTY_SUMMARY_MIN_LEN,
  storedContactWhatsApp,
  SUMMARY_MAX_LEN,
  TITLE_MAX_LEN,
  validLatLng,
  clampListingImageUrls,
  isDraftPlaceholderWhatsApp,
  normalizeWhatsAppDigits,
} from "./validation.js";
import { isRealListingPhone, listingPhoneToE164 } from "./phoneAuth.js";
import { isSelfServeCreator } from "./assistedDraftMerge.js";
import type {
  ListingStatus,
  ListingTag,
  LodgingType,
  PropertyKind,
  PropertyListing,
  RoomDimension,
  RoommateGenderPref,
} from "./types.js";

function optLodging(v: unknown): LodgingType | undefined {
  if (v !== "whole_home" && v !== "private_room" && v !== "shared_room") return undefined;
  return v;
}

function optPropertyKind(v: unknown): PropertyKind | undefined {
  if (v !== "house" && v !== "apartment" && v !== "loft") return undefined;
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
  return (
    s === "draft" ||
    s === "published" ||
    s === "paused" ||
    s === "archived" ||
    s === "pending_review"
  );
}

type PublicListingUnavailableReason =
  | "invalid_id"
  | "listing_not_found"
  | "listing_draft"
  | "listing_paused"
  | "listing_archived"
  | "listing_occupied"
  | "property_draft"
  | "property_paused"
  | "property_archived";

function listingForPublic(l: PropertyListing): PropertyListing {
  const { publisherId: _p, viewsCount: _v, inquiryCount: _i, ...rest } = l;
  return redactHiddenPublicPricing(rest);
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
  if (from === "paused") return to === "published" || to === "archived" || to === "pending_review";
  if (from === "pending_review") return to === "published" || to === "paused";
  return false;
}

function publicUnavailableReasonForRow(row: Record<string, unknown> | undefined): PublicListingUnavailableReason {
  if (!row) return "listing_not_found";

  const roomStatus = String(row.status ?? "");
  // Never confirm drafts to anonymous callers — treat as not found.
  if (roomStatus === "draft") return "listing_not_found";
  // Paused rooms are served on the direct-link path; pending_review stays opaque.
  if (roomStatus === "pending_review") return "listing_not_found";
  if (roomStatus === "archived") return "listing_archived";

  const propertyStatus = String(row.property_status ?? "");
  if (propertyStatus === "draft" || propertyStatus === "pending_review") return "listing_not_found";
  if (propertyStatus === "archived") return "property_archived";

  if (String(row.occupancy_status ?? "available") === "occupied") return "listing_occupied";

  return "listing_not_found";
}

function contactPhonePayload(stored: unknown): { phoneDigits: string; e164: string } | null {
  const digits = normalizeWhatsAppDigits(String(stored ?? ""));
  if (!digits || isDraftPlaceholderWhatsApp(digits)) return null;
  const e164 = listingPhoneToE164(String(stored ?? ""));
  if (!e164) return null;
  return { phoneDigits: digits, e164 };
}

function listingOutreachFlags(
  db: DatabaseSync,
  propertyId: string,
  claimToken: string,
): { claimPreview: boolean; hasDraftPhone: boolean; contactDisabled: boolean; unclaimedAdminOutreach: boolean } {
  const prop = db
    .prepare(
      `SELECT assisted_draft, created_by_admin_id, contact_whatsapp, status FROM properties WHERE id = ?`,
    )
    .get(propertyId) as
    | {
        assisted_draft: number | null;
        created_by_admin_id: string | null;
        contact_whatsapp: string | null;
        status: string;
      }
    | undefined;
  const hasDraftPhone = isRealListingPhone(prop?.contact_whatsapp);
  const isOutreach =
    Number(prop?.assisted_draft) === 1 && !isSelfServeCreator(prop?.created_by_admin_id);
  const tok = db
    .prepare(
      `SELECT claimed_by_user_id FROM assisted_draft_claim_tokens WHERE property_id = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .get(propertyId) as { claimed_by_user_id: string | null } | undefined;
  const claimed = Boolean(tok?.claimed_by_user_id);
  return {
    claimPreview: Boolean(claimToken) && String(prop?.status) === "draft",
    hasDraftPhone,
    contactDisabled: isOutreach && !claimed && String(prop?.status) === "published",
    unclaimedAdminOutreach: isOutreach && !claimed && String(prop?.status) === "draft",
  };
}

export function listingsRouter(db: DatabaseSync) {
  const r = express.Router();
  const jsonMw = express.json({ limit: "512kb" });

  r.get("/", (req: Request, res: Response) => {
    const mark = req.originalUrl.indexOf("?");
    const qs = mark >= 0 ? req.originalUrl.slice(mark + 1) : "";
    const filters = parseFilters(new URLSearchParams(qs));
    const sql = `${ROOM_PROPERTY_JOIN_SQL} ${PUBLISHED_JOIN_WHERE} ORDER BY CASE WHEN IFNULL(p.hide_pricing, 0) != 0 THEN 1 ELSE 0 END, r.rent_mxn ASC, r.id ASC`;
    const rows = db.prepare(sql).all() as Record<string, unknown>[];
    const all = rows.map(joinRowToPropertyListing).map(listingForPublic);
    res.json(filterListings(all, filters));
  });

  r.get("/phone-reveal/status", (req: Request, res: Response) => {
    const uid = readAuthUserId(req);
    if (!uid) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    res.json({
      accepted: hasAcceptedPhoneRevealSafety(db, uid),
      noticeVersion: PHONE_REVEAL_SAFETY_NOTICE_VERSION,
    });
  });

  r.post("/phone-reveal/ack", jsonMw, (req: Request, res: Response) => {
    const uid = readAuthUserId(req);
    if (!uid) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (hasAcceptedPhoneRevealSafety(db, uid)) {
      res.json({ ok: true, alreadyAccepted: true, noticeVersion: PHONE_REVEAL_SAFETY_NOTICE_VERSION });
      return;
    }
    const body = req.body as { role?: unknown; propertyId?: unknown };
    const role: PhoneRevealSafetyRole = body.role === "publisher" ? "publisher" : "seeker";
    const propertyId =
      typeof body.propertyId === "string" && body.propertyId.trim() ? body.propertyId.trim() : null;
    recordPhoneRevealSafetyAcknowledgment(db, {
      id: randomUUID(),
      userId: uid,
      noticeVersion: PHONE_REVEAL_SAFETY_NOTICE_VERSION,
      role,
      propertyId,
      acceptedAt: new Date().toISOString(),
    });
    res.json({ ok: true, noticeVersion: PHONE_REVEAL_SAFETY_NOTICE_VERSION });
  });

  r.get("/:id/contact-phone", (req: Request, res: Response) => {
    const uid = readAuthUserId(req);
    if (!uid) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (!hasAcceptedPhoneRevealSafety(db, uid)) {
      res.status(403).json({ error: "safety_required" });
      return;
    }
    const roomId = resolveRoomIdFromRouteParam(db, String(req.params.id ?? ""));
    if (!roomId) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const claimToken =
      typeof req.query.claim === "string" && req.query.claim.trim() ? req.query.claim.trim() : "";

    const publishedRow = db
      .prepare(`${ROOM_PROPERTY_JOIN_SQL} ${PUBLISHED_JOIN_WHERE} AND r.id = ?`)
      .get(roomId) as Record<string, unknown> | undefined;
    if (publishedRow && propertyHasPublicPhone(publishedRow.show_whatsapp, publishedRow.contact_whatsapp)) {
      const payload = contactPhonePayload(publishedRow.contact_whatsapp);
      if (payload) {
        res.json(payload);
        return;
      }
    }

    if (claimToken) {
      const tok = db
        .prepare(
          `SELECT property_id, expires_at FROM assisted_draft_claim_tokens WHERE token = ?`,
        )
        .get(claimToken) as { property_id: string; expires_at: number } | undefined;
      if (tok && Date.now() <= Number(tok.expires_at)) {
        const claimRow = db
          .prepare(`${ROOM_PROPERTY_JOIN_SQL} WHERE r.id = ? AND p.id = ?`)
          .get(roomId, tok.property_id) as Record<string, unknown> | undefined;
        if (claimRow && isRealListingPhone(String(claimRow.contact_whatsapp ?? ""))) {
          const payload = contactPhonePayload(claimRow.contact_whatsapp);
          if (payload) {
            res.json(payload);
            return;
          }
        }
      }
    }

    res.status(404).json({ error: "phone_unavailable" });
  });

  r.get("/:id", (req: Request, res: Response) => {
    const roomId = resolveRoomIdFromRouteParam(db, String(req.params.id ?? ""));
    if (!roomId) {
      res.status(400).json({ error: "invalid_id", reason: "invalid_id" satisfies PublicListingUnavailableReason });
      return;
    }
    const claimToken =
      typeof req.query.claim === "string" && req.query.claim.trim() ? req.query.claim.trim() : "";
    // Published *or paused* listings load for any visitor with the URL.
    // Archived listings stay hidden even from the owner/admin cookie path.
    const directRow = db
      .prepare(`${ROOM_PROPERTY_JOIN_SQL} ${DIRECT_LINK_JOIN_WHERE} AND r.id = ?`)
      .get(roomId) as Record<string, unknown> | undefined;
    const publishedRow =
      directRow &&
      String(directRow.status ?? "") === "published" &&
      String(directRow.property_status ?? "") === "published"
        ? directRow
        : undefined;

    const publisherId = readPublisherIdFromRequest(req);
    const admin = isAdminRequest(db, req);
    let claimRow: Record<string, unknown> | undefined;
    if (!directRow && claimToken) {
      const tok = db
        .prepare(
          `SELECT property_id, expires_at FROM assisted_draft_claim_tokens WHERE token = ?`,
        )
        .get(claimToken) as { property_id: string; expires_at: number } | undefined;
      if (tok && Date.now() <= Number(tok.expires_at)) {
        claimRow = db
          .prepare(`${ROOM_PROPERTY_JOIN_SQL} WHERE r.id = ? AND p.id = ?`)
          .get(roomId, tok.property_id) as Record<string, unknown> | undefined;
        if (isListingJoinRowArchived(claimRow)) claimRow = undefined;
      }
    }
    const ownerOrAdminRow = (): Record<string, unknown> | undefined => {
      const raw = admin
        ? (db
            .prepare(`${ROOM_PROPERTY_JOIN_SQL} WHERE r.id = ?`)
            .get(roomId) as Record<string, unknown> | undefined)
        : publisherId
          ? (db
              .prepare(
                `${ROOM_PROPERTY_JOIN_SQL}
                 WHERE r.id = ? AND p.publisher_id = ?`,
              )
              .get(roomId, publisherId) as Record<string, unknown> | undefined)
          : undefined;
      return isListingJoinRowArchived(raw) ? undefined : raw;
    };
    const row = directRow ?? claimRow ?? ownerOrAdminRow();
    if (row) {
      const listing = listingForPublic(joinRowToPropertyListing(row));
      const ownerPublisherId = String(row.publisher_id ?? "");
      const isOwner = Boolean(ownerPublisherId && viewerOwnsProperty(db, req, ownerPublisherId));
      // Count public opens only (skip owner previews and claim-link previews) for Mis Anuncios metrics.
      if (publishedRow && !isOwner && !claimToken) {
        try {
          db.prepare(
            "UPDATE rooms SET views_count = COALESCE(views_count, 0) + 1 WHERE id = ?",
          ).run(roomId);
        } catch {
          // Column may be missing on very old DBs mid-migrate; never block listing GET.
        }
      }
      const flags = listingOutreachFlags(db, String(row.property_id ?? ""), claimToken);
      const payload = {
        ...listing,
        ...(isOwner ? { viewerIsOwner: true as const } : {}),
        ...(flags.claimPreview ? { claimPreview: true as const } : {}),
        hasDraftPhone: flags.hasDraftPhone,
        ...(flags.claimPreview && flags.hasDraftPhone
          ? { claimPhoneDisplay: String(row.contact_whatsapp ?? "").replace(/\D/g, "") }
          : {}),
        ...(flags.contactDisabled ? { contactDisabled: true as const } : {}),
        ...(flags.unclaimedAdminOutreach ? { unclaimedAdminOutreach: true as const } : {}),
      };
      res.json(payload);
      return;
    }

    const hiddenRow = db
      .prepare(`${ROOM_PROPERTY_JOIN_SQL} WHERE r.id = ?`)
      .get(roomId) as Record<string, unknown> | undefined;
    res.status(404).json({ error: "not_found", reason: publicUnavailableReasonForRow(hiddenRow) });
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

    const showWa = (body as { showWhatsApp?: unknown }).showWhatsApp;
    const showPublic = showWa !== false;
    const contactStored = storedContactWhatsApp(showPublic, body.contactWhatsApp);
    if (!contactWhatsAppOkForPublish(showPublic, contactStored)) {
      res.status(400).json({ error: "invalid_whatsapp", message: "WhatsApp inválido." });
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
    const showWhatsappInt = showPublic ? 1 : 0;
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
        aval_required, sublet_allowed, sort_order, deposit_mxn, image_urls_json, created_at, updated_at
      ) VALUES (
        @id, @propertyId, @status, @title, @rentMxn, @roomsAvailable, @tagsJson, @roommateGenderPref,
        @ageMin, @ageMax, @summary, @lodgingType, @availableFrom, @minimalStayMonths, @roomDimension,
        @avalRequired, @subletAllowed, 0, @depositMxn, @imageUrlsJson, @createdAt, @updatedAt
      )
    `);
    const createdAt = new Date().toISOString();

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
        contactWhatsApp: contactStored,
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
        createdAt,
        updatedAt: createdAt,
      });
      db.exec("COMMIT;");
    } catch {
      db.exec("ROLLBACK;");
      res.status(409).json({ error: "conflict" });
      return;
    }

    if (status === "published") {
      db.prepare(
        `UPDATE properties SET published_at = ? WHERE id = ? AND (published_at IS NULL OR trim(published_at) = '')`,
      ).run(createdAt, propertyId);
      scheduleNotifyOpsNewPostPublished(db, propertyId);
    }

    const created = db
      .prepare(`${ROOM_PROPERTY_JOIN_SQL} WHERE r.id = ?`)
      .get(roomId) as Record<string, unknown>;
    res.status(201).json(joinRowToPropertyListing(created));
  });

  r.patch("/:id", jsonMw, (req: Request, res: Response) => {
    const roomId = resolveRoomIdFromRouteParam(db, String(req.params.id ?? ""));
    if (!roomId) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const row = db
      .prepare(`${ROOM_PROPERTY_JOIN_SQL} WHERE r.id = ?`)
      .get(roomId) as Record<string, unknown> | undefined;
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const propertyPublisherId = String(row.publisher_id ?? "");
    if (!canWritePropertyByRequest(db, req, propertyPublisherId)) {
      res.status(401).json({ error: "publisher_session_required", message: "Missing publisher session cookie." });
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

    db.prepare("UPDATE rooms SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(next, listing.id);
    const updated = db.prepare(`${ROOM_PROPERTY_JOIN_SQL} WHERE r.id = ?`).get(listing.id) as Record<string, unknown>;
    if (next === "published" && listing.status !== "published") {
      void import("./savedSearchNotify.js").then(({ onRoomPublished }) => onRoomPublished(db, listing.id));
      if (propertyPublisherId) {
        void import("./notificationsSchema.js").then(({ notifyPublisher }) => {
          notifyPublisher(db, propertyPublisherId, {
            text: `Has publicado exitosamente tu anuncio de Cuarto '${String(listing.title ?? "tu cuarto").slice(0, 80)}'.`,
            link: "/mis-anuncios",
          });
        });
      }
    }
    res.json(joinRowToPropertyListing(updated));
  });

  return r;
}

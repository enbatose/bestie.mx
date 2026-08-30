import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import express, { type Request, type Response } from "express";
import { joinRowToPropertyListing, ROOM_PROPERTY_JOIN_SQL } from "./listingDto.js";
import { isListingTag } from "./listingTags.js";
import { readAuthUserId } from "./jwtSession.js";
import { canWritePropertyByRequest, hasPublisherOrAdminSession, isAdminRequest } from "./propertyRequestAccess.js";
import { isUnclaimedAdminOutreach, isRealListingPhone } from "./phoneAuth.js";
import { propertyHasPublicPhone } from "./phoneRevealSafety.js";
import {
  hidePricingContactAllowed,
  hidePricingContactRequired,
  HIDE_PRICING_CONTACT_MESSAGE,
  redactHiddenPublicRooms,
  resolveShowWhatsappForHidePricing,
} from "./listingPricing.js";
import { createSlidingWindowLimiter } from "./rateLimit.js";
import { resolvePropertyIdFromRouteParam, resolveRoomIdFromRouteParam } from "./resolveListingRouteId.js";
import {
  parseStreetViewPovJson,
  serializeStreetViewPovJson,
  streetViewPovFromBody,
} from "./streetViewPov.js";
import { getOrCreatePublisherId, readPublisherIdFromRequest } from "./session.js";
import {
  CITY_MAX_LEN,
  clampListingImageUrls,
  clampAge,
  clampBathrooms,
  clampBedroomsTotal,
  clampDepositMxn,
  clampRentMxn,
  clampRoomsAvailable,
  clampStr,
  contactWhatsAppOkForPublish,
  isSafeRoomOrListingId,
  minimalPropertySummaryOk,
  minimalRoomSummaryOk,
  PROPERTY_SUMMARY_MIN_LEN,
  ROOM_SUMMARY_MIN_LEN,
  NEIGHBORHOOD_MAX_LEN,
  storedContactWhatsApp,
  ROOM_TITLE_MAX_LEN,
  SUMMARY_MAX_LEN,
  TITLE_MAX_LEN,
  validLatLng,
  approximateRadiusMetersForStorage,
  clampApproximateRadiusMeters,
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
import { isFirstPropertyPublish, scheduleNotifyOpsNewPostPublished } from "./newPostPublishedNotify.js";
import { isUserPublisherBlocked, submitPropertyForReview } from "./listingReports.js";

function isListingStatus(s: string): s is ListingStatus {
  return (
    s === "draft" ||
    s === "published" ||
    s === "paused" ||
    s === "archived" ||
    s === "pending_review"
  );
}

function isRoommateGenderPref(s: string): s is RoommateGenderPref {
  return s === "any" || s === "female" || s === "male";
}

function optOccupancyStatus(v: unknown): "available" | "occupied" {
  return String(v ?? "available") === "occupied" ? "occupied" : "available";
}

function roomOccupancyFieldsFromBody(body: Partial<Room>): {
  customName: string | null;
  occupancyStatus: "available" | "occupied";
  occupantGender: string | null;
  occupantAge: number | null;
  occupantWomenCount: number | null;
  occupantMenCount: number | null;
} {
  const customName =
    typeof body.customName === "string" && body.customName.trim()
      ? clampStr(body.customName.trim(), ROOM_TITLE_MAX_LEN)
      : null;
  const occupancyStatus = optOccupancyStatus(body.occupancyStatus);
  const occupantGender =
    occupancyStatus === "occupied" &&
    typeof body.occupantGender === "string" &&
    isRoommateGenderPref(body.occupantGender)
      ? body.occupantGender
      : null;
  const occupantAge =
    occupancyStatus === "occupied" && typeof body.occupantAge === "number"
      ? clampAge(body.occupantAge, 18)
      : null;
  const occupantWomenCount =
    occupancyStatus === "occupied" ? occupantCountOrNull((body as { occupantWomenCount?: unknown }).occupantWomenCount) : null;
  const occupantMenCount =
    occupancyStatus === "occupied" ? occupantCountOrNull((body as { occupantMenCount?: unknown }).occupantMenCount) : null;
  return { customName, occupancyStatus, occupantGender, occupantAge, occupantWomenCount, occupantMenCount };
}

function optLodging(v: unknown): LodgingType | undefined {
  if (v !== "whole_home" && v !== "private_room" && v !== "shared_room") return undefined;
  return v;
}

function optPropertyKind(v: unknown): PropertyKind | undefined {
  if (v !== "house" && v !== "apartment" && v !== "loft") return undefined;
  return v;
}

/** Non-negative integer for DB (0–500); `null` clears / stores SQL NULL. */
function occupantCountOrNull(v: unknown): number | null {
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.max(0, Math.min(500, Math.floor(v)));
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return null;
    if (!/^\d+$/.test(t)) return null;
    return Math.max(0, Math.min(500, parseInt(t, 10)));
  }
  return null;
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

function imageUrlsFromRow(raw: unknown): string[] {
  try {
    return clampListingImageUrls(JSON.parse(String(raw ?? "[]")));
  } catch {
    return [];
  }
}

/** Optional 0-based publish-wizard step index (0–20). */
function optWizardStep(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(20, Math.floor(n)));
}

/** PostHog session id for admin replay links (opaque string). */
function optPosthogSessionId(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().slice(0, 128);
  return t || null;
}

function rowToProperty(row: Record<string, unknown>): Property {
  const pk = optPropertyKind(row.property_kind);
  const st = String(row.status ?? "draft");
  const status: ListingStatus = isListingStatus(st) ? st : "draft";
  const pmRaw = String(row.post_mode ?? "property");
  const postMode: "room" | "property" = pmRaw === "room" ? "room" : "property";
  const sw = row.show_whatsapp;
  const showWhatsApp = !(sw === 0 || sw === false || sw === "0");
  const imageUrls = imageUrlsFromRow(row.image_urls_json);
  return {
    id: String(row.id),
    publisherId: String(row.publisher_id),
    status,
    postMode,
    title: String(row.title),
    city: String(row.city),
    neighborhood: String(row.neighborhood),
    lat: Number(row.lat),
    lng: Number(row.lng),
    summary: String(row.summary ?? ""),
    contactWhatsApp: String(row.contact_whatsapp),
    bedroomsTotal:
      row.bedrooms_total != null && Number.isFinite(Number(row.bedrooms_total))
        ? Number(row.bedrooms_total)
        : 1,
    bathrooms: row.bathrooms != null && Number.isFinite(Number(row.bathrooms)) ? Number(row.bathrooms) : 1,
    showWhatsApp,
    ...(Number(row.hide_pricing) === 1 ? { hidePricing: true as const } : {}),
    ...(pk ? { propertyKind: pk } : {}),
    ...(imageUrls.length ? { imageUrls, commonAreaPhotos: imageUrls } : {}),
    ...(row.is_approximate_location ? { isApproximateLocation: true } : {}),
    ...(row.is_approximate_location
      ? { approximateRadiusMeters: clampApproximateRadiusMeters(row.approximate_radius_m) }
      : {}),
    ...(parseStreetViewPovJson(row.street_view_pov_json)
      ? { streetViewPov: parseStreetViewPovJson(row.street_view_pov_json)! }
      : {}),
    ...(row.occupied_by_women != null && Number.isFinite(Number(row.occupied_by_women))
      ? { occupiedByWomenCount: Math.max(0, Math.floor(Number(row.occupied_by_women))) }
      : {}),
    ...(row.occupied_by_men != null && Number.isFinite(Number(row.occupied_by_men))
      ? { occupiedByMenCount: Math.max(0, Math.floor(Number(row.occupied_by_men))) }
      : {}),
    ...(row.wizard_step != null && Number.isFinite(Number(row.wizard_step))
      ? { wizardStep: Math.floor(Number(row.wizard_step)) }
      : {}),
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
  const dep = row.deposit_mxn != null && Number.isFinite(Number(row.deposit_mxn)) ? clampDepositMxn(Number(row.deposit_mxn)) : 0;
  const imageUrls = imageUrlsFromRow(row.image_urls_json);
  const createdAt = typeof row.created_at === "string" && row.created_at.trim() ? row.created_at.trim() : undefined;
  const updatedAt = typeof row.updated_at === "string" && row.updated_at.trim() ? row.updated_at.trim() : createdAt;
  const occRaw = String(row.occupancy_status ?? "available");
  const occupancyStatus: Room["occupancyStatus"] =
    occRaw === "occupied" ? "occupied" : "available";
  const customName =
    row.custom_name != null && String(row.custom_name).trim()
      ? String(row.custom_name).trim()
      : undefined;
  const occupantGenderRaw = row.occupant_gender != null ? String(row.occupant_gender) : "";
  const occupantGender = isRoommateGenderPref(occupantGenderRaw)
    ? (occupantGenderRaw as RoommateGenderPref)
    : undefined;
  const occupantAge =
    row.occupant_age != null && Number.isFinite(Number(row.occupant_age))
      ? Math.min(99, Math.max(18, Math.floor(Number(row.occupant_age))))
      : undefined;
  const occupantWomenCount =
    row.occupant_women_count != null && Number.isFinite(Number(row.occupant_women_count))
      ? Math.max(0, Math.floor(Number(row.occupant_women_count)))
      : undefined;
  const occupantMenCount =
    row.occupant_men_count != null && Number.isFinite(Number(row.occupant_men_count))
      ? Math.max(0, Math.floor(Number(row.occupant_men_count)))
      : undefined;
  return {
    id: String(row.id),
    propertyId: String(row.property_id),
    status: rstatus,
    ...(customName ? { customName } : {}),
    occupancyStatus,
    ...(occupantGender ? { occupantGender } : {}),
    ...(occupantAge != null ? { occupantAge } : {}),
    ...(occupantWomenCount != null ? { occupantWomenCount } : {}),
    ...(occupantMenCount != null ? { occupantMenCount } : {}),
    title: String(row.title),
    rentMxn: Number(row.rent_mxn),
    depositMxn: dep,
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
    ...(imageUrls.length ? { imageUrls } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };
}

function canTransitionProperty(from: ListingStatus, to: ListingStatus): boolean {
  if (from === to) return true;
  if (from === "draft") return to === "published";
  if (from === "published") return to === "paused" || to === "archived";
  if (from === "paused") return to === "published" || to === "archived" || to === "pending_review";
  if (from === "pending_review") return to === "published" || to === "paused";
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

function publisherLinkedToUser(db: DatabaseSync, publisherId: string, userId: string): boolean {
  const row = db
    .prepare(`SELECT 1 AS x FROM user_publishers WHERE user_id = ? AND publisher_id = ?`)
    .get(userId, publisherId) as { x: number } | undefined;
  return Boolean(row?.x);
}

export function propertiesRouter(db: DatabaseSync) {
  const r = express.Router();
  const jsonMw = express.json({ limit: "512kb" });

  /**
   * Wizard publish: one property + ≥1 rooms in a transaction.
   * Body: { legalAccepted: true, property: {...}, rooms: [...] }
   * Registered before `/:id` so the path `/publish-bundle` is not captured as an id.
   */
  r.post("/publish-bundle", jsonMw, (req: Request, res: Response) => {
    const userId = readAuthUserId(req);
    if (!userId) {
      res.status(401).json({
        error: "auth_required",
        message: "Inicia sesión o crea una cuenta para publicar. Tu borrador se puede guardar sin cuenta.",
      });
      return;
    }
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
      const rm = raw as Partial<Room> & { availableFrom?: unknown; depositMxn?: unknown };
      const occFields = roomOccupancyFieldsFromBody(rm);
      if (occFields.occupancyStatus === "occupied") {
        continue;
      }
      if (
        typeof rm.title !== "string" ||
        typeof rm.rentMxn !== "number" ||
        typeof rm.roomsAvailable !== "number" ||
        !Array.isArray(rm.tags) ||
        typeof rm.roommateGenderPref !== "string" ||
        typeof rm.ageMin !== "number" ||
        typeof rm.ageMax !== "number" ||
        typeof rm.summary !== "string" ||
        typeof rm.availableFrom !== "string" ||
        typeof rm.roomDimension !== "string" ||
        typeof rm.minimalStayMonths !== "number" ||
        typeof rm.depositMxn !== "number"
      ) {
        res.status(400).json({
          error: "invalid_room",
          message:
            "Each room needs title, rent, spots, tags, gender pref, ages, summary, availableFrom (YYYY-MM-DD), roomDimension, minimalStayMonths, depositMxn.",
        });
        return;
      }
      if (!optIsoDate(rm.availableFrom) || !optDim(rm.roomDimension)) {
        res.status(400).json({ error: "invalid_room", message: "Invalid availableFrom or roomDimension." });
        return;
      }
      const ms = optPositiveInt(rm.minimalStayMonths);
      if (ms == null || ms < 1) {
        res.status(400).json({ error: "invalid_room", message: "minimalStayMonths must be >= 1." });
        return;
      }
    }

    const showWaPub = optBool((p as { showWhatsApp?: unknown }).showWhatsApp);
    const showPublicPub = showWaPub !== false;
    const contactStoredPub = storedContactWhatsApp(showPublicPub, p.contactWhatsApp);
    if (!contactWhatsAppOkForPublish(showPublicPub, contactStoredPub)) {
      res.status(400).json({ error: "invalid_whatsapp", message: "WhatsApp inválido." });
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
    const postModeRaw = (p as { postMode?: unknown; post_mode?: unknown }).postMode ?? (p as { post_mode?: unknown }).post_mode;
    const postMode: "room" | "property" =
      (typeof postModeRaw === "string" ? postModeRaw : "") === "room" ? "room" : "property";
    if (postMode !== "room" && !minimalPropertySummaryOk(ps)) {
      res.status(400).json({
        error: "invalid_body",
        message: `Property description must be at least ${PROPERTY_SUMMARY_MIN_LEN} characters.`,
      });
      return;
    }

    const propImages = clampListingImageUrls((p as { imageUrls?: unknown }).imageUrls);
    const roomImagesList = roomsIn.map((raw) =>
      clampListingImageUrls((raw as { imageUrls?: unknown }).imageUrls),
    );

    const bedTotal = clampBedroomsTotal(Number((p as { bedroomsTotal?: unknown }).bedroomsTotal ?? 1));
    const bathTotal = clampBathrooms(Number((p as { bathrooms?: unknown }).bathrooms ?? 1));
    const showWhatsappInt = showPublicPub ? 1 : 0;
    const hidePricingPub = optBool((p as { hidePricing?: unknown }).hidePricing) === true;
    const hasPhonePub = propertyHasPublicPhone(showWhatsappInt, contactStoredPub);
    if (hidePricingPub && !hidePricingContactAllowed(hasPhonePub, true)) {
      res.status(400).json({ error: "hide_pricing_contact", message: HIDE_PRICING_CONTACT_MESSAGE });
      return;
    }

    const publisherId = getOrCreatePublisherId(req, res);
    if (!publisherLinkedToUser(db, publisherId, userId)) {
      res.status(403).json({
        error: "publisher_not_linked",
        message:
          "Tu sesión de publicación no está vinculada a tu cuenta. Entra o regístrate y vuelve a intentar.",
      });
      return;
    }
    const propertyId = `prp__${randomUUID()}`;
    const propertyKind = optPropertyKind(p.propertyKind);

    const propImagesJson = JSON.stringify(propImages);

    const occWPub = occupantCountOrNull((p as { occupiedByWomenCount?: unknown }).occupiedByWomenCount);
    const occMPub = occupantCountOrNull((p as { occupiedByMenCount?: unknown }).occupiedByMenCount);
    let streetViewPovJsonPub: string | null = null;
    try {
      const povBody = streetViewPovFromBody((p as { streetViewPov?: unknown }).streetViewPov);
      streetViewPovJsonPub = serializeStreetViewPovJson(povBody ?? undefined);
    } catch {
      res.status(400).json({ error: "invalid_street_view_pov" });
      return;
    }
    const posthogSessionPub = optPosthogSessionId((p as { posthogSessionId?: unknown }).posthogSessionId) ?? null;
    const insertProp = db.prepare(`
      INSERT INTO properties (
        id, publisher_id, status, post_mode, title, city, neighborhood, lat, lng, summary, contact_whatsapp, property_kind,
        bedrooms_total, bathrooms, show_whatsapp, hide_pricing, image_urls_json, is_approximate_location, approximate_radius_m,
        occupied_by_women, occupied_by_men, street_view_pov_json, created_at, published_at, posthog_session_id
      ) VALUES (?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const createdAt = new Date().toISOString();
    const insertRoom = db.prepare(`
      INSERT INTO rooms (
        id, property_id, status, title, rent_mxn, rooms_available, tags_json, roommate_gender_pref,
        age_min, age_max, summary, lodging_type, available_from, minimal_stay_months, room_dimension,
        aval_required, sublet_allowed, sort_order, deposit_mxn, image_urls_json, created_at, updated_at,
        custom_name, occupancy_status, occupant_gender, occupant_age, occupant_women_count, occupant_men_count
      ) VALUES (?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      db.exec("BEGIN IMMEDIATE;");
      const isApproxPub = optBool((p as { isApproximateLocation?: unknown }).isApproximateLocation)
        ? true
        : false;
      const approxRadiusPub = approximateRadiusMetersForStorage(
        isApproxPub,
        (p as { approximateRadiusMeters?: unknown }).approximateRadiusMeters,
      );
      insertProp.run(
        propertyId,
        publisherId,
        postMode,
        pt,
        pc,
        pn,
        p.lat,
        p.lng,
        ps,
        contactStoredPub,
        propertyKind ?? null,
        bedTotal,
        bathTotal,
        showWhatsappInt,
        hidePricingPub ? 1 : 0,
        propImagesJson,
        isApproxPub ? 1 : 0,
        approxRadiusPub,
        occWPub,
        occMPub,
        streetViewPovJsonPub,
        createdAt,
        createdAt,
        posthogSessionPub,
      );

      let order = 0;
      for (const raw of roomsIn) {
        const rm = raw as Partial<Room> & { id?: string };
        const occFields = roomOccupancyFieldsFromBody(rm);
        const roomIdRaw = typeof rm.id === "string" && rm.id.trim() ? rm.id.trim() : randomUUID();
        const roomId = isSafeRoomOrListingId(roomIdRaw) ? roomIdRaw : randomUUID();
        const displayTitle =
          occFields.customName ||
          clampStr(String(rm.title), ROOM_TITLE_MAX_LEN) ||
          (occFields.occupancyStatus === "occupied" ? "Ocupada" : "Recámara");

        const prefRaw = String(rm.roommateGenderPref ?? "any");
        if (!isRoommateGenderPref(prefRaw)) throw new Error("bad_pref");
        const pref = prefRaw as RoommateGenderPref;
        const tags = (Array.isArray(rm.tags) ? rm.tags : []).filter(
          (t): t is ListingTag => typeof t === "string" && isListingTag(t),
        );
        if (Array.isArray(rm.tags) && tags.length !== rm.tags.length) throw new Error("bad_tags");
        const title = displayTitle;
        const summary = clampStr(String(rm.summary ?? ""), SUMMARY_MAX_LEN);
        if (occFields.occupancyStatus !== "occupied") {
          if (!title || !minimalRoomSummaryOk(summary)) throw new Error("bad_room_text");
        }
        const rentMxn = clampRentMxn(Number(rm.rentMxn ?? 0));
        if (occFields.occupancyStatus !== "occupied" && !hidePricingPub && rentMxn <= 0) {
          throw new Error("bad_rent");
        }
        const roomsAvailable = clampRoomsAvailable(Number(rm.roomsAvailable ?? 1));
        const ageMin = clampAge(Number(rm.ageMin ?? 18), 18);
        const ageMax = clampAge(Number(rm.ageMax ?? 99), 99);
        if (ageMin > ageMax) throw new Error("bad_age");
        const availFrom = optIsoDate(rm.availableFrom) ?? new Date().toISOString().slice(0, 10);
        const dim = optDim(rm.roomDimension) ?? "medium";
        const minStay = optPositiveInt(rm.minimalStayMonths) ?? 1;
        if (occFields.occupancyStatus !== "occupied" && (!availFrom || !dim || minStay < 1)) {
          throw new Error("bad_room_fields");
        }
        const depositMxn = clampDepositMxn(Number((rm as { depositMxn?: unknown }).depositMxn ?? 0));
        const roomImagesJson = JSON.stringify(
          roomImagesList[order] ?? clampListingImageUrls((rm as { imageUrls?: unknown }).imageUrls),
        );
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
          availFrom,
          minStay,
          dim,
          optBool(rm.avalRequired) === true ? 1 : optBool(rm.avalRequired) === false ? 0 : null,
          optBool(rm.subletAllowed) === true ? 1 : optBool(rm.subletAllowed) === false ? 0 : null,
          order++,
          depositMxn,
          roomImagesJson,
          createdAt,
          createdAt,
          occFields.customName,
          occFields.occupancyStatus,
          occFields.occupantGender,
          occFields.occupantAge,
          occFields.occupantWomenCount,
          occFields.occupantMenCount,
        );
      }
      db.exec("COMMIT;");
    } catch {
      db.exec("ROLLBACK;");
      res.status(400).json({ error: "invalid_body" });
      return;
    }

    scheduleNotifyOpsNewPostPublished(db, propertyId);

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
    const propertyId = resolvePropertyIdFromRouteParam(db, String(req.params.id ?? ""));
    if (!propertyId) {
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
    const pubOwns = publisherId != null && String(propRow.publisher_id) === publisherId;
    const owner = pubOwns || isAdminRequest(db, req);

    const roomSql = owner
      ? "SELECT * FROM rooms WHERE property_id = ? ORDER BY sort_order ASC, id ASC"
      : "SELECT * FROM rooms WHERE property_id = ? AND status = 'published' ORDER BY sort_order ASC, id ASC";
    const roomRows = db.prepare(roomSql).all(propertyId) as Record<string, unknown>[];

    if (!owner && String(propRow.status) !== "published") {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const property = rowToProperty(propRow);
    if (!owner) {
      // Never expose publisherId on public reads — it was usable as a forgeable ownership credential.
      delete (property as { publisherId?: string }).publisherId;
    } else if (isUnclaimedAdminOutreach(db, propertyId)) {
      property.unclaimedAdminOutreach = true;
    }
    const rooms = roomRows.map(rowToRoom);
    const payload: PropertyWithRooms = {
      property,
      rooms: owner ? rooms : redactHiddenPublicRooms(rooms, Boolean(property.hidePricing)),
    };
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
    const postMode: "room" | "property" = body.postMode === "room" ? "room" : "property";
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
    const showDraft = optBool((body as { showWhatsApp?: unknown }).showWhatsApp) !== false;
    const wa = storedContactWhatsApp(showDraft, body.contactWhatsApp);
    if (!validLatLng(body.lat, body.lng)) {
      res.status(400).json({ error: "invalid_geo" });
      return;
    }
    const title = clampStr(body.title, TITLE_MAX_LEN);
    const city = clampStr(body.city, CITY_MAX_LEN);
    const neighborhood = clampStr(body.neighborhood, NEIGHBORHOOD_MAX_LEN);
    const summary = clampStr(typeof body.summary === "string" ? body.summary : "", SUMMARY_MAX_LEN);
    const titleOrDefault = title || "Sin título";
    if (!city || !neighborhood) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const propertyKind = optPropertyKind(body.propertyKind);
    const bed = clampBedroomsTotal(Number((body as { bedroomsTotal?: unknown }).bedroomsTotal ?? 1));
    const bath = clampBathrooms(Number((body as { bathrooms?: unknown }).bathrooms ?? 1));
    const showInt = optBool((body as { showWhatsApp?: unknown }).showWhatsApp) === false ? 0 : 1;
    const id = randomUUID();
    const propertyId = `prp__${id}`;
    const draftPropImagesJson = JSON.stringify(
      clampListingImageUrls((body as { imageUrls?: unknown }).imageUrls),
    );
    const occWCreate = occupantCountOrNull((body as { occupiedByWomenCount?: unknown }).occupiedByWomenCount);
    const occMCreate = occupantCountOrNull((body as { occupiedByMenCount?: unknown }).occupiedByMenCount);
    let streetViewPovJsonCreate: string | null = null;
    try {
      const povBody = streetViewPovFromBody((body as { streetViewPov?: unknown }).streetViewPov);
      streetViewPovJsonCreate = serializeStreetViewPovJson(povBody ?? undefined);
    } catch {
      res.status(400).json({ error: "invalid_street_view_pov" });
      return;
    }
    const wizardStepCreate = optWizardStep((body as { wizardStep?: unknown }).wizardStep);
    const posthogSessionCreate = optPosthogSessionId(
      (body as { posthogSessionId?: unknown }).posthogSessionId,
    );
    const createdAtDraft = new Date().toISOString();
    db.prepare(
      `INSERT INTO properties (
        id, publisher_id, status, post_mode, title, city, neighborhood, lat, lng, summary, contact_whatsapp, property_kind,
        bedrooms_total, bathrooms, show_whatsapp, hide_pricing, image_urls_json, is_approximate_location, approximate_radius_m,
        occupied_by_women, occupied_by_men, street_view_pov_json, created_at, wizard_step, posthog_session_id
      ) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      propertyId,
      publisherId,
      postMode,
      titleOrDefault,
      city,
      neighborhood,
      body.lat,
      body.lng,
      summary,
      wa,
      propertyKind ?? null,
      bed,
      bath,
      showInt,
      optBool((body as { hidePricing?: unknown }).hidePricing) === true ? 1 : 0,
      draftPropImagesJson,
      (() => {
        const isApprox = Boolean(optBool(body.isApproximateLocation));
        return isApprox ? 1 : 0;
      })(),
      approximateRadiusMetersForStorage(
        Boolean(optBool(body.isApproximateLocation)),
        (body as { approximateRadiusMeters?: unknown }).approximateRadiusMeters,
      ),
      occWCreate,
      occMCreate,
      streetViewPovJsonCreate,
      createdAtDraft,
      wizardStepCreate ?? null,
      posthogSessionCreate ?? null,
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
    if (!hasPublisherOrAdminSession(db, req)) {
      res.status(401).json({ error: "publisher_session_required" });
      return;
    }
    const propertyId = resolvePropertyIdFromRouteParam(db, String(req.params.id ?? ""));
    if (!propertyId) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const prop = db.prepare("SELECT * FROM properties WHERE id = ?").get(propertyId) as Record<string, unknown> | undefined;
    if (!prop || !canWritePropertyByRequest(db, req, String(prop.publisher_id))) {
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

    const rTitle = clampStr(body.title, ROOM_TITLE_MAX_LEN) || "Cuarto en borrador";
    const rSummary = clampStr(typeof body.summary === "string" ? body.summary : "", SUMMARY_MAX_LEN);
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
    const minimalStayMonths = optPositiveInt(body.minimalStayMonths) ?? 1;
    const roomDimension = optDim(body.roomDimension) ?? "medium";
    const avalRequired = optBool(body.avalRequired);
    const subletAllowed = optBool(body.subletAllowed);
    const depositMxn = clampDepositMxn(Number((body as { depositMxn?: unknown }).depositMxn ?? 0));
    const draftRoomImagesJson = JSON.stringify(
      clampListingImageUrls((body as { imageUrls?: unknown }).imageUrls),
    );
    const occFields = roomOccupancyFieldsFromBody(body);

    try {
      const createdAt = new Date().toISOString();
      db.prepare(
        `INSERT INTO rooms (
          id, property_id, status, title, rent_mxn, rooms_available, tags_json, roommate_gender_pref,
          age_min, age_max, summary, lodging_type, available_from, minimal_stay_months, room_dimension,
          aval_required, sublet_allowed, sort_order, deposit_mxn, image_urls_json, created_at, updated_at,
          custom_name, occupancy_status, occupant_gender, occupant_age, occupant_women_count, occupant_men_count
        ) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        roomId,
        propertyId,
        occFields.customName || rTitle,
        rentMxn,
        roomsAvailable,
        JSON.stringify(tags),
        body.roommateGenderPref,
        ageMin,
        ageMax,
        rSummary,
        lodgingType ?? null,
        availableFrom ?? null,
        minimalStayMonths,
        roomDimension,
        avalRequired === true ? 1 : avalRequired === false ? 0 : null,
        subletAllowed === true ? 1 : subletAllowed === false ? 0 : null,
        maxSort,
        depositMxn,
        draftRoomImagesJson,
        createdAt,
        createdAt,
        occFields.customName,
        occFields.occupancyStatus,
        occFields.occupantGender,
        occFields.occupantAge,
        occFields.occupantWomenCount,
        occFields.occupantMenCount,
      );
    } catch {
      res.status(409).json({ error: "conflict" });
      return;
    }

    const row = db.prepare("SELECT * FROM rooms WHERE id = ?").get(roomId) as Record<string, unknown>;
    const publisherId = String(prop.publisher_id ?? "");
    if (publisherId) {
      void import("./notificationsSchema.js").then(({ notifyPublisher }) => {
        notifyPublisher(db, publisherId, {
          text: `Tu nuevo anuncio de Cuarto '${String(occFields.customName || rTitle).slice(0, 80)}' se ha creado. No olvides publicarlo.`,
          link: "/publicar",
        });
      });
    }
    res.status(201).json(rowToRoom(row));
  });

  /** Update a draft room (wizard autosave). */
  r.patch("/:id/rooms/:roomId", jsonMw, (req: Request, res: Response) => {
    if (!hasPublisherOrAdminSession(db, req)) {
      res.status(401).json({ error: "publisher_session_required" });
      return;
    }
    const propertyId = resolvePropertyIdFromRouteParam(db, String(req.params.id ?? ""));
    const roomId = resolveRoomIdFromRouteParam(db, String(req.params.roomId ?? ""));
    if (!propertyId || !roomId) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const prop = db.prepare("SELECT * FROM properties WHERE id = ?").get(propertyId) as Record<string, unknown> | undefined;
    if (!prop || !canWritePropertyByRequest(db, req, String(prop.publisher_id))) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const roomRow = db
      .prepare("SELECT * FROM rooms WHERE id = ? AND property_id = ?")
      .get(roomId, propertyId) as Record<string, unknown> | undefined;
    if (!roomRow) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const roomSt = String(roomRow.status) as ListingStatus;
    if (roomSt !== "draft" && roomSt !== "published" && roomSt !== "paused") {
      res.status(400).json({ error: "only_draft_room_editable", message: "Only draft, published, or paused rooms can be edited here." });
      return;
    }

    const body = req.body as Partial<Room> & { depositMxn?: unknown; imageUrls?: unknown };
    let title = clampStr(String(roomRow.title), ROOM_TITLE_MAX_LEN) || "Cuarto en borrador";
    if (typeof body.title === "string") {
      const t = clampStr(body.title, ROOM_TITLE_MAX_LEN);
      if (t) title = t;
    }
    let summary = clampStr(String(roomRow.summary ?? ""), SUMMARY_MAX_LEN);
    if (typeof body.summary === "string") summary = clampStr(body.summary, SUMMARY_MAX_LEN);

    const rentMxn =
      typeof body.rentMxn === "number" ? clampRentMxn(body.rentMxn) : clampRentMxn(Number(roomRow.rent_mxn));
    const roomsAvailable =
      typeof body.roomsAvailable === "number"
        ? clampRoomsAvailable(body.roomsAvailable)
        : clampRoomsAvailable(Number(roomRow.rooms_available));
    let roommateGenderPref = String(roomRow.roommate_gender_pref);
    if (typeof body.roommateGenderPref === "string" && isRoommateGenderPref(body.roommateGenderPref)) {
      roommateGenderPref = body.roommateGenderPref;
    }
    const ageMin = typeof body.ageMin === "number" ? clampAge(body.ageMin, 18) : clampAge(Number(roomRow.age_min), 18);
    const ageMax = typeof body.ageMax === "number" ? clampAge(body.ageMax, 99) : clampAge(Number(roomRow.age_max), 99);
    if (ageMin > ageMax) {
      res.status(400).json({ error: "invalid_age_range" });
      return;
    }

    let tagsJson = String(roomRow.tags_json);
    if (Array.isArray(body.tags)) {
      const tags = body.tags.filter((t): t is ListingTag => typeof t === "string" && isListingTag(t));
      if (tags.length !== body.tags.length) {
        res.status(400).json({ error: "invalid_tags" });
        return;
      }
      tagsJson = JSON.stringify(tags);
    }

    const lodgingType = body.lodgingType != null ? optLodging(body.lodgingType) : optLodging(roomRow.lodging_type);
    const availableFrom =
      body.availableFrom !== undefined ? optIsoDate(body.availableFrom) : optIsoDate(roomRow.available_from);
    const rowMinStay = optPositiveInt(Number(roomRow.minimal_stay_months)) ?? 1;
    const minimalStayMonths =
      body.minimalStayMonths !== undefined
        ? optPositiveInt(body.minimalStayMonths) ?? rowMinStay
        : rowMinStay;
    const roomDimension =
      body.roomDimension !== undefined ? optDim(body.roomDimension) ?? "medium" : optDim(roomRow.room_dimension) ?? "medium";
    const avalRequired = body.avalRequired !== undefined ? optBool(body.avalRequired) : optBool(roomRow.aval_required);
    const subletAllowed = body.subletAllowed !== undefined ? optBool(body.subletAllowed) : optBool(roomRow.sublet_allowed);
    const depositMxn =
      typeof body.depositMxn === "number"
        ? clampDepositMxn(body.depositMxn)
        : clampDepositMxn(Number(roomRow.deposit_mxn ?? 0));
    const imageUrlsJson =
      body.imageUrls !== undefined
        ? JSON.stringify(clampListingImageUrls(body.imageUrls))
        : String(roomRow.image_urls_json ?? "[]");

    const occFields = roomOccupancyFieldsFromBody(body);
    const patchCustomName =
      body.customName !== undefined
        ? occFields.customName
        : roomRow.custom_name != null
          ? String(roomRow.custom_name)
          : null;
    const patchOccupancy =
      body.occupancyStatus !== undefined
        ? occFields.occupancyStatus
        : optOccupancyStatus(roomRow.occupancy_status);
    const patchOccupantGender =
      body.occupantGender !== undefined
        ? occFields.occupantGender
        : roomRow.occupant_gender != null
          ? String(roomRow.occupant_gender)
          : null;
    const patchOccupantAge =
      body.occupantAge !== undefined
        ? occFields.occupantAge
        : roomRow.occupant_age != null && Number.isFinite(Number(roomRow.occupant_age))
          ? Math.floor(Number(roomRow.occupant_age))
          : null;
    const patchOccupantWomen =
      body.occupantWomenCount !== undefined
        ? occFields.occupantWomenCount
        : roomRow.occupant_women_count != null && Number.isFinite(Number(roomRow.occupant_women_count))
          ? Math.max(0, Math.floor(Number(roomRow.occupant_women_count)))
          : null;
    const patchOccupantMen =
      body.occupantMenCount !== undefined
        ? occFields.occupantMenCount
        : roomRow.occupant_men_count != null && Number.isFinite(Number(roomRow.occupant_men_count))
          ? Math.max(0, Math.floor(Number(roomRow.occupant_men_count)))
          : null;
    const patchTitle = patchCustomName || title;

    db.prepare(
      `UPDATE rooms SET
        title = ?, rent_mxn = ?, rooms_available = ?, tags_json = ?, roommate_gender_pref = ?,
        age_min = ?, age_max = ?, summary = ?, lodging_type = ?, available_from = ?,
        minimal_stay_months = ?, room_dimension = ?, aval_required = ?, sublet_allowed = ?, deposit_mxn = ?,
        image_urls_json = ?, custom_name = ?, occupancy_status = ?, occupant_gender = ?, occupant_age = ?,
        occupant_women_count = ?, occupant_men_count = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    ).run(
      patchTitle,
      rentMxn,
      roomsAvailable,
      tagsJson,
      roommateGenderPref,
      ageMin,
      ageMax,
      summary,
      lodgingType ?? null,
      availableFrom ?? null,
      minimalStayMonths,
      roomDimension,
      avalRequired === true ? 1 : avalRequired === false ? 0 : null,
      subletAllowed === true ? 1 : subletAllowed === false ? 0 : null,
      depositMxn,
      imageUrlsJson,
      patchCustomName,
      patchOccupancy,
      patchOccupantGender,
      patchOccupantAge,
      patchOccupantWomen,
      patchOccupantMen,
      roomId,
    );

    const updated = db.prepare("SELECT * FROM rooms WHERE id = ?").get(roomId) as Record<string, unknown>;
    res.json(rowToRoom(updated));
  });

  /** Delete a draft room (wizard removed a room). */
  r.delete("/:id/rooms/:roomId", (req: Request, res: Response) => {
    if (!hasPublisherOrAdminSession(db, req)) {
      res.status(401).json({ error: "publisher_session_required" });
      return;
    }
    const propertyId = resolvePropertyIdFromRouteParam(db, String(req.params.id ?? ""));
    const roomId = resolveRoomIdFromRouteParam(db, String(req.params.roomId ?? ""));
    if (!propertyId || !roomId) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const prop = db.prepare("SELECT * FROM properties WHERE id = ?").get(propertyId) as Record<string, unknown> | undefined;
    if (!prop || !canWritePropertyByRequest(db, req, String(prop.publisher_id))) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const roomRow = db
      .prepare("SELECT * FROM rooms WHERE id = ? AND property_id = ?")
      .get(roomId, propertyId) as Record<string, unknown> | undefined;
    if (!roomRow) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (String(roomRow.status) !== "draft") {
      res.status(400).json({ error: "only_draft_room_deletable" });
      return;
    }
    db.prepare("DELETE FROM rooms WHERE id = ?").run(roomId);
    res.status(204).end();
  });

  /** Update property fields and/or status (pause cascades to rooms). */
  r.patch("/:id", jsonMw, (req: Request, res: Response) => {
    if (!hasPublisherOrAdminSession(db, req)) {
      res.status(401).json({ error: "publisher_session_required" });
      return;
    }
    const propertyId = resolvePropertyIdFromRouteParam(db, String(req.params.id ?? ""));
    if (!propertyId) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const prop = db.prepare("SELECT * FROM properties WHERE id = ?").get(propertyId) as Record<string, unknown> | undefined;
    if (!prop) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (!canWritePropertyByRequest(db, req, String(prop.publisher_id))) {
      res.status(403).json({ error: "not_owner" });
      return;
    }
    const publisherId = readPublisherIdFromRequest(req);
    const actingAsAdmin = isAdminRequest(db, req);

    const patch = req.body as {
      status?: unknown;
      postMode?: unknown;
      title?: unknown;
      summary?: unknown;
      city?: unknown;
      neighborhood?: unknown;
      lat?: unknown;
      lng?: unknown;
      contactWhatsApp?: unknown;
      propertyKind?: unknown;
      bedroomsTotal?: unknown;
      bathrooms?: unknown;
      showWhatsApp?: unknown;
      hidePricing?: unknown;
      imageUrls?: unknown;
      isApproximateLocation?: unknown;
      approximateRadiusMeters?: unknown;
      occupiedByWomenCount?: unknown;
      occupiedByMenCount?: unknown;
      streetViewPov?: unknown;
      wizardStep?: unknown;
      posthogSessionId?: unknown;
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
    const nextCity = clampStr(
      typeof patch.city === "string" ? patch.city : String(prop.city),
      CITY_MAX_LEN,
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
    const nextShowWhatsappEarly =
      patch.showWhatsApp !== undefined
        ? optBool(patch.showWhatsApp) !== false
        : !(prop.show_whatsapp === 0 || prop.show_whatsapp === false);
    const nextWaRaw =
      typeof patch.contactWhatsApp === "string" ? patch.contactWhatsApp : String(prop.contact_whatsapp);
    const nextWa = storedContactWhatsApp(nextShowWhatsappEarly, nextWaRaw);
    let nextShowWhatsapp = nextShowWhatsappEarly ? 1 : 0;
    const nextPk = patch.propertyKind != null ? optPropertyKind(patch.propertyKind) : optPropertyKind(prop.property_kind);

    if (!nextTitle || !nextCity || !nextHood) {
      res.status(400).json({
        error: "invalid_body",
        message: "Title, city, and neighborhood cannot be empty.",
      });
      return;
    }

    const nextStatus = patch.status != null ? (patch.status as ListingStatus) : curStatus;
    if (nextStatus === "published" && !contactWhatsAppOkForPublish(nextShowWhatsappEarly, nextWa)) {
      res.status(400).json({ error: "invalid_whatsapp", message: "WhatsApp inválido." });
      return;
    }

    if (patch.status === "published" && curStatus === "draft") {
      const userId = readAuthUserId(req);
      if (!userId) {
        res.status(401).json({
          error: "auth_required",
          message:
            "Tu anuncio ya está creado como borrador. Para activarlo, inicia sesión o crea una cuenta.",
        });
        return;
      }
      if (!actingAsAdmin && (!publisherId || !publisherLinkedToUser(db, publisherId, userId))) {
        res.status(403).json({
          error: "publisher_not_linked",
          message:
            "Esta publicación pertenece a otra sesión. Entra en la cuenta correcta para activarla.",
        });
        return;
      }
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
      const curMode = String(prop.post_mode ?? "property") === "room" ? "room" : "property";
      const nextMode =
        patch.postMode != null && typeof patch.postMode === "string" && patch.postMode === "property"
          ? "property"
          : curMode;
      if (nextMode !== "room" && !minimalPropertySummaryOk(nextSummary)) {
        res.status(400).json({
          error: "invalid_body",
          message: `Property description must be at least ${PROPERTY_SUMMARY_MIN_LEN} characters before publishing.`,
        });
        return;
      }
      const rentRooms = db
        .prepare("SELECT summary, occupancy_status FROM rooms WHERE property_id = ?")
        .all(propertyId) as { summary: string | null; occupancy_status: string | null }[];
      for (const row of rentRooms) {
        if (String(row.occupancy_status ?? "") === "occupied") continue;
        if (!minimalRoomSummaryOk(String(row.summary ?? ""))) {
          res.status(400).json({
            error: "invalid_body",
            message: `Each room description must be at least ${ROOM_SUMMARY_MIN_LEN} characters before publishing.`,
          });
          return;
        }
      }
    }

    const nextBed =
      typeof patch.bedroomsTotal === "number"
        ? clampBedroomsTotal(patch.bedroomsTotal)
        : clampBedroomsTotal(Number(prop.bedrooms_total ?? 1));
    const nextBath =
      typeof patch.bathrooms === "number"
        ? clampBathrooms(patch.bathrooms)
        : clampBathrooms(Number(prop.bathrooms ?? 1));
    const nextHidePricing =
      patch.hidePricing !== undefined
        ? optBool(patch.hidePricing) === true
        : Number(prop.hide_pricing) === 1;
    if (hidePricingContactRequired(nextStatus)) {
      const hidePricingShow = resolveShowWhatsappForHidePricing({
        hidePricing: nextHidePricing,
        showWhatsapp: nextShowWhatsapp,
        hasPublicPhone: propertyHasPublicPhone(nextShowWhatsapp, nextWa),
        hasChat: !isUnclaimedAdminOutreach(db, propertyId),
        hasStoredPhone: isRealListingPhone(nextWa),
      });
      if (!hidePricingShow.ok) {
        res.status(400).json({ error: "hide_pricing_contact", message: HIDE_PRICING_CONTACT_MESSAGE });
        return;
      }
      nextShowWhatsapp = hidePricingShow.showWhatsapp;
    }

    const nextImageUrlsJson =
      patch.imageUrls !== undefined
        ? JSON.stringify(clampListingImageUrls(patch.imageUrls))
        : String(prop.image_urls_json ?? "[]");

    const nextIsApprox =
      patch.isApproximateLocation !== undefined
        ? optBool(patch.isApproximateLocation)
          ? 1
          : 0
        : Number(prop.is_approximate_location) ? 1 : 0;

    const nextApproxRadius =
      nextIsApprox === 0
        ? null
        : approximateRadiusMetersForStorage(
            true,
            patch.approximateRadiusMeters !== undefined
              ? patch.approximateRadiusMeters
              : prop.approximate_radius_m,
          );

    const nextOccW =
      patch.occupiedByWomenCount !== undefined
        ? occupantCountOrNull(patch.occupiedByWomenCount)
        : prop.occupied_by_women == null || !Number.isFinite(Number(prop.occupied_by_women))
          ? null
          : Math.max(0, Math.min(500, Math.floor(Number(prop.occupied_by_women))));
    const nextOccM =
      patch.occupiedByMenCount !== undefined
        ? occupantCountOrNull(patch.occupiedByMenCount)
        : prop.occupied_by_men == null || !Number.isFinite(Number(prop.occupied_by_men))
          ? null
          : Math.max(0, Math.min(500, Math.floor(Number(prop.occupied_by_men))));

    let nextStreetViewPovJson: string | null =
      prop.street_view_pov_json != null && String(prop.street_view_pov_json).trim()
        ? String(prop.street_view_pov_json)
        : null;
    if (patch.streetViewPov !== undefined) {
      try {
        const povBody = streetViewPovFromBody(patch.streetViewPov);
        nextStreetViewPovJson = serializeStreetViewPovJson(povBody ?? undefined);
      } catch {
        res.status(400).json({ error: "invalid_street_view_pov" });
        return;
      }
    }

    const curMode = String(prop.post_mode ?? "property") === "room" ? "room" : "property";
    const nextMode =
      patch.postMode != null && typeof patch.postMode === "string"
        ? patch.postMode === "room"
          ? "room"
          : patch.postMode === "property"
            ? "property"
            : curMode
        : curMode;

    const nextWizardStep =
      patch.wizardStep !== undefined
        ? (optWizardStep(patch.wizardStep) ?? null)
        : prop.wizard_step != null && Number.isFinite(Number(prop.wizard_step))
          ? Math.floor(Number(prop.wizard_step))
          : null;
    const nextPosthogSessionId =
      patch.posthogSessionId !== undefined
        ? (() => {
            const incoming = optPosthogSessionId(patch.posthogSessionId);
            const existing =
              prop.posthog_session_id != null && String(prop.posthog_session_id).trim()
                ? String(prop.posthog_session_id).trim()
                : null;
            // Prefer the first session captured during draft creation; don't overwrite.
            return existing ?? incoming ?? null;
          })()
        : prop.posthog_session_id != null && String(prop.posthog_session_id).trim()
          ? String(prop.posthog_session_id).trim()
          : null;

    const nextPublishedAt =
      nextStatus === "published" &&
      (prop.published_at == null || String(prop.published_at).trim() === "")
        ? new Date().toISOString()
        : prop.published_at != null && String(prop.published_at).trim()
          ? String(prop.published_at)
          : null;
    const firstPublish = isFirstPropertyPublish(
      curStatus,
      prop.published_at != null && String(prop.published_at).trim() ? String(prop.published_at) : null,
      nextStatus,
    );

    const curPausedBy =
      prop.paused_by != null && String(prop.paused_by).trim() ? String(prop.paused_by).trim() : null;
    if (!actingAsAdmin && patch.status != null) {
      const uid = readAuthUserId(req);
      if (uid && isUserPublisherBlocked(db, uid)) {
        res.status(403).json({ error: "publisher_blocked" });
        return;
      }
      if (curPausedBy === "admin" && patch.status === "published") {
        res.status(403).json({
          error: "admin_pause_locked",
          message: "Este anuncio fue pausado por Bestie. Envíalo a revisión o contacta soporte.",
        });
        return;
      }
      if (patch.status === "pending_review" && curStatus === "paused" && curPausedBy === "admin") {
        submitPropertyForReview(db, propertyId);
        const updatedEarly = db.prepare("SELECT * FROM properties WHERE id = ?").get(propertyId) as Record<
          string,
          unknown
        >;
        res.json(rowToProperty(updatedEarly));
        return;
      }
    }

    let nextPausedBy: string | null = curPausedBy;
    if (actingAsAdmin) {
      if (nextStatus === "paused") nextPausedBy = "admin";
      else if (nextStatus === "published") nextPausedBy = null;
    } else if (patch.status != null) {
      if (nextStatus === "paused" && curStatus === "published") nextPausedBy = "publisher";
      else if (nextStatus === "published" && curPausedBy === "publisher") nextPausedBy = null;
    }

    db.prepare(
      `UPDATE properties SET
        status = ?,
        paused_by = ?,
        post_mode = ?,
        title = ?, summary = ?, city = ?, neighborhood = ?, lat = ?, lng = ?,
        contact_whatsapp = ?, property_kind = ?,
        bedrooms_total = ?, bathrooms = ?, show_whatsapp = ?, hide_pricing = ?, image_urls_json = ?, is_approximate_location = ?,
        approximate_radius_m = ?,
        occupied_by_women = ?, occupied_by_men = ?, street_view_pov_json = ?,
        wizard_step = ?, posthog_session_id = ?, published_at = ?
      WHERE id = ?`,
    ).run(
      nextStatus,
      nextPausedBy,
      nextMode,
      nextTitle,
      nextSummary,
      nextCity,
      nextHood,
      nextLat,
      nextLng,
      nextWa,
      nextPk ?? null,
      nextBed,
      nextBath,
      nextShowWhatsapp,
      nextHidePricing ? 1 : 0,
      nextImageUrlsJson,
      nextIsApprox,
      nextApproxRadius,
      nextOccW,
      nextOccM,
      nextStreetViewPovJson,
      nextWizardStep,
      nextPosthogSessionId,
      nextPublishedAt,
      propertyId,
    );

    if (patch.status === "published" && curStatus === "draft") {
      db.prepare(`UPDATE rooms SET status = 'published', updated_at = CURRENT_TIMESTAMP WHERE property_id = ? AND status = 'draft'`).run(
        propertyId,
      );
    }

    if (patch.status === "paused" || patch.status === "archived") {
      const rStatus = patch.status === "archived" ? "archived" : "paused";
      const rPausedBy = !actingAsAdmin && patch.status === "paused" ? "publisher" : nextPausedBy;
      db.prepare(
        "UPDATE rooms SET status = ?, paused_by = ?, updated_at = CURRENT_TIMESTAMP WHERE property_id = ? AND status != 'archived'",
      ).run(rStatus, rPausedBy, propertyId);
    }
    if (patch.status === "published" && curStatus === "paused") {
      db.prepare(
        "UPDATE rooms SET status = 'published', paused_by = NULL, updated_at = CURRENT_TIMESTAMP WHERE property_id = ? AND status = 'paused'",
      ).run(propertyId);
    }
    if (patch.status === "pending_review") {
      db.prepare(
        `UPDATE rooms SET status = 'pending_review', updated_at = CURRENT_TIMESTAMP WHERE property_id = ? AND status IN ('paused', 'pending_review')`,
      ).run(propertyId);
    }
    if (
      patch.status === "published" &&
      (curStatus === "published" || curStatus === "paused")
    ) {
      db.prepare(
        `UPDATE rooms SET status = 'published', updated_at = CURRENT_TIMESTAMP WHERE property_id = ? AND status IN ('draft', 'paused')`,
      ).run(propertyId);
    }

    const updated = db.prepare("SELECT * FROM properties WHERE id = ?").get(propertyId) as Record<string, unknown>;

    if (patch.status === "published" && curStatus !== "published") {
      const roomIds = db
        .prepare(`SELECT id FROM rooms WHERE property_id = ? AND status = 'published'`)
        .all(propertyId) as { id: string }[];
      void import("./savedSearchNotify.js").then(({ onRoomPublished }) => {
        for (const { id } of roomIds) {
          void onRoomPublished(db, id);
        }
      });
      const pub = String(updated.publisher_id ?? "");
      const title = String(updated.title ?? "tu propiedad");
      if (pub) {
        void import("./notificationsSchema.js").then(({ notifyPublisher }) => {
          notifyPublisher(db, pub, {
            text: `Has publicado exitosamente tu anuncio de Propiedad '${title.slice(0, 80)}'.`,
            link: "/mis-anuncios",
          });
        });
      }
    }
    if (firstPublish) scheduleNotifyOpsNewPostPublished(db, propertyId);

    res.json(rowToProperty(updated));
  });

  return r;
}

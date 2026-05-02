import type {
  ListingStatus,
  LodgingType,
  PropertyKind,
  PropertyListing,
  RoomDimension,
} from "./types.js";
import { clampListingImageUrls } from "./validation.js";

function imageUrlsFromCell(raw: unknown): string[] {
  try {
    return clampListingImageUrls(JSON.parse(String(raw ?? "[]")));
  } catch {
    return [];
  }
}

function listingStatusFromRow(v: unknown): ListingStatus {
  const s = String(v ?? "published");
  if (s === "draft" || s === "published" || s === "paused" || s === "archived") return s;
  return "published";
}

function int01(v: unknown): boolean | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return n !== 0;
}

function optLodging(v: unknown): LodgingType | undefined {
  const s = String(v ?? "");
  if (s === "whole_home" || s === "private_room" || s === "shared_room") return s;
  return undefined;
}

function optPropertyKind(v: unknown): PropertyKind | undefined {
  const s = String(v ?? "");
  if (s === "house" || s === "apartment" || s === "loft") return s;
  return undefined;
}

function optDim(v: unknown): RoomDimension | undefined {
  const s = String(v ?? "");
  if (s === "small" || s === "medium" || s === "large") return s;
  return undefined;
}

/** Maps a joined `rooms` + `properties` row (see SQL aliases in repositories). */
export function joinRowToPropertyListing(row: Record<string, unknown>): PropertyListing {
  const postMode: PropertyListing["propertyPostMode"] =
    String(row.post_mode ?? "property") === "room" ? "room" : "property";
  const publisherRaw = row.publisher_id;
  const publisherId =
    publisherRaw != null && String(publisherRaw).trim() !== ""
      ? String(publisherRaw)
      : undefined;

  const lodgingType = optLodging(row.lodging_type);
  const propertyKind = optPropertyKind(row.property_kind);
  const availableFrom =
    row.available_from != null && String(row.available_from).trim() !== ""
      ? String(row.available_from).trim()
      : undefined;
  const minimalStayRaw = row.minimal_stay_months;
  const minimalStayMonths =
    minimalStayRaw != null && Number.isFinite(Number(minimalStayRaw))
      ? Number(minimalStayRaw)
      : undefined;
  const roomDimension = optDim(row.room_dimension);
  const avalRequired = int01(row.aval_required);
  const subletAllowed = int01(row.sublet_allowed);

  const propertyTitle = String(row.property_title ?? "");
  const roomListingTitle = String(row.room_listing_title ?? "");
  const displayTitle =
    roomListingTitle.trim() !== ""
      ? `${propertyTitle} · ${roomListingTitle}`.trim()
      : propertyTitle;

  const depositMxn = row.deposit_mxn != null && Number.isFinite(Number(row.deposit_mxn)) ? Number(row.deposit_mxn) : 0;
  const bedroomsTotal =
    row.bedrooms_total != null && Number.isFinite(Number(row.bedrooms_total)) ? Number(row.bedrooms_total) : 1;
  const bathrooms = row.bathrooms != null && Number.isFinite(Number(row.bathrooms)) ? Number(row.bathrooms) : 1;
  const showWaRaw = row.show_whatsapp;
  const showWhatsApp =
    showWaRaw === 0 || showWaRaw === false || showWaRaw === "0" ? false : true;

  const propertyImageUrls = imageUrlsFromCell(row.property_image_urls_json);
  const roomImageUrls = imageUrlsFromCell(row.room_image_urls_json);

  return {
    id: String(row.id),
    propertyId: String(row.property_id),
    propertyTitle: propertyTitle.trim() || undefined,
    propertyStatus: listingStatusFromRow(row.property_status),
    propertyPostMode: postMode,
    title: displayTitle,
    city: String(row.city),
    neighborhood: String(row.neighborhood),
    lat: Number(row.lat),
    lng: Number(row.lng),
    rentMxn: Number(row.rent_mxn),
    depositMxn,
    propertyBedroomsTotal: bedroomsTotal,
    propertyBathrooms: bathrooms,
    showWhatsApp,
    roomsAvailable: Number(row.rooms_available),
    tags: JSON.parse(String(row.tags_json)) as PropertyListing["tags"],
    roommateGenderPref: String(row.roommate_gender_pref) as PropertyListing["roommateGenderPref"],
    ageMin: Number(row.age_min),
    ageMax: Number(row.age_max),
    summary: String(row.summary),
    contactWhatsApp: String(row.contact_whatsapp),
    status: listingStatusFromRow(row.status),
    ...(row.created_at ? { createdAt: String(row.created_at) } : {}),
    ...(row.updated_at || row.created_at
      ? { updatedAt: String(row.updated_at ?? row.created_at) }
      : {}),
    ...(publisherId ? { publisherId } : {}),
    ...(lodgingType ? { lodgingType } : {}),
    ...(propertyKind ? { propertyKind } : {}),
    ...(availableFrom ? { availableFrom } : {}),
    ...(minimalStayMonths != null ? { minimalStayMonths } : {}),
    ...(roomDimension ? { roomDimension } : {}),
    ...(avalRequired !== undefined ? { avalRequired } : {}),
    ...(subletAllowed !== undefined ? { subletAllowed } : {}),
    ...(propertyImageUrls.length ? { propertyImageUrls } : {}),
    ...(roomImageUrls.length ? { roomImageUrls } : {}),
    ...(int01(row.is_approximate_location) ? { isApproximateLocation: true } : {}),
  };
}

export const ROOM_PROPERTY_JOIN_SQL = `
SELECT
  r.id AS id,
  r.status AS status,
  r.title AS room_listing_title,
  p.id AS property_id,
  p.title AS property_title,
  p.post_mode AS post_mode,
  r.rent_mxn AS rent_mxn,
  r.rooms_available AS rooms_available,
  r.tags_json AS tags_json,
  r.roommate_gender_pref AS roommate_gender_pref,
  r.age_min AS age_min,
  r.age_max AS age_max,
  r.summary AS summary,
  r.lodging_type AS lodging_type,
  r.available_from AS available_from,
  r.minimal_stay_months AS minimal_stay_months,
  r.room_dimension AS room_dimension,
  r.aval_required AS aval_required,
  r.sublet_allowed AS sublet_allowed,
  p.city AS city,
  p.neighborhood AS neighborhood,
  p.lat AS lat,
  p.lng AS lng,
  p.contact_whatsapp AS contact_whatsapp,
  p.publisher_id AS publisher_id,
  p.property_kind AS property_kind,
  p.status AS property_status,
  p.bedrooms_total AS bedrooms_total,
  p.bathrooms AS bathrooms,
  p.show_whatsapp AS show_whatsapp,
  r.deposit_mxn AS deposit_mxn,
  p.image_urls_json AS property_image_urls_json,
  r.image_urls_json AS room_image_urls_json,
  r.created_at AS created_at,
  r.updated_at AS updated_at,
  p.is_approximate_location AS is_approximate_location
FROM rooms r
INNER JOIN properties p ON p.id = r.property_id
`;

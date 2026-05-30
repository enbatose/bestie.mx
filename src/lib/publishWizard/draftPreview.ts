import type { Draft, RoomDraft } from "@/pages/PublishWizardPage";
import type { PropertyListing, PropertyWithRooms } from "@/types/listing";
import {
  CITY_ANCHOR,
  draftPropertyImageUrls,
  draftRoomImageUrls,
  effectiveRoomTitle,
  effectiveRoomsAvailable,
  mergedRoomTagsForPayload,
  resolveLatLngForDraft,
  resolveListingContactForApi,
} from "@/lib/publishWizard/publishCore";
import { normalizeRoomDraft } from "@/lib/publishWizard/normalizeRoomDraft";

const PREVIEW_PROPERTY_ID = "preview-property";

export function draftToPropertyWithRooms(
  draft: Draft,
  profilePhoneE164?: string | null,
): PropertyWithRooms {
  const { lat, lng } = resolveLatLngForDraft(draft);
  const anchor = CITY_ANCHOR[draft.city];
  const neighborhood = draft.neighborhood.trim() || anchor.neighborhood;
  const contact = resolveListingContactForApi(profilePhoneE164, draft);

  const property = {
    id: PREVIEW_PROPERTY_ID,
    publisherId: "preview",
    status: "draft" as const,
    postMode: draft.postMode,
    title: draft.propertyTitle.trim() || "Sin título",
    city: draft.city,
    neighborhood,
    lat,
    lng,
    summary: draft.propertySummary.trim(),
    contactWhatsApp: contact.showWhatsApp ? contact.contactWhatsApp : "",
    propertyKind: draft.propertyKind,
    bedroomsTotal: draft.propertyBedroomsTotal,
    bathrooms: draft.propertyBathrooms > 0 ? draft.propertyBathrooms : 1,
    showWhatsApp: contact.showWhatsApp,
    imageUrls: draftPropertyImageUrls(draft),
    commonAreaPhotos: draftPropertyImageUrls(draft),
    isApproximateLocation: draft.isApproximateLocation,
    ...(draft.streetViewPov ? { streetViewPov: draft.streetViewPov } : {}),
    occupiedByWomenCount: draft.occupiedByWomenCount,
    occupiedByMenCount: draft.occupiedByMenCount,
  };

  const rooms = draft.rooms.map((r, i) => roomDraftToRoom(normalizeRoomDraft(r), i, draft));

  return { property, rooms };
}

function roomDraftToRoom(r: RoomDraft, index: number, draft: Draft) {
  return {
    id: r.id || `preview-room-${index}`,
    propertyId: PREVIEW_PROPERTY_ID,
    status: "draft" as const,
    customName: r.customName?.trim() || undefined,
    occupancyStatus: r.occupancyStatus,
    occupantGender: r.occupantGender,
    occupantAge: r.occupantAge,
    title: effectiveRoomTitle(r, draft.postMode),
    rentMxn: Math.max(0, r.rentMxn),
    depositMxn: r.depositMxn,
    roomsAvailable: effectiveRoomsAvailable(draft, index),
    tags: mergedRoomTagsForPayload(draft, index),
    roommateGenderPref: r.roommateGenderPref,
    ageMin: r.ageMin,
    ageMax: r.ageMax,
    summary: r.summary.trim(),
    lodgingType: r.lodgingType,
    availableFrom: r.availableFrom,
    minimalStayMonths: r.minimalStayMonths,
    roomDimension: r.roomDimension,
    sortOrder: index,
    imageUrls: draftRoomImageUrls(draft, index),
  };
}

export function draftToListingPreview(
  draft: Draft,
  roomIndex: number,
  profilePhoneE164?: string | null,
): PropertyListing {
  const pack = draftToPropertyWithRooms(draft, profilePhoneE164);
  const room = pack.rooms[roomIndex] ?? pack.rooms[0];
  if (!room) {
    throw new Error("preview_requires_room");
  }
  const p = pack.property;
  return {
    id: room.id,
    propertyId: p.id,
    propertyTitle: p.title,
    propertyStatus: p.status,
    propertyPostMode: p.postMode,
    title: room.title,
    city: p.city,
    neighborhood: p.neighborhood,
    lat: p.lat,
    lng: p.lng,
    rentMxn: room.rentMxn,
    depositMxn: room.depositMxn,
    propertyBedroomsTotal: p.bedroomsTotal,
    propertyBathrooms: p.bathrooms,
    showWhatsApp: p.showWhatsApp,
    roomsAvailable: room.roomsAvailable,
    tags: room.tags,
    roommateGenderPref: room.roommateGenderPref,
    ageMin: room.ageMin,
    ageMax: room.ageMax,
    summary: room.summary,
    contactWhatsApp: p.contactWhatsApp,
    status: "draft",
    propertyImageUrls: p.imageUrls,
    roomImageUrls: room.imageUrls,
    lodgingType: room.lodgingType,
    propertyKind: p.propertyKind,
    availableFrom: room.availableFrom,
    minimalStayMonths: room.minimalStayMonths,
    roomDimension: room.roomDimension,
    isApproximateLocation: p.isApproximateLocation,
    ...(p.streetViewPov ? { streetViewPov: p.streetViewPov } : {}),
  };
}

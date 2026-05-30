import type { RoomDraft } from "@/pages/PublishWizardPage";
import { newRoomDraftId } from "@/lib/roomDisplay";
import type {
  ListingTag,
  LodgingType,
  RoomDimension,
  RoomOccupancyStatus,
  RoommateGenderPref,
} from "@/types/listing";

function isoDateLocal(): string {
  return new Date().toISOString().slice(0, 10);
}

function clampAge(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(99, Math.max(18, Math.floor(n)));
}

/** Backfill room slots saved before the property room-manager fields existed. */
export function normalizeRoomDraft(raw: Partial<RoomDraft> | undefined | null): RoomDraft {
  const r = raw ?? {};
  const title = typeof r.title === "string" ? r.title : "";
  const customName = typeof r.customName === "string" ? r.customName : title;
  const occupancyStatus: RoomOccupancyStatus =
    r.occupancyStatus === "occupied" ? "occupied" : "available";
  const roommateGenderPref: RoommateGenderPref =
    r.roommateGenderPref === "female" || r.roommateGenderPref === "male" || r.roommateGenderPref === "any"
      ? r.roommateGenderPref
      : "any";
  const occupantGender: RoommateGenderPref =
    r.occupantGender === "female" || r.occupantGender === "male" || r.occupantGender === "any"
      ? r.occupantGender
      : roommateGenderPref;
  const lodgingType: LodgingType =
    r.lodgingType === "shared_room" || r.lodgingType === "whole_home" || r.lodgingType === "private_room"
      ? r.lodgingType
      : "private_room";
  const roomDimension: RoomDimension =
    r.roomDimension === "small" || r.roomDimension === "large" || r.roomDimension === "medium"
      ? r.roomDimension
      : "medium";
  const ageMin = clampAge(typeof r.ageMin === "number" ? r.ageMin : 22, 22);
  let ageMax = clampAge(typeof r.ageMax === "number" ? r.ageMax : 45, 45);
  if (ageMax < ageMin) ageMax = ageMin;

  return {
    id: typeof r.id === "string" && r.id.trim() ? r.id.trim() : newRoomDraftId(),
    customName,
    occupancyStatus,
    occupantGender,
    occupantAge: clampAge(typeof r.occupantAge === "number" ? r.occupantAge : 25, 25),
    title,
    rentMxn: typeof r.rentMxn === "number" && Number.isFinite(r.rentMxn) ? r.rentMxn : 0,
    depositMxn: typeof r.depositMxn === "number" && Number.isFinite(r.depositMxn) ? r.depositMxn : 0,
    roomsAvailable:
      typeof r.roomsAvailable === "number" && Number.isFinite(r.roomsAvailable) && r.roomsAvailable >= 1
        ? r.roomsAvailable
        : 1,
    summary: typeof r.summary === "string" ? r.summary : "",
    tags: Array.isArray(r.tags) ? (r.tags as ListingTag[]) : [],
    roommateGenderPref,
    ageMin,
    ageMax,
    lodgingType,
    availableFrom:
      typeof r.availableFrom === "string" && r.availableFrom.trim() ? r.availableFrom.trim() : isoDateLocal(),
    minimalStayMonths:
      typeof r.minimalStayMonths === "number" && Number.isFinite(r.minimalStayMonths) && r.minimalStayMonths >= 0
        ? r.minimalStayMonths
        : 1,
    roomDimension,
    rentIncludesUtilities: Boolean(r.rentIncludesUtilities),
  };
}

import type { Draft, RoomDraft } from "@/pages/PublishWizardPage";
import { isRoomAvailableForRent } from "@/lib/roomDisplay";
import type { LodgingType, RoommateGenderPref } from "@/types/listing";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ROOM_SUMMARY_MIN = 100;
const ROOM_SUMMARY_MAX = 1500;
const VALID_ROOM_LODGING_TYPES = ["private_room", "shared_room"] as const;
const VALID_ROOMMATE_GENDER_PREFS: readonly RoommateGenderPref[] = ["any", "female", "male"];

const GENERIC_NUMBERED_ROOM_TITLE = /^(recámara|habitación)\s+\d+$/i;

/** Standalone room listing (not a property with numbered recámaras). */
export function isStandaloneRoomPost(d: Pick<Draft, "postMode">): boolean {
  return d.postMode === "room";
}

/** Label shown in accordion headers, validation errors, and photo sections. */
export function roomWizardLabel(
  d: Draft,
  room: RoomDraft,
  index: number,
  displayNumber?: number,
): string {
  const custom = room.customName?.trim() || room.title?.trim();
  if (custom) return custom;
  const n = displayNumber ?? index + 1;
  return d.postMode === "property" ? `Habitación ${n}` : `Recámara ${n}`;
}

/**
 * Native <select> option for property review / photo tagging.
 * Empty first-room titles must not show “Sin título”; numbered defaults must not repeat
 * as “Recámara 2: Recámara 2”.
 */
export function roomPreviewOptionLabel(
  room: Pick<RoomDraft, "title" | "customName">,
  index: number,
): string {
  const n = index + 1;
  const prefix = `Recámara ${n}`;
  const custom = room.customName?.trim() || room.title?.trim();
  if (!custom || GENERIC_NUMBERED_ROOM_TITLE.test(custom)) return prefix;
  return `${prefix}: ${custom}`;
}

export type RoomIssueSection = "occupants" | "header" | "details" | "description" | "tags";

export type RoomFieldIssue = {
  id: string;
  section: RoomIssueSection;
  message: string;
};

/** Structured missing/invalid fields for one room row. */
export function collectRoomFieldIssueDetails(
  d: Draft,
  room: RoomDraft,
  _index?: number,
): RoomFieldIssue[] {
  const issues: RoomFieldIssue[] = [];

  if (d.postMode === "property" && !isRoomAvailableForRent(room)) {
    const women = Math.max(0, Math.floor(room.occupantWomenCount ?? 0));
    const men = Math.max(0, Math.floor(room.occupantMenCount ?? 0));
    if (women > 12 || men > 12) {
      issues.push({
        id: "occupants-max",
        section: "occupants",
        message: "Máximo 12 personas por género en la recámara ocupada.",
      });
    }
    return issues;
  }

  const lodgingOk =
    d.postMode === "room"
      ? VALID_ROOM_LODGING_TYPES.includes(room.lodgingType as (typeof VALID_ROOM_LODGING_TYPES)[number])
      : room.lodgingType === "private_room" || room.lodgingType === "shared_room";
  if (!lodgingOk) {
    issues.push({
      id: "lodging",
      section: "details",
      message: "Elige el tipo de recámara (privada, compartida o vivienda completa).",
    });
  }

  if (!room.roomDimension) {
    issues.push({
      id: "dimension",
      section: "details",
      message: "Elige el tamaño de la recámara.",
    });
  }

  if (!Number.isFinite(room.rentMxn) || room.rentMxn <= 0) {
    issues.push({
      id: "rent",
      section: "header",
      message: "Indica la renta mensual en MXN. No se puede guardar en 0.",
    });
  }

  if (Number.isFinite(room.depositMxn) && room.depositMxn < 0) {
    issues.push({
      id: "deposit",
      section: "header",
      message: "El depósito no puede ser negativo.",
    });
  }

  if (!ISO_DATE.test(room.availableFrom.trim())) {
    issues.push({
      id: "availableFrom",
      section: "details",
      message: "Indica desde cuándo está disponible la recámara.",
    });
  }

  if (!Number.isFinite(room.minimalStayMonths) || room.minimalStayMonths < 1) {
    issues.push({
      id: "stay",
      section: "details",
      message: "Indica la estancia mínima en meses (al menos 1).",
    });
  }

  if (!VALID_ROOMMATE_GENDER_PREFS.includes(room.roommateGenderPref)) {
    issues.push({
      id: "gender",
      section: "details",
      message: "Elige la preferencia de convivencia.",
    });
  }

  if (room.ageMin < 18 || room.ageMax < 18 || room.ageMax > 99) {
    issues.push({
      id: "age",
      section: "details",
      message: "Revisa el rango de edad (18–99 años).",
    });
  } else if (room.ageMin > room.ageMax) {
    issues.push({
      id: "age-order",
      section: "details",
      message: "La edad mínima no puede ser mayor que la máxima.",
    });
  }

  const summaryTrim = room.summary.trim();
  if (!summaryTrim) {
    issues.push({
      id: "summary",
      section: "description",
      message: "Falta la descripción de la recámara (mínimo 100 caracteres).",
    });
  } else if (summaryTrim.length < ROOM_SUMMARY_MIN) {
    issues.push({
      id: "summary-short",
      section: "description",
      message: `La descripción debe tener al menos ${ROOM_SUMMARY_MIN} caracteres (ahora tiene ${summaryTrim.length}).`,
    });
  } else if (summaryTrim.length > ROOM_SUMMARY_MAX) {
    issues.push({
      id: "summary-long",
      section: "description",
      message: `La descripción no puede pasar de ${ROOM_SUMMARY_MAX} caracteres.`,
    });
  }

  return issues;
}

/** Human-readable missing/invalid field names for one room row. */
export function collectRoomFieldIssues(d: Draft, room: RoomDraft, _index: number): string[] {
  return collectRoomFieldIssueDetails(d, room, _index).map((issue) => issue.message);
}

export function roomValidationIssuesByIndex(d: Draft): string[][] {
  return d.rooms.map((room, i) => collectRoomFieldIssues(d, room, i));
}

export function firstRoomIndexWithIssues(d: Draft): number {
  const rows = roomValidationIssuesByIndex(d);
  return rows.findIndex((issues) => issues.length > 0);
}

export function roomsWithFieldIssues(d: Draft): Array<{
  index: number;
  label: string;
  issues: RoomFieldIssue[];
}> {
  const rows: Array<{ index: number; label: string; issues: RoomFieldIssue[] }> = [];
  for (let i = 0; i < d.rooms.length; i++) {
    const room = d.rooms[i]!;
    const issues = collectRoomFieldIssueDetails(d, room, i);
    if (!issues.length) continue;
    rows.push({ index: i, label: roomPreviewOptionLabel(room, i), issues });
  }
  return rows;
}

export function formatRoomsValidationMessage(d: Draft): string | null {
  const rows = roomsWithFieldIssues(d);
  if (!rows.length) return null;
  // Single-room posts have no room identity to distinguish — list only what to fix.
  if (isStandaloneRoomPost(d) && rows.length === 1) {
    return rows[0]!.issues.map((issue) => issue.message).join(" ");
  }
  return rows
    .map((row) => `${row.label}: ${row.issues.map((issue) => issue.message).join(" ")}`)
    .join(" ");
}

export function roomSaveIssuesHeading(d: Draft, prefix: string): string {
  return isStandaloneRoomPost(d)
    ? `${prefix} falta completar el anuncio.`
    : `${prefix} falta completar una o más recámaras.`;
}

export function roomSaveIssuesOpenLabel(_d: Draft, _roomLabel: string): string {
  return "Completar";
}

export function roomSaveIssuesPrimaryLabel(d: Draft, roomIndex: number): string {
  if (isStandaloneRoomPost(d)) return "Completar anuncio";
  const room = d.rooms[roomIndex];
  if (!room) return "Completar anuncio";
  return `Completar ${roomPreviewOptionLabel(room, roomIndex)}`;
}

export const PUBLISH_PREVIEW_HEADER_ID = "publish-preview-header";
export const PUBLISH_PREVIEW_ROOM_DETAILS_ID = "publish-preview-room-details";
export const PUBLISH_PREVIEW_ROOM_DESCRIPTION_ID = "publish-preview-room-description";
export const PUBLISH_PREVIEW_RENT_INPUT_ID = "publish-preview-rent";

/** First missing section to open on the inline preview (single-room posts). */
export function firstStandaloneRoomFixSection(d: Draft, room: RoomDraft): RoomIssueSection {
  return collectRoomFieldIssueDetails(d, room)[0]?.section ?? "header";
}

export function standaloneRoomFixAnchorId(section: RoomIssueSection): string {
  if (section === "details") return PUBLISH_PREVIEW_ROOM_DETAILS_ID;
  if (section === "description" || section === "tags") return PUBLISH_PREVIEW_ROOM_DESCRIPTION_ID;
  return PUBLISH_PREVIEW_HEADER_ID;
}

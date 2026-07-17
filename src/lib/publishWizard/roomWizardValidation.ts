import type { Draft, RoomDraft } from "@/pages/PublishWizardPage";
import { isRoomIdealParaTag } from "@/lib/listingTags";
import { isRoomAvailableForRent } from "@/lib/roomDisplay";
import type { LodgingType, RoommateGenderPref } from "@/types/listing";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ROOM_SUMMARY_MIN = 100;
const ROOM_SUMMARY_MAX = 1500;
const VALID_ROOM_LODGING_TYPES = ["private_room", "shared_room"] as const;
const VALID_ROOMMATE_GENDER_PREFS: readonly RoommateGenderPref[] = ["any", "female", "male"];

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

/** Human-readable missing/invalid field names for one room row. */
export function collectRoomFieldIssues(d: Draft, room: RoomDraft, _index: number): string[] {
  const issues: string[] = [];

  if (d.postMode === "property" && !isRoomAvailableForRent(room)) {
    const women = Math.max(0, Math.floor(room.occupantWomenCount ?? 0));
    const men = Math.max(0, Math.floor(room.occupantMenCount ?? 0));
    if (women + men < 1) {
      issues.push("Al menos 1 mujer u hombre en la recámara ocupada");
    }
    if (women > 12 || men > 12) {
      issues.push("Máximo 12 personas por género en la recámara");
    }
    return issues;
  }

  const lodgingOk =
    d.postMode === "room"
      ? VALID_ROOM_LODGING_TYPES.includes(room.lodgingType as (typeof VALID_ROOM_LODGING_TYPES)[number])
      : room.lodgingType === "private_room" || room.lodgingType === "shared_room";
  if (!lodgingOk) {
    issues.push("Tipo de recámara");
  }

  if (!room.roomDimension) {
    issues.push("Tamaño de la recámara");
  }

  if (!Number.isFinite(room.rentMxn) || room.rentMxn <= 0) {
    issues.push("Renta (MXN / mes)");
  }

  if (Number.isFinite(room.depositMxn) && room.depositMxn < 0) {
    issues.push("Depósito (MXN)");
  }

  if (!ISO_DATE.test(room.availableFrom.trim())) {
    issues.push("Disponible desde");
  }

  if (!Number.isFinite(room.minimalStayMonths) || room.minimalStayMonths < 1) {
    issues.push("Estancia mínima (meses)");
  }

  if (!VALID_ROOMMATE_GENDER_PREFS.includes(room.roommateGenderPref)) {
    issues.push("Preferencia de convivencia");
  }

  if (room.ageMin < 18 || room.ageMax < 18 || room.ageMax > 99) {
    issues.push("Edad mínima y máxima (18–99)");
  } else if (room.ageMin > room.ageMax) {
    issues.push("Edad mínima no mayor que la máxima");
  }

  const summaryTrim = room.summary.trim();
  if (!summaryTrim) {
    issues.push("Detalles de esta recámara");
  } else if (summaryTrim.length < ROOM_SUMMARY_MIN) {
    issues.push(`Detalles de esta recámara (mínimo ${ROOM_SUMMARY_MIN} caracteres)`);
  } else if (summaryTrim.length > ROOM_SUMMARY_MAX) {
    issues.push(`Detalles de esta recámara (máximo ${ROOM_SUMMARY_MAX} caracteres)`);
  }

  if (!room.tags.some((t) => isRoomIdealParaTag(t))) {
    issues.push("Ideal para (al menos una opción)");
  }

  return issues;
}

export function roomValidationIssuesByIndex(d: Draft): string[][] {
  return d.rooms.map((room, i) => collectRoomFieldIssues(d, room, i));
}

export function firstRoomIndexWithIssues(d: Draft): number {
  const rows = roomValidationIssuesByIndex(d);
  return rows.findIndex((issues) => issues.length > 0);
}

export function formatRoomsValidationMessage(d: Draft): string | null {
  const lines: string[] = [];
  for (let i = 0; i < d.rooms.length; i++) {
    const room = d.rooms[i]!;
    const issues = collectRoomFieldIssues(d, room, i);
    if (!issues.length) continue;
    lines.push(`${roomWizardLabel(d, room, i)}: ${issues.join("; ")}.`);
  }
  if (!lines.length) return null;
  if (lines.length === 1) return lines[0]!;
  return lines.join(" ");
}

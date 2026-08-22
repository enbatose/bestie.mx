import type { Room, RoomOccupancyStatus, RoommateGenderPref } from "@/types/listing";

export function newRoomDraftId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `rm_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function roomOccupancyStatus(
  room: Pick<Room, "occupancyStatus"> | { occupancyStatus?: RoomOccupancyStatus },
): RoomOccupancyStatus {
  return room.occupancyStatus === "occupied" ? "occupied" : "available";
}

export function isRoomAvailableForRent(
  room: Pick<Room, "occupancyStatus"> | { occupancyStatus?: RoomOccupancyStatus },
): boolean {
  return roomOccupancyStatus(room) === "available";
}

const GENERIC_NUMBERED_ROOM_TITLE = /^(recámara|habitación)\s+\d+$/i;

export function isGenericNumberedRoomTitle(value: string): boolean {
  return GENERIC_NUMBERED_ROOM_TITLE.test(value.trim());
}

export function propertyRoomSlotTitle(displayNumber: number): string {
  return `Recámara ${displayNumber}`;
}

/**
 * Title shown next to the pencil in the property-rooms wizard.
 * Generic “Habitación N” / “Recámara N” seeds all display as Recámara N.
 */
export function propertyRoomPencilTitle(
  room: { customName?: string; title?: string },
  displayNumber: number,
): string {
  const custom = room.customName?.trim() || room.title?.trim();
  if (custom && !isGenericNumberedRoomTitle(custom)) return custom;
  return propertyRoomSlotTitle(displayNumber);
}

export function roomDisplayName(
  room: { customName?: string; title?: string },
  index: number,
): string {
  const custom = room.customName?.trim();
  if (custom) return custom;
  const title = room.title?.trim();
  if (title && !/^recámara en borrador$/i.test(title) && title !== "Ocupada") return title;
  return `Habitación ${index + 1}`;
}

export function occupancyStatusLabel(status: RoomOccupancyStatus): string {
  return status === "occupied" ? "Ocupada" : "Disponible";
}

export function occupantGenderLabel(pref: RoommateGenderPref): string {
  switch (pref) {
    case "female":
      return "Mujer";
    case "male":
      return "Hombre";
    default:
      return "Sin especificar";
  }
}

/** Short label for collapsed occupied-room cards in the publish wizard. */
export function occupiedRoomOccupantSummary(
  room: { occupantWomenCount?: number; occupantMenCount?: number },
): string | null {
  const women = Math.max(0, Math.floor(room.occupantWomenCount ?? 0));
  const men = Math.max(0, Math.floor(room.occupantMenCount ?? 0));
  const parts: string[] = [];
  if (women > 0) parts.push(women === 1 ? "1 Mujer" : `${women} Mujeres`);
  if (men > 0) parts.push(men === 1 ? "1 Hombre" : `${men} Hombres`);
  return parts.length ? parts.join(", ") : null;
}

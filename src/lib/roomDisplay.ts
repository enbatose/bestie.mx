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

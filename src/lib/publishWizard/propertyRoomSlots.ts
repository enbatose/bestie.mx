import type { Draft, RoomDraft } from "@/pages/PublishWizardPage";
import type { RoomOccupancyStatus } from "@/types/listing";

/** Ensure one draft slot per bedroom; preserves stable room ids. */
export function syncPropertyRoomSlotsToTotal(d: Draft, createDefaultRoom: () => RoomDraft): Draft {
  if (d.postMode !== "property") return d;
  const total = Math.max(1, Math.floor(d.propertyBedroomsTotal));
  let rooms = [...d.rooms];
  let roomImageUrls = [...d.roomImageUrls];
  while (rooms.length < total) {
    rooms.push(createDefaultRoom());
    roomImageUrls.push([]);
  }
  if (rooms.length > total) {
    rooms = rooms.slice(0, total);
    roomImageUrls = roomImageUrls.slice(0, total);
  }
  return { ...d, propertyBedroomsTotal: total, rooms, roomImageUrls };
}

export function propertyRentRoomCount(d: Draft): number {
  return d.rooms.filter((room) => room.occupancyStatus !== "occupied").length;
}

export function propertyOccupiedRoomCount(d: Draft): number {
  return d.rooms.filter((room) => room.occupancyStatus === "occupied").length;
}

/** Mark the first `rentCount` slots available; the rest occupied. */
export function applyPropertyRentRoomCount(
  d: Draft,
  rentCount: number,
  createDefaultRoom: () => RoomDraft,
): Draft {
  const synced = syncPropertyRoomSlotsToTotal(d, createDefaultRoom);
  const total = synced.rooms.length;
  const target = Math.max(0, Math.min(total, Math.floor(rentCount)));
  const rooms = synced.rooms.map((room, index) => ({
    ...room,
    occupancyStatus: (index < target ? "available" : "occupied") as RoomOccupancyStatus,
  }));
  return { ...synced, rooms };
}

export function setRoomOccupancyStatus(d: Draft, roomIndex: number, status: RoomOccupancyStatus): Draft {
  if (roomIndex < 0 || roomIndex >= d.rooms.length) return d;
  return {
    ...d,
    rooms: d.rooms.map((room, i) => (i === roomIndex ? { ...room, occupancyStatus: status } : room)),
  };
}

export function derivedPropertyOccupantCounts(d: Draft): {
  occupiedByWomenCount: number;
  occupiedByMenCount: number;
} {
  let women = 0;
  let men = 0;
  for (const room of d.rooms) {
    if (room.occupancyStatus !== "occupied") continue;
    women += Math.max(0, Math.floor(room.occupantWomenCount ?? 0));
    men += Math.max(0, Math.floor(room.occupantMenCount ?? 0));
  }
  return { occupiedByWomenCount: women, occupiedByMenCount: men };
}

/** Backfill per-room occupant counts from legacy gender/age fields. */
export function hydrateRoomOccupantCounts(room: RoomDraft): RoomDraft {
  let women = room.occupantWomenCount;
  let men = room.occupantMenCount;
  if (women == null && men == null && room.occupancyStatus === "occupied") {
    if (room.occupantGender === "female") women = 1;
    else if (room.occupantGender === "male") men = 1;
    else {
      women = 0;
      men = 0;
    }
  }
  return {
    ...room,
    occupantWomenCount: Math.max(0, Math.floor(women ?? 0)),
    occupantMenCount: Math.max(0, Math.floor(men ?? 0)),
  };
}

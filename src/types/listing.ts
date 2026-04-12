export type RoommateGenderPref = "any" | "female" | "male";

export type ListingStatus = "draft" | "published" | "paused" | "archived";

export type LodgingType = "whole_home" | "private_room" | "shared_room";

export type PropertyKind = "house" | "apartment";

export type RoomDimension = "small" | "medium" | "large";

export type ListingTag =
  | "wifi"
  | "mascotas"
  | "estacionamiento"
  | "muebles"
  | "baño-privado"
  | "fumar"
  | "fiestas";

/** Parent address + contact (Phase B). */
export type Property = {
  id: string;
  publisherId: string;
  status: ListingStatus;
  title: string;
  city: string;
  neighborhood: string;
  lat: number;
  lng: number;
  summary: string;
  contactWhatsApp: string;
  propertyKind?: PropertyKind;
};

/** Rentable space inside a property. */
export type Room = {
  id: string;
  propertyId: string;
  status: ListingStatus;
  title: string;
  rentMxn: number;
  roomsAvailable: number;
  tags: ListingTag[];
  roommateGenderPref: RoommateGenderPref;
  ageMin: number;
  ageMax: number;
  summary: string;
  lodgingType?: LodgingType;
  availableFrom?: string;
  minimalStayMonths?: number;
  roomDimension?: RoomDimension;
  avalRequired?: boolean;
  subletAllowed?: boolean;
  sortOrder: number;
};

export type PropertyWithRooms = {
  property: Property;
  rooms: Room[];
};

/**
 * Search / map DTO: one row per **room**; `id` is the room id (URLs, PATCH).
 */
export type PropertyListing = {
  id: string;
  propertyId: string;
  /** From API join; optional for local seed rows. */
  propertyTitle?: string;
  /** Parent property status when returned from my-listings / joins. */
  propertyStatus?: ListingStatus;
  title: string;
  city: string;
  neighborhood: string;
  lat: number;
  lng: number;
  rentMxn: number;
  roomsAvailable: number;
  tags: ListingTag[];
  roommateGenderPref: RoommateGenderPref;
  ageMin: number;
  ageMax: number;
  summary: string;
  contactWhatsApp: string;
  /** Defaults to `published` when omitted (local seed data). */
  status?: ListingStatus;
  /** Only returned for `/api/my-listings` when authenticated with publisher cookie. */
  publisherId?: string;
  lodgingType?: LodgingType;
  propertyKind?: PropertyKind;
  availableFrom?: string;
  minimalStayMonths?: number;
  roomDimension?: RoomDimension;
  avalRequired?: boolean;
  subletAllowed?: boolean;
};

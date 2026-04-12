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

export type PropertyListing = {
  id: string;
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

export type RoommateGenderPref = "any" | "female" | "male";

export type ListingStatus = "draft" | "published" | "paused" | "archived";

/** Roomix-style lodging (Tipo de hospedaje). */
export type LodgingType = "whole_home" | "private_room" | "shared_room";

/** Casa vs departamento (inmueble). */
export type PropertyKind = "house" | "apartment";

/** Tamaño del cuarto (filtros avanzados). */
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
  status: ListingStatus;
  /** Only returned for authenticated owner responses (e.g. my-listings). */
  publisherId?: string;
  lodgingType?: LodgingType;
  propertyKind?: PropertyKind;
  /** ISO date YYYY-MM-DD — disponible desde. */
  availableFrom?: string;
  minimalStayMonths?: number;
  roomDimension?: RoomDimension;
  avalRequired?: boolean;
  subletAllowed?: boolean;
};

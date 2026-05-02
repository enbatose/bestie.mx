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
  | "fiestas"
  | "aire-acondicionado"
  | "seguridad-acceso"
  | "vigilancia"
  | "lavanderia"
  | "cocina-equipada"
  | "terraza"
  | "lgbt-friendly"
  | "servicios-incluidos"
  | "cerradura-cuarto"
  | "agua-caliente"
  | "cerca-transporte";

/** Parent address + contact (Phase B). */
export type Property = {
  id: string;
  publisherId: string;
  status: ListingStatus;
  /** Strategy: 'room' = single-room post; 'property' = multi-room/property post. */
  postMode?: "room" | "property";
  title: string;
  city: string;
  neighborhood: string;
  lat: number;
  lng: number;
  summary: string;
  contactWhatsApp: string;
  propertyKind?: PropertyKind;
  /** Total bedrooms in the building. */
  bedroomsTotal: number;
  bathrooms: number;
  /** When false, do not show WhatsApp on the public listing. */
  showWhatsApp: boolean;
  imageUrls?: string[];
};

/** Rentable space inside a property. */
export type Room = {
  id: string;
  propertyId: string;
  status: ListingStatus;
  title: string;
  rentMxn: number;
  /** One-time deposit in MXN. */
  depositMxn: number;
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
  imageUrls?: string[];
  createdAt?: string;
  updatedAt?: string;
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
  /** Publishing strategy of the parent property. */
  propertyPostMode?: "room" | "property";
  title: string;
  city: string;
  neighborhood: string;
  lat: number;
  lng: number;
  rentMxn: number;
  /** From API; defaults to 0 in local seed. */
  depositMxn?: number;
  /** From parent property join; seed may omit. */
  propertyBedroomsTotal?: number;
  propertyBathrooms?: number;
  showWhatsApp?: boolean;
  roomsAvailable: number;
  tags: ListingTag[];
  roommateGenderPref: RoommateGenderPref;
  ageMin: number;
  ageMax: number;
  summary: string;
  contactWhatsApp: string;
  /** Defaults to `published` when omitted (local seed data). */
  status?: ListingStatus;
  propertyImageUrls?: string[];
  roomImageUrls?: string[];
  /** Only returned for `/api/my-listings` when authenticated with publisher cookie. */
  publisherId?: string;
  lodgingType?: LodgingType;
  propertyKind?: PropertyKind;
  availableFrom?: string;
  minimalStayMonths?: number;
  roomDimension?: RoomDimension;
  avalRequired?: boolean;
  subletAllowed?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

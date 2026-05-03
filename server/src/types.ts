export type RoommateGenderPref = "any" | "female" | "male";

export type ListingStatus = "draft" | "published" | "paused" | "archived";

/** Lodging type (tipo de hospedaje). */
export type LodgingType = "whole_home" | "private_room" | "shared_room";

/** Casa vs departamento (inmueble). */
export type PropertyKind = "house" | "apartment" | "loft";

/** Tamaño del cuarto (filtros avanzados). */
export type RoomDimension = "small" | "medium" | "large";

export type ListingTag =
  | "wifi"
  | "agua"
  | "luz"
  | "gas"
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
  | "lavadora"
  | "secadora"
  | "cocina-equipada"
  | "terraza"
  | "lgbt-friendly"
  | "servicios-incluidos"
  | "cerradura-cuarto"
  | "agua-caliente"
  | "cerca-transporte";

/** Parent address + contact; Phase B normalized table. */
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
  /** Total bedrooms in the home. */
  bedroomsTotal: number;
  bathrooms: number;
  /** When false, WhatsApp must not be shown publicly. */
  showWhatsApp: boolean;
  /** Gallery paths from `POST /api/uploads` (same-origin `/api/uploads/...`). */
  imageUrls?: string[];
  isApproximateLocation?: boolean;
  occupiedByWomenCount?: number | null;
  occupiedByMenCount?: number | null;
};

/** Rentable unit / space inside a property; search pins are per room. */
export type Room = {
  id: string;
  propertyId: string;
  status: ListingStatus;
  /** Short label, e.g. “Cuarto planta alta”. */
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
  depositMxn: number;
  imageUrls?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type PropertyWithRooms = {
  property: Property;
  rooms: Room[];
};

/**
 * Search / map DTO: one row per **room**, with address inherited from the property.
 * `id` is always the **room** id (stable URLs: `/anuncio/:id`, `PATCH /api/listings/:id`).
 */
export type PropertyListing = {
  id: string;
  propertyId: string;
  /** Parent property title (populated from `rooms`↔`properties` join). */
  propertyTitle?: string;
  /** Parent property lifecycle (same join). */
  propertyStatus?: ListingStatus;
  /** Publishing strategy of the parent property. */
  propertyPostMode?: "room" | "property";
  /** From parent property join. */
  propertyBedroomsTotal: number;
  propertyBathrooms: number;
  showWhatsApp: boolean;
  title: string;
  city: string;
  neighborhood: string;
  lat: number;
  lng: number;
  rentMxn: number;
  depositMxn: number;
  roomsAvailable: number;
  tags: ListingTag[];
  roommateGenderPref: RoommateGenderPref;
  ageMin: number;
  ageMax: number;
  summary: string;
  contactWhatsApp: string;
  /** Room lifecycle (PATCH targets the room). */
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
  /** From parent `properties.image_urls_json`. */
  propertyImageUrls?: string[];
  /** From `rooms.image_urls_json`. */
  roomImageUrls?: string[];
  /** Room creation timestamp from API responses. */
  createdAt?: string;
  /** Room update timestamp from API responses. */
  updatedAt?: string;
};

export type RoommateGenderPref = "any" | "female" | "male";

export type ListingStatus = "draft" | "published" | "paused" | "archived";

export type LodgingType = "whole_home" | "private_room" | "shared_room";

export type PropertyKind = "house" | "apartment" | "loft";

export type RoomDimension = "small" | "medium" | "large";

/** Whether a room slot is offered for rent or already occupied (property multi-room manager). */
export type RoomOccupancyStatus = "available" | "occupied";

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
  | "fumar-habitacion"
  | "fumar-permitido-recamara"
  | "ventilador"
  | "closet"
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
  | "profesionistas"
  | "estudiantes"
  | "residentes-medicos"
  | "nomadas-digitales"
  | "individuos-solo"
  | "parejas"
  | "familiar-ninos"
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
  /** Shared-area / facade photos for property posts (same storage as `imageUrls`). */
  commonAreaPhotos?: string[];
  isApproximateLocation?: boolean;
  /** Reported occupants in existing rooms (wizard). */
  occupiedByWomenCount?: number | null;
  occupiedByMenCount?: number | null;
  /** Rooms on the property (populated when loading `PropertyWithRooms`). */
  rooms?: Room[];
};

/** Rentable space inside a property. */
export type Room = {
  id: string;
  propertyId: string;
  /** Publication lifecycle (draft / published / …). */
  status: ListingStatus;
  /** Owner label shown in UI; falls back to “Habitación N” when empty. */
  customName?: string;
  /**
   * Slot availability for property manager (`available` = listed for rent;
   * `occupied` = demographic-only). Distinct from publication `status`.
   */
  occupancyStatus?: RoomOccupancyStatus;
  /** Current occupant gender when `occupancyStatus === 'occupied'`. */
  occupantGender?: RoommateGenderPref;
  /** Current occupant age when `occupancyStatus === 'occupied'`. */
  occupantAge?: number;
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
  /** Only returned for `/api/my-listings` when the viewer owns the listing (cookie or linked account). */
  publisherId?: string;
  lodgingType?: LodgingType;
  propertyKind?: PropertyKind;
  availableFrom?: string;
  minimalStayMonths?: number;
  roomDimension?: RoomDimension;
  avalRequired?: boolean;
  subletAllowed?: boolean;
  /** When true, public map pin is offset within a privacy radius. */
  isApproximateLocation?: boolean;
  createdAt?: string;
  updatedAt?: string;
  /** True when the authenticated session owns this listing (publisher cookie or linked account). */
  viewerIsOwner?: boolean;
  roomCustomName?: string;
  roomOccupancyStatus?: RoomOccupancyStatus;
  roomOccupantGender?: RoommateGenderPref;
  roomOccupantAge?: number;
};

import type {
  ListingStatus,
  ListingTag,
  LodgingType,
  Property,
  PropertyKind,
  PropertyListing,
  PropertyWithRooms,
  Room,
  RoomDimension,
  RoommateGenderPref,
} from "@/types/listing";
import { deviceHeaders } from "@/lib/deviceFingerprint";

function apiBase(): string {
  const raw = import.meta.env.VITE_API_URL?.trim() ?? "";
  return raw.replace(/\/$/, "");
}

export function isListingsApiConfigured(): boolean {
  return apiBase().length > 0;
}

const cred: RequestCredentials = "include";

export async function fetchListingsFromApi(
  searchParams: URLSearchParams,
  signal?: AbortSignal,
): Promise<PropertyListing[]> {
  const base = apiBase();
  const qs = searchParams.toString();
  const url = `${base}/api/listings${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { signal, credentials: cred });
  if (!res.ok) {
    throw new Error(`listings_http_${res.status}`);
  }
  return (await res.json()) as PropertyListing[];
}

export async function fetchListingByIdFromApi(
  id: string,
  signal?: AbortSignal,
): Promise<PropertyListing | null> {
  const base = apiBase();
  const res = await fetch(`${base}/api/listings/${encodeURIComponent(id)}`, {
    signal,
    credentials: cred,
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`listing_http_${res.status}`);
  }
  return (await res.json()) as PropertyListing;
}

export type CreateListingPayload = Omit<
  PropertyListing,
  "id" | "status" | "publisherId" | "propertyId"
> & {
  id?: string;
  status?: ListingStatus;
  propertyId?: string;
};

export type PublishBundlePayload = {
  legalAccepted: boolean;
  property: {
    title: string;
    city: string;
    neighborhood: string;
    lat: number;
    lng: number;
    summary?: string;
    contactWhatsApp: string;
    propertyKind?: PropertyListing["propertyKind"];
    /** Total bedrooms in the home (Roomix `rooms_number`). */
    bedroomsTotal?: number;
    bathrooms?: number;
    /** Default true — same idea as Roomix “Visible en anuncio” for phone. */
    showWhatsApp?: boolean;
  };
  rooms: Array<{
    id?: string;
    title: string;
    rentMxn: number;
    roomsAvailable: number;
    tags: PropertyListing["tags"];
    roommateGenderPref: PropertyListing["roommateGenderPref"];
    ageMin: number;
    ageMax: number;
    summary: string;
    lodgingType?: PropertyListing["lodgingType"];
    /** ISO `YYYY-MM-DD` — Roomix “Disponible a partir de”. */
    availableFrom: string;
    minimalStayMonths: number;
    roomDimension: PropertyListing["roomDimension"];
    depositMxn: number;
    avalRequired?: boolean;
    subletAllowed?: boolean;
  }>;
};

export type PublishBundleResponse = {
  propertyId: string;
  rooms: PropertyListing[];
};

export async function publishPropertyBundle(
  payload: PublishBundlePayload,
  signal?: AbortSignal,
): Promise<PublishBundleResponse> {
  const base = apiBase();
  const res = await fetch(`${base}/api/properties/publish-bundle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...deviceHeaders(),
    },
    credentials: cred,
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    let msg = "";
    try {
      const j = (await res.json()) as { error?: string; message?: string; retryAfterSec?: number };
      if (j.error === "rate_limited" && j.retryAfterSec != null) {
        msg = `: rate_limited (reintentar en ~${j.retryAfterSec}s)`;
      } else if (j.message) {
        msg = `: ${j.message}`;
      } else if (j.error) {
        msg = `: ${j.error}`;
      }
    } catch {
      /* ignore */
    }
    throw new Error(`publish_bundle_http_${res.status}${msg}`);
  }
  return (await res.json()) as PublishBundleResponse;
}

export type CreateDraftPropertyPayload = {
  title: string;
  city: string;
  neighborhood: string;
  lat: number;
  lng: number;
  summary?: string;
  contactWhatsApp: string;
  propertyKind?: PropertyKind;
  bedroomsTotal?: number;
  bathrooms?: number;
  showWhatsApp?: boolean;
};

export type AddDraftRoomPayload = {
  id?: string;
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
  depositMxn?: number;
  avalRequired?: boolean;
  subletAllowed?: boolean;
};

export type UpdatePropertyPayload = {
  status?: ListingStatus;
  title?: string;
  summary?: string;
  city?: string;
  neighborhood?: string;
  lat?: number;
  lng?: number;
  contactWhatsApp?: string;
  propertyKind?: PropertyKind;
  bedroomsTotal?: number;
  bathrooms?: number;
  showWhatsApp?: boolean;
};

export type PatchDraftRoomPayload = Partial<Omit<AddDraftRoomPayload, "id">>;

export async function createDraftProperty(
  payload: CreateDraftPropertyPayload,
  signal?: AbortSignal,
): Promise<Property> {
  const base = apiBase();
  const res = await fetch(`${base}/api/properties`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { error?: string; message?: string; retryAfterSec?: number };
      if (j.error === "rate_limited" && j.retryAfterSec != null) {
        detail = `: rate_limited (reintentar en ~${j.retryAfterSec}s)`;
      } else if (j.message) detail = `: ${j.message}`;
      else if (j.error) detail = `: ${j.error}`;
    } catch {
      /* ignore */
    }
    throw new Error(`create_property_http_${res.status}${detail}`);
  }
  return (await res.json()) as Property;
}

export async function patchDraftRoom(
  propertyId: string,
  roomId: string,
  payload: PatchDraftRoomPayload,
  signal?: AbortSignal,
): Promise<Room> {
  const base = apiBase();
  const res = await fetch(
    `${base}/api/properties/${encodeURIComponent(propertyId)}/rooms/${encodeURIComponent(roomId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...deviceHeaders() },
      credentials: cred,
      body: JSON.stringify(payload),
      signal,
    },
  );
  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { error?: string; message?: string };
      if (j.message) detail = `: ${j.message}`;
      else if (j.error) detail = `: ${j.error}`;
    } catch {
      /* ignore */
    }
    throw new Error(`patch_room_http_${res.status}${detail}`);
  }
  return (await res.json()) as Room;
}

export async function deleteDraftRoom(
  propertyId: string,
  roomId: string,
  signal?: AbortSignal,
): Promise<void> {
  const base = apiBase();
  const res = await fetch(
    `${base}/api/properties/${encodeURIComponent(propertyId)}/rooms/${encodeURIComponent(roomId)}`,
    {
      method: "DELETE",
      headers: { ...deviceHeaders() },
      credentials: cred,
      signal,
    },
  );
  if (res.status === 404) return;
  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { error?: string; message?: string };
      if (j.message) detail = `: ${j.message}`;
      else if (j.error) detail = `: ${j.error}`;
    } catch {
      /* ignore */
    }
    throw new Error(`delete_room_http_${res.status}${detail}`);
  }
}

export async function addDraftRoomToProperty(
  propertyId: string,
  payload: AddDraftRoomPayload,
  signal?: AbortSignal,
): Promise<Room> {
  const base = apiBase();
  const res = await fetch(`${base}/api/properties/${encodeURIComponent(propertyId)}/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { error?: string; message?: string; retryAfterSec?: number };
      if (j.error === "rate_limited" && j.retryAfterSec != null) {
        detail = `: rate_limited (reintentar en ~${j.retryAfterSec}s)`;
      } else if (j.message) detail = `: ${j.message}`;
      else if (j.error) detail = `: ${j.error}`;
    } catch {
      /* ignore */
    }
    throw new Error(`add_room_http_${res.status}${detail}`);
  }
  return (await res.json()) as Room;
}

export async function updateProperty(
  propertyId: string,
  patch: UpdatePropertyPayload,
  signal?: AbortSignal,
): Promise<Property> {
  const base = apiBase();
  const res = await fetch(`${base}/api/properties/${encodeURIComponent(propertyId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify(patch),
    signal,
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { error?: string; message?: string };
      if (j.message) detail = `: ${j.message}`;
      else if (j.error) detail = `: ${j.error}`;
    } catch {
      /* ignore */
    }
    throw new Error(`update_property_http_${res.status}${detail}`);
  }
  return (await res.json()) as Property;
}

export async function fetchPropertyWithRooms(
  propertyId: string,
  signal?: AbortSignal,
): Promise<PropertyWithRooms | null> {
  const base = apiBase();
  const res = await fetch(`${base}/api/properties/${encodeURIComponent(propertyId)}`, {
    signal,
    credentials: cred,
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`property_http_${res.status}`);
  }
  return (await res.json()) as PropertyWithRooms;
}

export async function createListing(
  payload: CreateListingPayload,
  signal?: AbortSignal,
): Promise<PropertyListing> {
  const base = apiBase();
  const res = await fetch(`${base}/api/listings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...deviceHeaders(),
    },
    credentials: cred,
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    let msg = "";
    try {
      const j = (await res.json()) as { error?: string; message?: string; retryAfterSec?: number };
      if (j.error === "rate_limited" && j.retryAfterSec != null) {
        msg = `: rate_limited (reintentar en ~${j.retryAfterSec}s)`;
      } else if (j.message) {
        msg = `: ${j.message}`;
      } else if (j.error) {
        msg = `: ${j.error}`;
      }
    } catch {
      /* ignore */
    }
    throw new Error(`create_listing_http_${res.status}${msg}`);
  }
  return (await res.json()) as PropertyListing;
}

export async function fetchMyListings(signal?: AbortSignal): Promise<PropertyListing[]> {
  const base = apiBase();
  const res = await fetch(`${base}/api/my-listings`, { signal, credentials: cred });
  if (res.status === 401) {
    return [];
  }
  if (!res.ok) {
    throw new Error(`my_listings_http_${res.status}`);
  }
  return (await res.json()) as PropertyListing[];
}

export async function updateListingStatus(
  id: string,
  status: ListingStatus,
  signal?: AbortSignal,
): Promise<PropertyListing> {
  const base = apiBase();
  const res = await fetch(`${base}/api/listings/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify({ status }),
    signal,
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { error?: string; message?: string };
      if (j.message) detail = `: ${j.message}`;
      else if (j.error) detail = `: ${j.error}`;
    } catch {
      /* ignore */
    }
    throw new Error(`update_listing_http_${res.status}${detail}`);
  }
  return (await res.json()) as PropertyListing;
}

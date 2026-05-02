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
import { apiBase } from "@/lib/apiBase";
import { deviceHeaders } from "@/lib/deviceFingerprint";

/** Always true: same-origin `/api` is valid; set `VITE_API_URL` only for a separate API host. */
export function isListingsApiConfigured(): boolean {
  return true;
}

const cred: RequestCredentials = "include";

export type ListingUnavailableReason =
  | "invalid_id"
  | "listing_not_found"
  | "listing_draft"
  | "listing_paused"
  | "listing_archived"
  | "property_draft"
  | "property_paused"
  | "property_archived";

export type FetchListingByIdResult =
  | { kind: "found"; listing: PropertyListing }
  | { kind: "unavailable"; reason: ListingUnavailableReason };

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
): Promise<FetchListingByIdResult> {
  const base = apiBase();
  const res = await fetch(`${base}/api/listings/${encodeURIComponent(id)}`, {
    signal,
    credentials: cred,
  });
  if (res.status === 400) {
    const body = (await res.json().catch(() => null)) as { error?: string; reason?: string } | null;
    if (body?.error === "invalid_id") {
      return { kind: "unavailable", reason: "invalid_id" };
    }
  }
  if (res.status === 404) {
    const body = (await res.json().catch(() => null)) as { error?: string; reason?: string } | null;
    const reason = body?.reason;
    if (
      reason === "listing_not_found" ||
      reason === "listing_draft" ||
      reason === "listing_paused" ||
      reason === "listing_archived" ||
      reason === "property_draft" ||
      reason === "property_paused" ||
      reason === "property_archived"
    ) {
      return { kind: "unavailable", reason };
    }
    return { kind: "unavailable", reason: "listing_not_found" };
  }
  if (!res.ok) {
    throw new Error(`listing_http_${res.status}`);
  }
  return { kind: "found", listing: (await res.json()) as PropertyListing };
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
    postMode?: "room" | "property";
    title: string;
    city: string;
    neighborhood: string;
    lat: number;
    lng: number;
    summary?: string;
    contactWhatsApp: string;
    propertyKind?: PropertyListing["propertyKind"];
    /** Total bedrooms in the home. */
    bedroomsTotal?: number;
    bathrooms?: number;
    /** Default true — show phone/WhatsApp on the public listing when true. */
    showWhatsApp?: boolean;
    imageUrls?: string[];
    isApproximateLocation?: boolean;
    occupiedByWomenCount?: number | null;
    occupiedByMenCount?: number | null;
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
    /** ISO `YYYY-MM-DD` — room available from this date. */
    availableFrom: string;
    minimalStayMonths: number;
    roomDimension: PropertyListing["roomDimension"];
    depositMxn: number;
    avalRequired?: boolean;
    subletAllowed?: boolean;
    imageUrls?: string[];
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
  postMode?: "room" | "property";
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
  imageUrls?: string[];
  isApproximateLocation?: boolean;
  occupiedByWomenCount?: number | null;
  occupiedByMenCount?: number | null;
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
  imageUrls?: string[];
};

export type UpdatePropertyPayload = {
  status?: ListingStatus;
  postMode?: "room" | "property";
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
  imageUrls?: string[];
  isApproximateLocation?: boolean;
  occupiedByWomenCount?: number | null;
  occupiedByMenCount?: number | null;
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

export async function uploadListingImage(file: File, signal?: AbortSignal): Promise<string> {
  const base = apiBase();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${base}/api/uploads`, {
    method: "POST",
    headers: { ...deviceHeaders() },
    credentials: cred,
    body: form,
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
    throw new Error(`upload_http_${res.status}${detail}`);
  }
  const j = (await res.json()) as { url?: string };
  if (typeof j.url !== "string" || !j.url.startsWith("/api/uploads/")) {
    throw new Error("upload_bad_response");
  }
  return j.url;
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

import type { ListingStatus, PropertyListing } from "@/types/listing";
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

export type CreateListingPayload = Omit<PropertyListing, "id" | "status" | "publisherId"> & {
  id?: string;
  status?: ListingStatus;
};

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

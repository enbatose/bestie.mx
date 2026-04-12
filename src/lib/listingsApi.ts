import type { PropertyListing } from "@/types/listing";

function apiBase(): string {
  const raw = import.meta.env.VITE_API_URL?.trim() ?? "";
  return raw.replace(/\/$/, "");
}

export function isListingsApiConfigured(): boolean {
  return apiBase().length > 0;
}

export async function fetchListingsFromApi(
  searchParams: URLSearchParams,
  signal?: AbortSignal,
): Promise<PropertyListing[]> {
  const base = apiBase();
  const qs = searchParams.toString();
  const url = `${base}/api/listings${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { signal });
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
  const res = await fetch(`${base}/api/listings/${encodeURIComponent(id)}`, { signal });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`listing_http_${res.status}`);
  }
  return (await res.json()) as PropertyListing;
}

export type CreateListingPayload = Omit<PropertyListing, "id"> & { id?: string };

export async function createListing(
  payload: CreateListingPayload,
  signal?: AbortSignal,
): Promise<PropertyListing> {
  const base = apiBase();
  const res = await fetch(`${base}/api/listings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) detail = `: ${j.error}`;
    } catch {
      /* ignore */
    }
    throw new Error(`create_listing_http_${res.status}${detail}`);
  }
  return (await res.json()) as PropertyListing;
}

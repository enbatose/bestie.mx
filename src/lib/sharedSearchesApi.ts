import { apiBase } from "@/lib/apiBase";
import type { SearchFilters } from "@/lib/searchFilters";
import type { PropertyListing } from "@/types/listing";

const cred: RequestCredentials = "include";

async function parseJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) {
    throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
  }
  return body;
}

export type SharedSearchListingHit = {
  id: string;
  title: string;
  neighborhood: string;
  city: string;
  rentMxn: number;
  score?: number;
};

export type SharedSearchLocation = {
  cityCode: string;
  cityLabel?: string;
  neighborhoods: { name: string; lat: number; lng: number }[];
  lat: number;
  lng: number;
  zoom: number;
};

export type SharedSearchExtractResult = {
  ok: boolean;
  extraction: Record<string, unknown>;
  composed: {
    filters: SearchFilters;
    location: SharedSearchLocation;
    label: string;
    mainArea: string;
    qText: string;
  };
  insights: Array<{ label: string; text: string; mapped: boolean }>;
  nonNegotiables: Array<{ kind: string; value: string; reason: string }>;
  exact: SharedSearchListingHit[];
  similar: SharedSearchListingHit[];
  exactCount: number;
  similarCount: number;
  quality: "alta" | "media" | "baja";
  caption: string;
  zoneRule?: string;
};

export type SharedSearchCreateResult = {
  ok: boolean;
  id: string;
  sharePath: string;
  shareUrl: string;
  caption: string;
  label: string;
  exactCount: number;
  similarCount: number;
  quality: "alta" | "media" | "baja";
  reused?: boolean;
  zoneRule?: string;
};

export type SharedSearchMeta = {
  id: string;
  label: string;
  cityCode: string;
  cityLabel: string;
  caption: string;
  exactCount: number;
  similarCount: number;
  sharePath: string;
  zoneRule?: string;
};

export type SharedSearchPublicView = {
  id: string;
  kind: string;
  label: string;
  cityCode: string;
  cityLabel: string;
  caption: string;
  zoneRule: string;
  sourceKind: "mapa" | "anuncio" | "facebook" | "copia";
  filters: SearchFilters;
  location: SharedSearchLocation;
  insights: Array<{ label: string; text: string; mapped: boolean }>;
  nonNegotiables: Array<{ kind: string; value: string; reason: string }>;
  exact: PropertyListing[];
  similar: PropertyListing[];
  exactCount: number;
  similarCount: number;
  sharePath: string;
  alreadySaved: boolean;
  savedSearchId: string | null;
  emailNotifyEnabled: boolean;
};

export type SharedSearchSubscribeResult = {
  id: string;
  sharePath: string;
  redirectedSlug: string | null;
  subscribedNow: boolean;
  savedSearch?: { id: string; emailNotifyEnabled: boolean };
  exactCount: number;
  similarCount: number;
  listings: { exact: PropertyListing[]; similar: PropertyListing[] };
  location: SharedSearchLocation;
  filters: SearchFilters;
};

export async function adminExtractSharedSearch(input: {
  text?: string;
  images?: Array<{ mimeType: string; data: string }>;
  city: string;
  seekerName?: string;
  seekerGender?: "female" | "male" | null;
}): Promise<SharedSearchExtractResult> {
  const res = await fetch(`${apiBase()}/api/shared-searches/admin/extract`, {
    method: "POST",
    credentials: cred,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson(res);
}

export async function adminCreateSharedSearch(input: {
  city: string;
  seekerName: string;
  seekerGender: "female" | "male" | null;
  sourceFacebookUrl: string;
  extraction: Record<string, unknown>;
}): Promise<SharedSearchCreateResult> {
  const res = await fetch(`${apiBase()}/api/shared-searches/admin`, {
    method: "POST",
    credentials: cred,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson(res);
}

export async function adminSharedSearchDuplicateCheck(sourceFacebookUrl: string): Promise<{
  facebookMatches: Array<{ id: string; label: string; sharePath: string; createdAt: string; seekerName: string | null }>;
}> {
  const res = await fetch(`${apiBase()}/api/shared-searches/admin/duplicate-check`, {
    method: "POST",
    credentials: cred,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceFacebookUrl }),
  });
  return parseJson(res);
}

export async function fetchSharedSearchView(
  id: string,
  signal?: AbortSignal,
): Promise<SharedSearchPublicView> {
  const res = await fetch(`${apiBase()}/api/shared-searches/${encodeURIComponent(id)}`, {
    credentials: cred,
    signal,
  });
  return parseJson(res);
}

export async function fetchSharedSearchMeta(id: string, signal?: AbortSignal): Promise<SharedSearchMeta> {
  const res = await fetch(`${apiBase()}/api/shared-searches/${encodeURIComponent(id)}/meta`, {
    credentials: cred,
    signal,
  });
  return parseJson(res);
}

export async function subscribeSharedSearch(
  id: string,
  opts?: { enableNotify?: boolean },
): Promise<SharedSearchSubscribeResult> {
  const res = await fetch(`${apiBase()}/api/shared-searches/${encodeURIComponent(id)}/subscribe`, {
    method: "POST",
    credentials: cred,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enableNotify: Boolean(opts?.enableNotify) }),
  });
  return parseJson(res);
}

export function absoluteShareUrl(sharePath: string): string {
  if (typeof window === "undefined") return sharePath;
  return `${window.location.origin}${sharePath}`;
}

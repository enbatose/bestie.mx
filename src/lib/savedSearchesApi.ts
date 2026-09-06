import { apiBase } from "@/lib/apiBase";
import { formatSavedSearchDraftLabel } from "@/lib/savedSearchDraftLabel";
import { filtersToParams, type SearchFilters } from "@/lib/searchFilters";
import { writeSearchLocation, type SearchLocationState } from "@/lib/searchLocation";

export type SavedSearchDto = {
  id: string;
  label: string;
  cityCode: string;
  searchUrl: string;
  emailNotifyEnabled: boolean;
  isDraft?: boolean;
  createdAt: string;
  updatedAt: string;
  matchCount?: number;
  /** Neighborhood names for the card (stored pins or resolved from map bbox). */
  areaNeighborhoods?: string[];
  replacedPrevious?: { id: string; label: string };
  emailSent?: boolean;
  emailError?: string;
  shareId?: string | null;
  filters?: SearchFilters;
  location?: SearchLocationState & { cityAbbr?: string };
};

export type SaveSavedSearchPayload = {
  label?: string;
  cityCode: string;
  filters: SearchFilters;
  location: Pick<
    SearchLocationState,
    "cityCode" | "cityLabel" | "neighborhoods" | "lat" | "lng" | "zoom"
  >;
  searchUrl: string;
  enableEmailNotify?: boolean;
};

const cred: RequestCredentials = "include";

async function parseJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) {
    throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
  }
  return body;
}

export function buildSavedSearchUrl(
  pathname: string,
  filters: SearchFilters,
  searchLocation: SearchLocationState,
): string {
  const p = writeSearchLocation(filtersToParams({ ...filters, q: "" }), searchLocation);
  const qs = p.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function autoLabelFromFilters(
  searchLocation: SearchLocationState,
  _filters?: SearchFilters,
): string {
  return formatSavedSearchDraftLabel(searchLocation);
}

export async function fetchSavedSearches(signal?: AbortSignal): Promise<SavedSearchDto[]> {
  const res = await fetch(`${apiBase()}/api/saved-searches`, { credentials: cred, signal });
  return parseJson(res);
}

export async function fetchSearchDraft(signal?: AbortSignal): Promise<SavedSearchDto | null> {
  const res = await fetch(`${apiBase()}/api/saved-searches/draft`, { credentials: cred, signal });
  const body = (await res.json().catch(() => null)) as SavedSearchDto | null;
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return body;
}

export async function upsertSearchDraft(payload: SaveSavedSearchPayload): Promise<SavedSearchDto> {
  const res = await fetch(`${apiBase()}/api/saved-searches/draft`, {
    method: "PUT",
    credentials: cred,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function promoteSearchDraft(label?: string): Promise<SavedSearchDto> {
  const res = await fetch(`${apiBase()}/api/saved-searches/draft/promote`, {
    method: "POST",
    credentials: cred,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(label?.trim() ? { label: label.trim() } : {}),
  });
  return parseJson(res);
}

export async function createSavedSearch(payload: SaveSavedSearchPayload): Promise<SavedSearchDto> {
  const res = await fetch(`${apiBase()}/api/saved-searches`, {
    method: "POST",
    credentials: cred,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function updateSavedSearch(
  id: string,
  patch: {
    label?: string;
    emailNotifyEnabled?: boolean;
    filters?: SearchFilters;
    location?: SaveSavedSearchPayload["location"];
    searchUrl?: string;
  },
): Promise<SavedSearchDto> {
  const res = await fetch(`${apiBase()}/api/saved-searches/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: cred,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return parseJson(res);
}

export async function enableSavedSearchNotify(id: string): Promise<SavedSearchDto> {
  const res = await fetch(`${apiBase()}/api/saved-searches/${encodeURIComponent(id)}/enable-notify`, {
    method: "POST",
    credentials: cred,
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return parseJson(res);
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const res = await fetch(`${apiBase()}/api/saved-searches/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: cred,
  });
  if (!res.ok && res.status !== 204) {
    await parseJson(res);
  }
}

import { apiBase } from "@/lib/apiBase";

const cred: RequestCredentials = "include";

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error("No se pudo contactar la API. Comprueba tu conexión.");
  }
}

export type ExtractionInput = {
  text?: string;
  images?: Array<{ mimeType: string; data: string }>;
  city?: string;
};

export type AssistedDraftExtraction = {
  propertyTitle?: string;
  neighborhood?: string;
  propertyKind?: "house" | "apartment" | "loft";
  lodgingType?: "private_room" | "shared_room";
  rentMxn?: number;
  depositMxn?: number;
  roommateGenderPref?: "any" | "female" | "male";
  ageMin?: number;
  ageMax?: number;
  availableFrom?: string;
  minimalStayMonths?: number;
  roomDimension?: "small" | "medium" | "large";
  tags?: string[];
  roomSummary?: string;
  location?: {
    type: "precise" | "approximate" | "none";
    lat?: number;
    lng?: number;
    radiusMeters?: number;
    address?: string;
  };
  confidence?: Record<string, number>;
};

export type AssistedDraftClaimInfo = {
  isClaimed: boolean;
  propertyId: string;
  property: {
    id: string;
    publisherId: string;
    status: string;
    postMode: string;
    title: string;
    city: string;
    neighborhood: string;
    lat: number;
    lng: number;
    summary: string;
    propertyKind: string | null;
    bedroomsTotal: number;
    bathrooms: number;
    showWhatsApp: boolean;
    imageUrls: string[];
    isApproximateLocation: boolean;
    approximateRadiusMeters?: number;
  };
  rooms: Array<{
    id: string;
    title: string;
    rentMxn: number;
    depositMxn: number;
    roommateGenderPref: string;
    ageMin: number;
    ageMax: number;
    summary: string;
    lodgingType: string | null;
    availableFrom: string | null;
    minimalStayMonths: number | null;
    roomDimension: string | null;
    tags: string[];
    imageUrls: string[];
  }>;
};

/** Admin: run AI extraction on text/images. */
export async function adminExtractAssistedDraft(
  input: ExtractionInput,
): Promise<AssistedDraftExtraction> {
  const base = apiBase();
  const res = await apiFetch(`${base}/api/assisted-draft/admin/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: cred,
    body: JSON.stringify(input),
  });
  const j = (await res.json().catch(() => ({}))) as { extraction?: AssistedDraftExtraction; error?: string };
  if (!res.ok) throw new Error(j.error ?? `extract_${res.status}`);
  return j.extraction ?? {};
}

/** Admin: create the draft + claim token from extracted data. */
export async function adminCreateAssistedDraft(opts: {
  city: string;
  extraction: AssistedDraftExtraction;
  photos?: Array<{ mimeType: string; data: string }>;
  infographicPhotos?: Array<{ mimeType: string; data: string }>;
}): Promise<{ claimUrl: string; propertyId: string }> {
  const base = apiBase();
  const res = await apiFetch(`${base}/api/assisted-draft/admin/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: cred,
    body: JSON.stringify(opts),
  });
  const j = (await res.json().catch(() => ({}))) as { claimUrl?: string; propertyId?: string; error?: string };
  if (!res.ok) throw new Error(j.error ?? `create_${res.status}`);
  if (!j.claimUrl) throw new Error("create_bad_response");
  return { claimUrl: j.claimUrl, propertyId: j.propertyId ?? "" };
}

/** Public: fetch draft info by claim token. */
export async function fetchAssistedDraftClaim(token: string): Promise<AssistedDraftClaimInfo> {
  const base = apiBase();
  const res = await apiFetch(`${base}/api/assisted-draft/claim/${encodeURIComponent(token)}`, {
    credentials: cred,
  });
  const j = (await res.json().catch(() => ({}))) as Partial<AssistedDraftClaimInfo> & { error?: string };
  if (!res.ok) throw new Error(j.error ?? `claim_fetch_${res.status}`);
  return j as AssistedDraftClaimInfo;
}

/** Public: activate claim (sets orphan publisher cookie). Returns propertyId. */
export async function activateAssistedDraftClaim(
  token: string,
): Promise<{ propertyId: string; publisherId: string }> {
  const base = apiBase();
  const res = await apiFetch(`${base}/api/assisted-draft/claim/${encodeURIComponent(token)}/activate`, {
    method: "POST",
    credentials: cred,
  });
  const j = (await res.json().catch(() => ({}))) as {
    propertyId?: string;
    publisherId?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(j.error ?? `activate_${res.status}`);
  if (!j.propertyId) throw new Error("activate_bad_response");
  return { propertyId: j.propertyId, publisherId: j.publisherId ?? "" };
}

/** Auth-gated: claim ownership + publish. Returns propertyId. */
export async function publishAssistedDraftClaim(token: string): Promise<{ propertyId: string }> {
  const base = apiBase();
  const res = await apiFetch(`${base}/api/assisted-draft/claim/${encodeURIComponent(token)}/publish`, {
    method: "POST",
    credentials: cred,
  });
  const j = (await res.json().catch(() => ({}))) as { propertyId?: string; error?: string };
  if (!res.ok) throw new Error(j.error ?? `publish_${res.status}`);
  if (!j.propertyId) throw new Error("publish_bad_response");
  return { propertyId: j.propertyId };
}

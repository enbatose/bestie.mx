import { apiBase } from "@/lib/apiBase";
import { deviceHeaders } from "@/lib/deviceFingerprint";

const cred: RequestCredentials = "include";

export async function reportListing(
  listingRef: string,
  input: {
    categories: string[];
    detailText?: string;
    photoUrl?: string;
    photoIndex?: number;
  },
): Promise<{ ok: boolean; reportCount: number }> {
  const base = apiBase();
  const res = await fetch(`${base}/api/reports/listings/${encodeURIComponent(listingRef)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `report_listing_${res.status}`);
  }
  const j = (await res.json()) as { reportCount?: number };
  return { ok: true, reportCount: j.reportCount ?? 1 };
}

export async function reportProperty(
  propertyRef: string,
  input: {
    categories: string[];
    detailText?: string;
    photoUrl?: string;
    photoIndex?: number;
  },
): Promise<{ ok: boolean; reportCount: number }> {
  const base = apiBase();
  const res = await fetch(`${base}/api/reports/properties/${encodeURIComponent(propertyRef)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `report_property_${res.status}`);
  }
  const j = (await res.json()) as { reportCount?: number };
  return { ok: true, reportCount: j.reportCount ?? 1 };
}

export async function reportConversation(
  conversationId: string,
  input: { categories: string[]; detailText?: string },
): Promise<{ ok: boolean; reportCount: number }> {
  const base = apiBase();
  const res = await fetch(`${base}/api/reports/conversations/${encodeURIComponent(conversationId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `report_chat_${res.status}`);
  }
  const j = (await res.json()) as { reportCount?: number };
  return { ok: true, reportCount: j.reportCount ?? 1 };
}

export async function joinPublisherReportThread(input: {
  propertyId: string;
  roomId?: string | null;
  targetType: "room" | "property";
}): Promise<{ conversationId: string }> {
  const base = apiBase();
  const res = await fetch(`${base}/api/reports/join-publisher`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`join_report_${res.status}`);
  return (await res.json()) as { conversationId: string };
}

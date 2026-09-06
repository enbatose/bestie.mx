import { apiBase } from "@/lib/apiBase";
import { deviceHeaders } from "@/lib/deviceFingerprint";

const cred: RequestCredentials = "include";

export type PhoneRevealSafetyRole = "seeker" | "publisher";

export type PhoneRevealSafetyStatus = {
  accepted: boolean;
  noticeVersion: string;
};

export async function fetchPhoneRevealSafetyStatus(
  signal?: AbortSignal,
): Promise<PhoneRevealSafetyStatus> {
  const res = await fetch(`${apiBase()}/api/listings/phone-reveal/status`, {
    credentials: cred,
    headers: deviceHeaders(),
    signal,
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(`phone_reveal_status_${res.status}`);
  return (await res.json()) as PhoneRevealSafetyStatus;
}

export async function postPhoneRevealSafetyAcknowledgment(body: {
  role: PhoneRevealSafetyRole;
  propertyId?: string | null;
}): Promise<void> {
  const res = await fetch(`${apiBase()}/api/listings/phone-reveal/ack`, {
    method: "POST",
    credentials: cred,
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || `phone_reveal_ack_${res.status}`);
  }
}

export type ListingContactPhone = {
  phoneDigits: string;
  e164: string;
  listingTitle?: string | null;
  publisherDisplayName?: string | null;
};

export async function fetchListingContactPhone(
  listingId: string,
  options?: { claimToken?: string | null; signal?: AbortSignal },
): Promise<ListingContactPhone> {
  const params = new URLSearchParams();
  if (options?.claimToken) params.set("claim", options.claimToken);
  const qs = params.toString();
  const res = await fetch(
    `${apiBase()}/api/listings/${encodeURIComponent(listingId)}/contact-phone${qs ? `?${qs}` : ""}`,
    {
      credentials: cred,
      headers: deviceHeaders(),
      signal: options?.signal,
    },
  );
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    phoneDigits?: string;
    e164?: string;
    listingTitle?: string | null;
    publisherDisplayName?: string | null;
  };
  if (res.status === 401) throw new Error("unauthorized");
  if (res.status === 403 && j.error === "safety_required") throw new Error("safety_required");
  if (res.status === 404) throw new Error("Teléfono no disponible en este anuncio.");
  if (!res.ok) throw new Error(j.error || `contact_phone_${res.status}`);
  if (!j.phoneDigits) throw new Error("Teléfono no disponible en este anuncio.");
  return {
    phoneDigits: j.phoneDigits,
    e164: j.e164 ?? `+${j.phoneDigits}`,
    listingTitle: j.listingTitle ?? null,
    publisherDisplayName: j.publisherDisplayName ?? null,
  };
}

export type ListingContactActionType = "call" | "whatsapp";

/** Fire-and-forget: call / WhatsApp clicks after a published phone reveal. */
export async function postListingContactEvent(
  listingId: string,
  type: ListingContactActionType,
): Promise<void> {
  try {
    await fetch(`${apiBase()}/api/listings/${encodeURIComponent(listingId)}/contact-event`, {
      method: "POST",
      credentials: cred,
      headers: { "Content-Type": "application/json", ...deviceHeaders() },
      body: JSON.stringify({ type }),
      keepalive: true,
    });
  } catch {
    /* never block Llamar / WhatsApp */
  }
}

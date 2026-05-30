import { analyticsEvent } from "@/lib/authApi";

export type StreetViewTrackingInterface = "publish_wizard" | "listing_preview" | "public_listing";

export type StreetViewEmbedVariant = "inline" | "expanded";

export async function trackDynamicStreetViewSession(payload: {
  interface: StreetViewTrackingInterface;
  lat: number;
  lng: number;
  propertyId?: string;
}): Promise<void> {
  await analyticsEvent("dynamic_street_view_session", payload);
}

export async function trackStreetViewEmbedLocked(payload: {
  interface: StreetViewTrackingInterface;
  variant: StreetViewEmbedVariant;
  propertyId?: string;
  listingId?: string;
}): Promise<void> {
  await analyticsEvent("street_view_embed_locked", payload);
}

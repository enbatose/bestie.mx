/** Machine-readable Google Maps pricing used by admin cost estimates. */
export const GOOGLE_MAPS_PRICING_SOURCE =
  "https://developers.google.com/maps/billing-and-pricing/pricing";

/** Update when re-verifying against the source URL (see docs/integrations/google-maps-pricing.md). */
export const GOOGLE_MAPS_PRICING_LAST_VERIFIED = "2025-05-30";

/** Dynamic Street View SKU 658E-F885-E11A — free billable events per calendar month. */
export const DYNAMIC_STREET_VIEW_FREE_MONTHLY = 5000;

/** USD per 1,000 billable Dynamic Street View events (first paid tier, up to 100K/month). */
export const DYNAMIC_STREET_VIEW_USD_PER_1000 = 14.0;

export function estimateDynamicStreetViewOverageUsd(sessionCount: number): number {
  const overage = Math.max(0, sessionCount - DYNAMIC_STREET_VIEW_FREE_MONTHLY);
  return (overage / 1000) * DYNAMIC_STREET_VIEW_USD_PER_1000;
}

export const RENT_REQUIRED_PUBLISH_MESSAGE =
  "Falta el precio de renta. No se puede publicar en 0 MXN / mes.";

function rentMxnMissing(rentMxn: unknown): boolean {
  const rent = Number(rentMxn);
  return !Number.isFinite(rent) || rent <= 0;
}

/** Admin outreach is single-room: hide rent/deposit when AI did not extract a monthly price. */
export function outreachHidePricingForMissingRent(rentMxn: unknown): boolean {
  return rentMxnMissing(rentMxn);
}

/** True when claim/publish must reject because an available room has no monthly rent. */
export function claimPublishMissingRent(
  rows: Array<{ rent_mxn: unknown; occupancy_status?: unknown }>,
  hidePricing = false,
): boolean {
  if (hidePricing) return false;
  if (!rows.length) return true;
  const available = rows.filter((row) => String(row.occupancy_status ?? "available") !== "occupied");
  if (!available.length) return false;
  return available.some((row) => rentMxnMissing(row.rent_mxn));
}

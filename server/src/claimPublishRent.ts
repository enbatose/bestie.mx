/** True when claim/publish must reject because an available room has no monthly rent. */
export function claimPublishMissingRent(
  rows: Array<{ rent_mxn: unknown; occupancy_status?: unknown }>,
): boolean {
  if (!rows.length) return true;
  const available = rows.filter((row) => String(row.occupancy_status ?? "available") !== "occupied");
  if (!available.length) return false;
  return available.some((row) => {
    const rent = Number(row.rent_mxn);
    return !Number.isFinite(rent) || rent <= 0;
  });
}

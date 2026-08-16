export type NominatimAddress = Record<string, string>;

export function pickAddrPart(addr: NominatimAddress | undefined, keys: readonly string[]): string {
  if (!addr) return "";
  for (const k of keys) {
    const v = addr[k]?.trim();
    if (v) return v;
  }
  return "";
}

/** Colonia / zona from reverse-geocode — used to autofill the neighborhood field, not the address line. */
export function neighborhoodFromNominatimAddress(addr: NominatimAddress | undefined): string {
  return pickAddrPart(addr, [
    "neighbourhood",
    "suburb",
    "quarter",
    "city_block",
    "district",
    "city_district",
    "hamlet",
  ]);
}

/**
 * Reverse-geocode label after a map pan. OSM house numbers and colonias are often
 * wrong, so we keep only calle + ciudad.
 */
export function streetCityFromNominatim(
  addr: NominatimAddress | undefined,
  fallbackCity: string,
): string {
  const road = pickAddrPart(addr, ["road", "pedestrian", "footway", "residential", "path"]);
  const city =
    pickAddrPart(addr, ["city", "town", "village", "municipality"]) || fallbackCity.trim();

  const parts: string[] = [];
  if (road) parts.push(road);
  if (city && city !== road) parts.push(city);
  return parts.join(", ") || "Ubicación aproximada";
}

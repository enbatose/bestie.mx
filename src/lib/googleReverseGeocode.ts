type GeocodeJsonResponse = {
  status: string;
  error_message?: string;
  results?: Array<{ formatted_address?: string }>;
};

/**
 * Reverse-geocode via Google Geocoding API (same browser key as Maps JS).
 * Enable "Geocoding API" for the key in Google Cloud Console.
 */
export async function reverseGeocodeGoogle(
  lat: number,
  lng: number,
  apiKey: string,
): Promise<{ ok: true; address: string } | { ok: false; reason: "network" | "api" | "empty" }> {
  const key = apiKey.trim();
  if (!key) return { ok: false, reason: "empty" };

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("key", key);
  url.searchParams.set("language", "es");
  url.searchParams.set("region", "mx");

  let res: Response;
  try {
    res = await fetch(url.toString());
  } catch {
    return { ok: false, reason: "network" };
  }

  let data: GeocodeJsonResponse;
  try {
    data = (await res.json()) as GeocodeJsonResponse;
  } catch {
    return { ok: false, reason: "network" };
  }

  if (data.status === "OK" && data.results?.[0]?.formatted_address) {
    return { ok: true, address: data.results[0].formatted_address };
  }

  return { ok: false, reason: "api" };
}

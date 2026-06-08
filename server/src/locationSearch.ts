import type { Request, Response } from "express";

type NominatimAddress = Record<string, string | undefined>;

type NominatimSearchResult = {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
  address?: NominatimAddress;
};

const GUADALAJARA_CITY = "Guadalajara";
const GUADALAJARA_LABEL_PREFIX = "GDL";
const GUADALAJARA_NEIGHBORHOOD_ZOOM = 14;
const GUADALAJARA_METRO_VIEWBOX = {
  left: -103.55,
  top: 20.83,
  right: -103.2,
  bottom: 20.57,
};
const GUADALAJARA_METRO_AREAS = new Set([
  normalizeLocationText("Guadalajara"),
  normalizeLocationText("Zapopan"),
  normalizeLocationText("Tlaquepaque"),
  normalizeLocationText("San Pedro Tlaquepaque"),
  normalizeLocationText("Tonalá"),
  normalizeLocationText("Tonalá"),
  normalizeLocationText("Tlajomulco"),
  normalizeLocationText("Tlajomulco de Zúñiga"),
  normalizeLocationText("El Salto"),
]);

function normalizeLocationText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function isWithinGuadalajara(address: NominatimAddress | undefined) {
  if (!address) return false;
  const candidates = [
    address.city,
    address.town,
    address.municipality,
    address.county,
    address.state_district,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map(normalizeLocationText);
  return candidates.some((value) => GUADALAJARA_METRO_AREAS.has(value));
}

function pickNeighborhood(address: NominatimAddress | undefined) {
  if (!address) return "";
  return (
    address.neighbourhood ||
    address.suburb ||
    address.quarter ||
    address.residential ||
    address.city_district ||
    address.borough ||
    ""
  ).trim();
}

const LOCATION_STOP_WORDS = new Set([
  "colonia",
  "col",
  "barrio",
  "fracc",
  "fraccionamiento",
  "zona",
  "de",
  "del",
  "la",
  "el",
]);

function locationTokens(value: string) {
  return normalizeLocationText(value)
    .split(/[\s,.-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !LOCATION_STOP_WORDS.has(token));
}

function scoreLocationMatch(
  query: string,
  neighborhood: string,
  displayName: string,
  fallbackName: string,
): number {
  const normalizedQuery = normalizeLocationText(query);
  const normalizedNeighborhood = normalizeLocationText(neighborhood);
  const normalizedDisplayName = normalizeLocationText(displayName);
  const normalizedFallbackName = normalizeLocationText(fallbackName);
  const queryTokens = locationTokens(query);
  const neighborhoodTokens = locationTokens(neighborhood);
  const nameTokens = locationTokens(fallbackName);
  let score = 0;

  if (normalizedNeighborhood === normalizedQuery) score += 1000;
  else if (normalizedNeighborhood.startsWith(normalizedQuery)) score += 800;
  else if (normalizedNeighborhood.includes(normalizedQuery)) score += 700;

  if (normalizedFallbackName === normalizedQuery) score += 500;
  else if (normalizedFallbackName.startsWith(normalizedQuery)) score += 350;
  else if (normalizedFallbackName.includes(normalizedQuery)) score += 250;

  if (normalizedDisplayName.includes(normalizedQuery)) score += 120;

  if (queryTokens.length) {
    if (queryTokens.every((token) => neighborhoodTokens.some((candidate) => candidate.includes(token)))) {
      score += 400;
    }
    if (queryTokens.every((token) => nameTokens.some((candidate) => candidate.includes(token)))) {
      score += 180;
    }
    score += queryTokens.filter((token) => neighborhoodTokens.some((candidate) => candidate.includes(token))).length * 40;
  }

  return score;
}

export async function locationSearchHandler(req: Request, res: Response) {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 2) {
    res.json([]);
    return;
  }

  async function runSearch(searchQuery: string) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", searchQuery);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "8");
    url.searchParams.set("countrycodes", "mx");
    url.searchParams.set(
      "viewbox",
      `${GUADALAJARA_METRO_VIEWBOX.left},${GUADALAJARA_METRO_VIEWBOX.top},${GUADALAJARA_METRO_VIEWBOX.right},${GUADALAJARA_METRO_VIEWBOX.bottom}`,
    );
    url.searchParams.set("bounded", "1");
    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "bestie.mx-search",
        "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
      },
    });
    if (!upstream.ok) return null;
    return (await upstream.json()) as NominatimSearchResult[];
  }

  try {
    const searchQueries = [
      `${q}, ${GUADALAJARA_CITY}, Jalisco, Mexico`,
      `${q}, Jalisco, Mexico`,
      q,
    ];
    let payload: NominatimSearchResult[] = [];
    for (const searchQuery of searchQueries) {
      const result = await runSearch(searchQuery);
      if (!result?.length) continue;
      payload = result;
      const metroMatches = result.filter((item) => isWithinGuadalajara(item.address));
      if (metroMatches.length) {
        payload = metroMatches;
        break;
      }
    }

    const seen = new Set<string>();
    const suggestions = payload
      .filter((item) => isWithinGuadalajara(item.address))
      .map((item) => {
        const neighborhood = pickNeighborhood(item.address);
        const city = GUADALAJARA_CITY;
        const label = neighborhood ? `${GUADALAJARA_LABEL_PREFIX} - ${neighborhood}` : city;
        const displayName = item.display_name ?? "";
        const fallbackName = item.name ?? (neighborhood || city);
        return {
          key: `${label}:${item.lat}:${item.lon}`,
          label,
          value: label,
          city,
          neighborhood: neighborhood || null,
          lat: Number(item.lat),
          lng: Number(item.lon),
          zoom: neighborhood ? GUADALAJARA_NEIGHBORHOOD_ZOOM : 13,
          score: scoreLocationMatch(q, neighborhood || city, displayName, fallbackName),
        };
      })
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "es-MX"))
      .filter((item) => {
        if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return false;
        if (seen.has(item.label)) return false;
        seen.add(item.label);
        return true;
      });

    res.json(
      suggestions.map(({ score: _score, ...item }) => item),
    );
  } catch {
    res.status(502).json({ error: "location_search_unavailable" });
  }
}

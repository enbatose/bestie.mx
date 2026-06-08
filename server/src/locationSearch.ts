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

type LocationSuggestion = {
  key: string;
  label: string;
  value: string;
  city: string;
  neighborhood: string | null;
  lat: number;
  lng: number;
  zoom: number;
};

const GUADALAJARA_CITY = "Guadalajara";
const GUADALAJARA_METRO_LABEL_PREFIX = "GDL";
const GUADALAJARA_NEIGHBORHOOD_ZOOM = 14;
const GUADALAJARA_MUNICIPALITY_ZOOM = 12;
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
const CURATED_GUADALAJARA_NEIGHBORHOODS: Array<{
  city?: string;
  neighborhood: string;
  lat: number;
  lng: number;
  aliases?: string[];
}> = [
  {
    city: "Tonalá",
    neighborhood: "Tonalá",
    lat: 20.6241367,
    lng: -103.2421263,
    aliases: ["Tonalá", "Tonala"],
  },
  {
    city: "San Pedro Tlaquepaque",
    neighborhood: "Tlaquepaque",
    lat: 20.6397718,
    lng: -103.3120428,
    aliases: ["Tlaquepaque", "San Pedro Tlaquepaque"],
  },
  {
    city: "El Salto",
    neighborhood: "El Salto",
    lat: 20.5196964,
    lng: -103.1813141,
    aliases: ["El Salto"],
  },
  {
    city: "Tlajomulco de Zúñiga",
    neighborhood: "Tlajomulco de Zúñiga",
    lat: 20.4818737,
    lng: -103.4005097,
    aliases: ["Tlajomulco", "Tlajomulco de Zúñiga", "Tlajomulco de Zuniga"],
  },
  {
    neighborhood: "Centro Histórico",
    lat: 20.675138,
    lng: -103.347345,
    aliases: ["Centro", "Centro Histórico", "Downtown Guadalajara"],
  },
  {
    neighborhood: "Colonia Americana",
    lat: 20.67459,
    lng: -103.35943,
    aliases: ["Americana", "Colonia Americana"],
  },
  {
    neighborhood: "Providencia",
    lat: 20.6969,
    lng: -103.3812,
    aliases: ["Providencia", "Colomos Providencia", "Lomas Providencia"],
  },
  {
    neighborhood: "Chapalita",
    lat: 20.6644623,
    lng: -103.3969701,
    aliases: ["Chapalita"],
  },
  {
    neighborhood: "Arcos Vallarta",
    lat: 20.6724,
    lng: -103.3796,
    aliases: ["Arcos Vallarta"],
  },
  {
    neighborhood: "Santa Teresita",
    lat: 20.6831053,
    lng: -103.3671819,
    aliases: ["Santa Teresita", "Santa Tere"],
  },
  {
    neighborhood: "Ladrón de Guevara",
    lat: 20.6760789,
    lng: -103.3779083,
    aliases: ["Ladrón de Guevara", "Ladron de Guevara"],
  },
  {
    neighborhood: "Lafayette",
    lat: 20.6791077,
    lng: -103.3684526,
    aliases: ["Lafayette", "Colonia Lafayette"],
  },
  {
    neighborhood: "Monraz",
    lat: 20.6817797,
    lng: -103.3957584,
    aliases: ["Monraz"],
  },
  {
    neighborhood: "Country Club",
    lat: 20.70338,
    lng: -103.37614,
    aliases: ["Country Club", "Guadalajara Country Club"],
  },
];

function normalizeLocationText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function cityAbbreviation(_city: string) {
  return GUADALAJARA_METRO_LABEL_PREFIX;
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

function pickCity(address: NominatimAddress | undefined) {
  if (!address) return GUADALAJARA_CITY;
  return (
    address.city ||
    address.town ||
    address.municipality ||
    address.county ||
    GUADALAJARA_CITY
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
  city: string,
  displayName: string,
  fallbackName: string,
  aliases: string[] = [],
): number {
  const normalizedQuery = normalizeLocationText(query);
  const normalizedNeighborhood = normalizeLocationText(neighborhood);
  const normalizedCity = normalizeLocationText(city);
  const normalizedDisplayName = normalizeLocationText(displayName);
  const normalizedFallbackName = normalizeLocationText(fallbackName);
  const normalizedAliases = aliases.map(normalizeLocationText);
  const queryTokens = locationTokens(query);
  const neighborhoodTokens = locationTokens(neighborhood);
  const cityTokens = locationTokens(city);
  const nameTokens = locationTokens(fallbackName);
  const aliasTokens = aliases.flatMap((alias) => locationTokens(alias));
  let score = 0;

  if (normalizedNeighborhood === normalizedQuery) score += 1000;
  else if (normalizedNeighborhood.startsWith(normalizedQuery)) score += 800;
  else if (normalizedNeighborhood.includes(normalizedQuery)) score += 700;

  if (normalizedFallbackName === normalizedQuery) score += 500;
  else if (normalizedFallbackName.startsWith(normalizedQuery)) score += 350;
  else if (normalizedFallbackName.includes(normalizedQuery)) score += 250;

  if (normalizedDisplayName.includes(normalizedQuery)) score += 120;
  if (normalizedCity === normalizedQuery) score += 900;
  else if (normalizedCity.startsWith(normalizedQuery)) score += 650;
  else if (normalizedCity.includes(normalizedQuery)) score += 420;
  if (normalizedAliases.some((alias) => alias === normalizedQuery)) score += 850;
  else if (normalizedAliases.some((alias) => alias.startsWith(normalizedQuery))) score += 650;
  else if (normalizedAliases.some((alias) => alias.includes(normalizedQuery))) score += 420;

  if (queryTokens.length) {
    if (queryTokens.every((token) => neighborhoodTokens.some((candidate) => candidate.includes(token)))) {
      score += 400;
    }
    if (queryTokens.every((token) => nameTokens.some((candidate) => candidate.includes(token)))) {
      score += 180;
    }
    if (queryTokens.every((token) => cityTokens.some((candidate) => candidate.includes(token)))) {
      score += 260;
    }
    if (queryTokens.every((token) => aliasTokens.some((candidate) => candidate.includes(token)))) {
      score += 280;
    }
    score += queryTokens.filter((token) => neighborhoodTokens.some((candidate) => candidate.includes(token))).length * 40;
  }

  return score;
}

function buildCuratedAliasToCanonicalMap() {
  const map = new Map<string, string>();
  for (const item of CURATED_GUADALAJARA_NEIGHBORHOODS) {
    const canonical = normalizeLocationText(item.neighborhood);
    const names = [item.neighborhood, ...(item.aliases ?? [])];
    if (item.city) names.push(item.city);
    for (const name of names) {
      map.set(normalizeLocationText(name), canonical);
    }
  }
  return map;
}

const CURATED_ALIAS_TO_CANONICAL = buildCuratedAliasToCanonicalMap();

/** Canonical key for collapsing alias variants (e.g. Americana vs Colonia Americana). */
export function suggestionDedupeKey(neighborhood: string | null, city: string) {
  const primary = (neighborhood ?? city).trim();
  if (!primary) return normalizeLocationText(city);
  const normalized = normalizeLocationText(primary);
  return CURATED_ALIAS_TO_CANONICAL.get(normalized) ?? normalized;
}

type ScoredLocationSuggestion = LocationSuggestion & { score: number };

function isBetterSuggestion(candidate: ScoredLocationSuggestion, current: ScoredLocationSuggestion) {
  const candidateCurated = candidate.key.startsWith("curated:");
  const currentCurated = current.key.startsWith("curated:");
  if (candidateCurated !== currentCurated) return candidateCurated;

  if (candidate.score !== current.score) return candidate.score > current.score;
  return candidate.label.length > current.label.length;
}

export function mergeLocationSuggestions(
  curated: ScoredLocationSuggestion[],
  nominatim: ScoredLocationSuggestion[],
): LocationSuggestion[] {
  const bestByKey = new Map<string, ScoredLocationSuggestion>();

  for (const item of [...curated, ...nominatim]) {
    const key = suggestionDedupeKey(item.neighborhood, item.city);
    const prev = bestByKey.get(key);
    if (!prev || isBetterSuggestion(item, prev)) {
      bestByKey.set(key, item);
    }
  }

  return [...bestByKey.values()]
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "es-MX"))
    .map(({ score: _score, ...item }) => item);
}

function buildCuratedSuggestions(query: string): Array<LocationSuggestion & { score: number }> {
  return CURATED_GUADALAJARA_NEIGHBORHOODS.map((item) => {
    const city = item.city ?? GUADALAJARA_CITY;
    const prefix = cityAbbreviation(city);
    const primaryName = item.neighborhood;
    const isMunicipality = normalizeLocationText(primaryName) === normalizeLocationText(city);
    const label = `${prefix} - ${primaryName}`;
    return {
      key: `curated:${item.neighborhood}`,
      label,
      value: label,
      city,
      neighborhood: primaryName,
      lat: item.lat,
      lng: item.lng,
      zoom: isMunicipality ? GUADALAJARA_MUNICIPALITY_ZOOM : GUADALAJARA_NEIGHBORHOOD_ZOOM,
      score: scoreLocationMatch(
        query,
        primaryName,
        city,
        `${primaryName}, ${city}, Jalisco`,
        primaryName,
        item.aliases ?? [],
      ),
    };
  }).filter((item) => item.score > 0);
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
    const payloadById = new Map<number, NominatimSearchResult>();
    for (const searchQuery of searchQueries) {
      const result = await runSearch(searchQuery);
      if (!result?.length) continue;
      for (const item of result) {
        if (!isWithinGuadalajara(item.address)) continue;
        payloadById.set(item.place_id, item);
      }
    }
    const payload = [...payloadById.values()];

    const nominatimSuggestions = payload
      .map((item) => {
        const neighborhood = pickNeighborhood(item.address);
        const city = pickCity(item.address);
        const primaryName = neighborhood || city;
        const prefix = cityAbbreviation(city);
        const label = `${prefix} - ${primaryName}`;
        const displayName = item.display_name ?? "";
        const fallbackName = item.name ?? primaryName;
        const isMunicipality = normalizeLocationText(primaryName) === normalizeLocationText(city);
        return {
          key: `${label}:${item.lat}:${item.lon}`,
          label,
          value: label,
          city,
          neighborhood: neighborhood || null,
          lat: Number(item.lat),
          lng: Number(item.lon),
          zoom: isMunicipality ? GUADALAJARA_MUNICIPALITY_ZOOM : GUADALAJARA_NEIGHBORHOOD_ZOOM,
          score: scoreLocationMatch(q, primaryName, city, displayName, fallbackName),
        };
      })
      .filter((item) => {
        if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return false;
        return true;
      });

    const suggestions = mergeLocationSuggestions(buildCuratedSuggestions(q), nominatimSuggestions);

    res.json(suggestions);
  } catch {
    res.status(502).json({ error: "location_search_unavailable" });
  }
}

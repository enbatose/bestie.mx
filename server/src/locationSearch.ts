import type { Request, Response } from "express";
import {
  DEFAULT_METRO_CITY,
  METRO_CITIES,
  resolveMetroCity,
  type MetroCity,
} from "./metroCities.js";

type NominatimAddress = Record<string, string | undefined>;

type NominatimSearchResult = {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
  address?: NominatimAddress;
};

export type LocationSuggestionKind = "city" | "neighborhood" | "address";

export type LocationSuggestion = {
  key: string;
  label: string;
  value: string;
  kind: LocationSuggestionKind;
  cityCode: string;
  city: string;
  neighborhood: string | null;
  lat: number;
  lng: number;
  zoom: number;
  /** Street address (road + house number) for address-kind results. */
  streetAddress?: string;
};

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
  {
    city: "Zapopan",
    neighborhood: "Valle Real",
    lat: 20.7269,
    lng: -103.4308,
    aliases: ["Valle Real", "Fraccionamiento Valle Real"],
  },
];

/** Point pins used to reverse-resolve colonia names inside a saved map bbox. */
export function curatedNeighborhoodPins(): ReadonlyArray<{
  neighborhood: string;
  lat: number;
  lng: number;
}> {
  return CURATED_GUADALAJARA_NEIGHBORHOODS.map(({ neighborhood, lat, lng }) => ({
    neighborhood,
    lat,
    lng,
  }));
}

function normalizeLocationText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function metroAreaSet(metro: MetroCity) {
  return new Set(metro.metroAreas.map(normalizeLocationText));
}

function isWithinMetro(address: NominatimAddress | undefined, metro: MetroCity) {
  if (!address) return false;
  const areas = metroAreaSet(metro);
  const candidates = [
    address.city,
    address.town,
    address.municipality,
    address.county,
    address.state_district,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map(normalizeLocationText);
  return candidates.some((value) => areas.has(value));
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

function pickCity(address: NominatimAddress | undefined, fallback: string) {
  if (!address) return fallback;
  return (
    address.city ||
    address.town ||
    address.municipality ||
    address.county ||
    fallback
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

function buildCitySuggestions(query: string): ScoredLocationSuggestion[] {
  const normalizedQuery = normalizeLocationText(query);
  return METRO_CITIES.filter((metro) => metro.enabled)
    .map((metro) => {
      const label = `${metro.abbr} - ${metro.label}`;
      const score = Math.max(
        scoreLocationMatch(query, metro.label, metro.label, label, metro.label, [metro.abbr, metro.metroName]),
        scoreLocationMatch(query, metro.abbr, metro.label, label, metro.abbr, [metro.label, metro.metroName]),
      );
      return {
        key: `city:${metro.code}`,
        label,
        value: label,
        kind: "city" as const,
        cityCode: metro.code,
        city: metro.label,
        neighborhood: null,
        lat: metro.defaultCenter[0],
        lng: metro.defaultCenter[1],
        zoom: metro.defaultZoom,
        score,
      };
    })
    .filter((item) => item.score > 0 || normalizedQuery.length === 0);
}

export function buildCuratedNeighborhoodSuggestions(
  query: string,
  metro: MetroCity,
): Array<LocationSuggestion & { score: number }> {
  if (metro.code !== "gdl") return [];

  return CURATED_GUADALAJARA_NEIGHBORHOODS.map((item) => {
    const city = item.city ?? metro.label;
    const primaryName = item.neighborhood;
    const isMunicipality = normalizeLocationText(primaryName) === normalizeLocationText(city);
    const label = `${metro.abbr} - ${primaryName}`;
    return {
      key: `curated:${item.neighborhood}`,
      label,
      value: label,
      kind: "neighborhood" as const,
      cityCode: metro.code,
      city,
      neighborhood: primaryName,
      lat: item.lat,
      lng: item.lng,
      zoom: isMunicipality ? metro.municipalityZoom : metro.neighborhoodZoom,
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

function buildStreetLabel(
  address: NominatimAddress | undefined,
  metro: MetroCity,
): { label: string; streetAddress: string | undefined; neighborhood: string | null } {
  const houseNumber = address?.house_number?.trim() ?? "";
  const road =
    (address?.road ?? address?.pedestrian ?? address?.footway ?? address?.residential ?? "").trim();
  const streetAddress = [houseNumber, road].filter(Boolean).join(" ") || undefined;
  const neighborhood = pickNeighborhood(address);
  const city = pickCity(address, metro.label);

  const parts: string[] = [];
  if (streetAddress) parts.push(streetAddress);
  if (neighborhood && neighborhood !== streetAddress) parts.push(neighborhood);
  else if (!streetAddress && city) parts.push(city);

  const primaryText = parts.join(", ");
  const label = primaryText ? `${primaryText} — ${metro.abbr}` : metro.abbr;
  return { label, streetAddress, neighborhood: neighborhood || null };
}

export async function locationSearchHandler(req: Request, res: Response) {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const cityCode = typeof req.query.city === "string" ? req.query.city.trim() : "";
  const scope = typeof req.query.scope === "string" ? req.query.scope.trim() : "";
  const metro = resolveMetroCity(cityCode || DEFAULT_METRO_CITY.code);
  const isPublishScope = scope === "publish";
  const searchNeighborhoods = isPublishScope || scope === "neighborhood" || Boolean(cityCode);

  if (q.length < 2) {
    res.json([]);
    return;
  }

  if (!searchNeighborhoods) {
    res.json(buildCitySuggestions(q).map(({ score: _score, ...item }) => item));
    return;
  }

  async function runSearch(searchQuery: string) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", searchQuery);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", isPublishScope ? "10" : "8");
    url.searchParams.set("countrycodes", "mx");
    url.searchParams.set(
      "viewbox",
      `${metro.viewbox.left},${metro.viewbox.top},${metro.viewbox.right},${metro.viewbox.bottom}`,
    );
    url.searchParams.set("bounded", "1");
    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "bestie.mx-publish-wizard",
        "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
      },
    });
    if (!upstream.ok) return null;
    return (await upstream.json()) as NominatimSearchResult[];
  }

  try {
    const searchQueries = [
      `${q}, ${metro.label}, Jalisco, Mexico`,
      `${q}, Jalisco, Mexico`,
      q,
    ];
    const payloadById = new Map<number, NominatimSearchResult>();
    for (const searchQuery of searchQueries) {
      const result = await runSearch(searchQuery);
      if (!result?.length) continue;
      for (const item of result) {
        if (!isWithinMetro(item.address, metro)) continue;
        payloadById.set(item.place_id, item);
      }
    }
    const payload = [...payloadById.values()];

    if (isPublishScope) {
      // Publish scope: return street-level addresses + neighborhoods, each unique by place_id.
      // No neighborhood deduplication — individual addresses must all appear.
      const addressSuggestions = payload
        .map((item) => {
          const { label, streetAddress, neighborhood } = buildStreetLabel(item.address, metro);
          const city = pickCity(item.address, metro.label);
          const hasStreet = Boolean(streetAddress);
          const kind: LocationSuggestionKind = hasStreet ? "address" : "neighborhood";
          const zoom = hasStreet ? 17 : metro.neighborhoodZoom;
          const fallbackName = item.name ?? streetAddress ?? neighborhood ?? city;
          const score = scoreLocationMatch(
            q,
            streetAddress ?? neighborhood ?? city,
            city,
            item.display_name ?? "",
            fallbackName,
          );
          return {
            key: `publish:${item.place_id}`,
            label,
            value: label,
            kind,
            cityCode: metro.code,
            city,
            neighborhood,
            lat: Number(item.lat),
            lng: Number(item.lon),
            zoom,
            streetAddress,
            score,
          };
        })
        .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));

      const curatedSuggestions = buildCuratedNeighborhoodSuggestions(q, metro).map((s) => ({
        ...s,
        streetAddress: undefined,
      }));

      const combined = [...curatedSuggestions, ...addressSuggestions]
        .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "es-MX"))
        .slice(0, 8)
        .map(({ score: _score, ...item }) => item);

      res.json(combined);
      return;
    }

    const nominatimSuggestions = payload
      .map((item) => {
        const neighborhood = pickNeighborhood(item.address);
        const city = pickCity(item.address, metro.label);
        const primaryName = neighborhood || city;
        const label = `${metro.abbr} - ${primaryName}`;
        const displayName = item.display_name ?? "";
        const fallbackName = item.name ?? primaryName;
        const isMunicipality = normalizeLocationText(primaryName) === normalizeLocationText(city);
        return {
          key: `${label}:${item.lat}:${item.lon}`,
          label,
          value: label,
          kind: "neighborhood" as const,
          cityCode: metro.code,
          city,
          neighborhood: neighborhood || null,
          lat: Number(item.lat),
          lng: Number(item.lon),
          zoom: isMunicipality ? metro.municipalityZoom : metro.neighborhoodZoom,
          score: scoreLocationMatch(q, primaryName, city, displayName, fallbackName),
        };
      })
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));

    const suggestions = mergeLocationSuggestions(
      buildCuratedNeighborhoodSuggestions(q, metro),
      nominatimSuggestions,
    );

    res.json(suggestions);
  } catch {
    res.status(502).json({ error: "location_search_unavailable" });
  }
}

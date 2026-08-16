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

function isJunkAreaName(value: string) {
  const n = normalizeLocationText(value);
  return n.startsWith("municipio de") || n === "region centro" || n.length === 0;
}

function pickNeighborhood(address: NominatimAddress | undefined) {
  if (!address) return "";
  const candidates = [
    address.neighbourhood,
    address.suburb,
    address.quarter,
    address.village,
    address.hamlet,
    address.city_district,
    address.borough,
    address.residential,
  ];
  for (const value of candidates) {
    const trimmed = value?.trim() ?? "";
    if (trimmed && !isJunkAreaName(trimmed)) return trimmed;
  }
  return "";
}

function pickCity(address: NominatimAddress | undefined, fallback: string) {
  if (!address) return fallback;
  const candidates = [address.city, address.town, address.municipality, address.county];
  for (const value of candidates) {
    const trimmed = value?.trim() ?? "";
    if (trimmed && !isJunkAreaName(trimmed)) return trimmed;
  }
  return fallback;
}

/** Guadalajara + Zapopan first; remaining ZMG municipalities follow. */
const MUNICIPALITY_SORT_RANK: Record<string, number> = {
  guadalajara: 0,
  zapopan: 1,
  tlaquepaque: 2,
  "san pedro tlaquepaque": 2,
  tonala: 3,
  tlajomulco: 4,
  "tlajomulco de zuniga": 4,
  "el salto": 5,
  "ixtlahuacan de los membrillos": 6,
  juanacatlan: 7,
};

export function municipalitySortRank(city: string): number {
  return MUNICIPALITY_SORT_RANK[normalizeLocationText(city)] ?? 20;
}

const STREET_PREFIX_RE =
  /^(calle|avenida|av\.?|blvd\.?|boulevard|calzada|circuito|cerrada|privada|andador|camino)\s+/i;

export function normalizeStreetName(value: string): string {
  let n = normalizeLocationText(value);
  n = n.replace(STREET_PREFIX_RE, "");
  n = n.replace(/\s+\d+[a-z]?(?:-\d+[a-z]?)?$/, "");
  return n.trim();
}

/**
 * Mexican queries put the house number after the street ("Av México 2582").
 * 5-digit tokens are treated as postcodes, not house numbers.
 */
export function parseHouseNumberFromQuery(query: string): string | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const numbered = trimmed.match(
    /(?:^|[\s,.#])(?:n(?:um(?:ero)?)?\.?\s*)?(\d{1,4}(?:\s*-\s*[a-z0-9]{1,3})?[a-z]?)\s*$/i,
  );
  if (!numbered?.[1]) return null;
  const raw = numbered[1].replace(/\s+/g, "");
  if (/^\d{5}$/.test(raw)) return null;
  return raw.toUpperCase();
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

function streetAddressHouseNumber(streetAddress: string | undefined): string | null {
  if (!streetAddress) return null;
  const match = streetAddress.trim().match(/(\d{1,4}(?:-[a-z0-9]{1,3})?[a-z]?)$/i);
  return match?.[1] ?? null;
}

type ScoredPublishSuggestion = LocationSuggestion & { score: number };

function isNearbyPublishDuplicate(a: ScoredPublishSuggestion, b: ScoredPublishSuggestion): boolean {
  const roadA = normalizeStreetName(a.streetAddress ?? a.neighborhood ?? "");
  const roadB = normalizeStreetName(b.streetAddress ?? b.neighborhood ?? "");
  const areaA = normalizeLocationText(a.neighborhood ?? "");
  const areaB = normalizeLocationText(b.neighborhood ?? "");
  const cityA = normalizeLocationText(a.city);
  const cityB = normalizeLocationText(b.city);
  const distance = haversineMeters(a.lat, a.lng, b.lat, b.lng);
  const sameRoad = Boolean(roadA && roadB && roadA === roadB);
  const sameArea = Boolean(areaA && areaB && areaA === areaB);
  const sameCity = cityA === cityB;
  const houseA = streetAddressHouseNumber(a.streetAddress);
  const houseB = streetAddressHouseNumber(b.streetAddress);
  const sameHouse = Boolean(houseA && houseB && houseA === houseB);

  // Same street + same house number: OSM splits one avenue into many ways.
  if (sameRoad && sameHouse) return true;
  if (sameRoad && sameArea) return true;
  // Unlabeled segments of the same street in the same municipality.
  if (sameRoad && sameCity && !areaA && !areaB) return true;
  if (sameRoad && distance < 1200) return true;
  if (!a.streetAddress && !b.streetAddress && sameArea && sameCity && distance < 600) return true;
  if (sameRoad && sameCity && distance < 800) return true;
  return false;
}

function isBetterPublishDuplicate(
  candidate: ScoredPublishSuggestion,
  current: ScoredPublishSuggestion,
): boolean {
  const specDelta = publishSpecificityRank(candidate) - publishSpecificityRank(current);
  if (specDelta !== 0) return specDelta < 0;
  const muniDelta = municipalitySortRank(candidate.city) - municipalitySortRank(current.city);
  if (muniDelta !== 0) return muniDelta < 0;
  return candidate.score > current.score;
}

function publishSpecificityRank(item: ScoredPublishSuggestion): number {
  const hasHouse = Boolean(streetAddressHouseNumber(item.streetAddress));
  if (hasHouse && item.neighborhood) return 0;
  if (hasHouse) return 1;
  if (item.kind === "address" && item.neighborhood) return 2;
  if (item.kind === "address") return 3;
  if (item.neighborhood) return 4;
  return 5;
}

export function sortPublishSuggestions(items: ScoredPublishSuggestion[]): ScoredPublishSuggestion[] {
  return [...items].sort((a, b) => {
    const muni = municipalitySortRank(a.city) - municipalitySortRank(b.city);
    if (muni !== 0) return muni;
    const spec = publishSpecificityRank(a) - publishSpecificityRank(b);
    if (spec !== 0) return spec;
    if (b.score !== a.score) return b.score - a.score;
    return a.label.localeCompare(b.label, "es-MX");
  });
}

/** Collapse OSM road-segment duplicates; keep Guadalajara/Zapopan hits first. */
export function dedupePublishSuggestions(items: ScoredPublishSuggestion[]): ScoredPublishSuggestion[] {
  const kept: ScoredPublishSuggestion[] = [];
  for (const item of sortPublishSuggestions(items)) {
    const dupOf = kept.find((prev) => isNearbyPublishDuplicate(prev, item));
    if (!dupOf) {
      kept.push(item);
      continue;
    }
    if (isBetterPublishDuplicate(item, dupOf)) {
      kept.splice(kept.indexOf(dupOf), 1, item);
    }
  }
  return kept;
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

export function buildStreetLabel(
  address: NominatimAddress | undefined,
  metro: MetroCity,
  queryHouseNumber?: string | null,
): { label: string; streetAddress: string | undefined; neighborhood: string | null } {
  const osmHouse = address?.house_number?.trim() ?? "";
  const houseNumber = osmHouse || queryHouseNumber?.trim() || "";
  const road = (address?.road || address?.pedestrian || address?.footway || "").trim();
  // Mexican convention: street name, then house number ("Avenida México 2582").
  const streetAddress = [road, houseNumber].filter(Boolean).join(" ") || undefined;
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
      const queryHouseNumber = parseHouseNumberFromQuery(q);
      const looksLikeStreetQuery =
        Boolean(queryHouseNumber) || STREET_PREFIX_RE.test(q.trim());

      const addressSuggestions = payload
        .map((item) => {
          const { label, streetAddress, neighborhood } = buildStreetLabel(
            item.address,
            metro,
            queryHouseNumber,
          );
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

      const curatedSuggestions = looksLikeStreetQuery
        ? []
        : buildCuratedNeighborhoodSuggestions(q, metro).map((s) => ({
            ...s,
            streetAddress: undefined,
          }));

      const combined = sortPublishSuggestions(
        dedupePublishSuggestions([...curatedSuggestions, ...addressSuggestions]),
      )
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

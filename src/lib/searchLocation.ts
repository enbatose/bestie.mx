import {
  DEFAULT_METRO_CITY,
  findMetroCity,
  metroCityLabel,
  resolveMetroCity,
  type MetroCity,
} from "@/lib/metroCities";

export type SearchNeighborhoodPin = {
  name: string;
  lat: number;
  lng: number;
};

/** Approx. half-span (degrees) around a neighborhood pin at neighborhood zoom. */
export const NEIGHBORHOOD_FIT_HALF_SPAN_LAT = 0.016;
export const NEIGHBORHOOD_FIT_HALF_SPAN_LNG = 0.018;

export type LatLngBoundsBox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export function neighborhoodPinBounds(pin: SearchNeighborhoodPin): LatLngBoundsBox {
  return {
    minLat: pin.lat - NEIGHBORHOOD_FIT_HALF_SPAN_LAT,
    maxLat: pin.lat + NEIGHBORHOOD_FIT_HALF_SPAN_LAT,
    minLng: pin.lng - NEIGHBORHOOD_FIT_HALF_SPAN_LNG,
    maxLng: pin.lng + NEIGHBORHOOD_FIT_HALF_SPAN_LNG,
  };
}

export function combinedNeighborhoodBounds(
  neighborhoods: readonly SearchNeighborhoodPin[],
): LatLngBoundsBox | null {
  if (!neighborhoods.length) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const pin of neighborhoods) {
    const bounds = neighborhoodPinBounds(pin);
    minLat = Math.min(minLat, bounds.minLat);
    maxLat = Math.max(maxLat, bounds.maxLat);
    minLng = Math.min(minLng, bounds.minLng);
    maxLng = Math.max(maxLng, bounds.maxLng);
  }

  return { minLat, maxLat, minLng, maxLng };
}

export type SearchLocationState = {
  cityCode: string;
  cityAbbr: string;
  cityLabel: string;
  neighborhoods: SearchNeighborhoodPin[];
  lat: number;
  lng: number;
  zoom: number;
};

function parseNumberParam(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Remove a leading metro prefix such as "GDL - " from a stored neighborhood label. */
export function stripMetroLabelPrefix(abbr: string, value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const prefix = `${abbr} - `;
  if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
    const stripped = trimmed.slice(prefix.length).trim();
    return stripped || null;
  }
  return trimmed;
}

export function normalizeNeighborhoodName(value: string): string {
  return value.trim().toLowerCase();
}

export function neighborhoodNamesMatch(a: string, b: string): boolean {
  return normalizeNeighborhoodName(a) === normalizeNeighborhoodName(b);
}

function parseNeighborhoodPins(
  params: URLSearchParams,
  metro: MetroCity,
): SearchNeighborhoodPin[] {
  const raw = params.get("nbh")?.trim() || params.get("loc")?.trim() || null;
  if (!raw) return [];

  const names = raw
    .split(",")
    .map((part) => stripMetroLabelPrefix(metro.abbr, part.trim()))
    .filter((name): name is string => Boolean(name));

  if (!names.length) return [];

  const ptsRaw = params.get("nbhPts")?.trim();
  if (ptsRaw) {
    const coords = ptsRaw.split(";").map((part) => {
      const [latRaw, lngRaw] = part.split(",").map((s) => s.trim());
      const lat = Number(latRaw);
      const lng = Number(lngRaw);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    });

    return names.flatMap((name, index) => {
      const coord = coords[index];
      if (!coord) return [];
      return [{ name, lat: coord.lat, lng: coord.lng }];
    });
  }

  if (names.length === 1) {
    const lat = parseNumberParam(params.get("lat"));
    const lng = parseNumberParam(params.get("lng"));
    if (lat != null && lng != null) {
      return [{ name: names[0]!, lat, lng }];
    }
  }

  return names.map((name) => ({
    name,
    lat: metro.defaultCenter[0],
    lng: metro.defaultCenter[1],
  }));
}

export function computeNeighborhoodsViewport(
  neighborhoods: readonly SearchNeighborhoodPin[],
  metro: MetroCity = DEFAULT_METRO_CITY,
): { lat: number; lng: number; zoom: number } {
  if (!neighborhoods.length) {
    return {
      lat: metro.defaultCenter[0],
      lng: metro.defaultCenter[1],
      zoom: metro.defaultZoom,
    };
  }

  if (neighborhoods.length === 1) {
    const pin = neighborhoods[0]!;
    return {
      lat: pin.lat,
      lng: pin.lng,
      zoom: metro.neighborhoodZoom,
    };
  }

  const bounds = combinedNeighborhoodBounds(neighborhoods);
  if (!bounds) {
    return {
      lat: metro.defaultCenter[0],
      lng: metro.defaultCenter[1],
      zoom: metro.defaultZoom,
    };
  }

  const latSpan = Math.max(bounds.maxLat - bounds.minLat, NEIGHBORHOOD_FIT_HALF_SPAN_LAT * 2);
  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, NEIGHBORHOOD_FIT_HALF_SPAN_LNG * 2);
  const span = Math.max(latSpan, lngSpan);
  const zoom = Math.min(metro.neighborhoodZoom, Math.max(9, Math.round(Math.log2(0.42 / span))));

  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2,
    zoom,
  };
}

export function metroDefaultLocation(metro: MetroCity = DEFAULT_METRO_CITY): SearchLocationState {
  return {
    cityCode: metro.code,
    cityAbbr: metro.abbr,
    cityLabel: metro.label,
    neighborhoods: [],
    lat: metro.defaultCenter[0],
    lng: metro.defaultCenter[1],
    zoom: metro.defaultZoom,
  };
}

export function parseSearchLocation(
  params: URLSearchParams,
  routeCityCode?: string | null,
): SearchLocationState {
  const metro = resolveMetroCity(routeCityCode ?? params.get("city"));
  const neighborhoods = parseNeighborhoodPins(params, metro);
  const lat = parseNumberParam(params.get("lat")) ?? metro.defaultCenter[0];
  const lng = parseNumberParam(params.get("lng")) ?? metro.defaultCenter[1];
  const zoom = parseNumberParam(params.get("z")) ?? metro.defaultZoom;

  return {
    cityCode: metro.code,
    cityAbbr: metro.abbr,
    cityLabel: metro.label,
    neighborhoods,
    lat,
    lng,
    zoom,
  };
}

export function writeSearchLocation(params: URLSearchParams, location: SearchLocationState) {
  if (location.neighborhoods.length) {
    params.set("nbh", location.neighborhoods.map((pin) => pin.name).join(","));
    params.set(
      "nbhPts",
      location.neighborhoods.map((pin) => `${pin.lat},${pin.lng}`).join(";"),
    );
  } else {
    params.delete("nbh");
    params.delete("nbhPts");
  }
  params.set("lat", String(location.lat));
  params.set("lng", String(location.lng));
  params.set("z", String(location.zoom));
  params.delete("loc");
  params.delete("city");
  return params;
}

export function searchLocationDisplayLabel(location: SearchLocationState): string {
  if (location.neighborhoods.length === 1) {
    return neighborhoodChipLabel(location.neighborhoods[0]!.name, location.cityAbbr);
  }
  if (location.neighborhoods.length > 1) {
    const labels = location.neighborhoods.map((pin) => neighborhoodChipLabel(pin.name, location.cityAbbr));
    return `${labels.slice(0, 2).join(", ")}${location.neighborhoods.length > 2 ? ` +${location.neighborhoods.length - 2}` : ""}`;
  }
  return metroCityLabel(resolveMetroCity(location.cityCode));
}

export function neighborhoodChipLabel(name: string, cityAbbr: string): string {
  return stripMetroLabelPrefix(cityAbbr, name) ?? name;
}

export function isDefaultMetroLocation(location: SearchLocationState): boolean {
  const metro = resolveMetroCity(location.cityCode);
  return (
    location.cityCode === metro.code &&
    location.neighborhoods.length === 0 &&
    location.lat === metro.defaultCenter[0] &&
    location.lng === metro.defaultCenter[1] &&
    location.zoom === metro.defaultZoom
  );
}

export function routeCityCodeFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/buscar(?:\/([a-z]{2,4}))?\/?$/i);
  if (!match) return null;
  return match[1] ?? null;
}

export function searchPathForCity(cityCode: string): string {
  const metro = findMetroCity(cityCode);
  if (!metro) return "/buscar";
  return `/buscar/${metro.code}`;
}

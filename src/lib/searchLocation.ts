import {
  DEFAULT_METRO_CITY,
  findMetroCity,
  metroCityLabel,
  resolveMetroCity,
  type MetroCity,
} from "@/lib/metroCities";

export type SearchLocationState = {
  cityCode: string;
  cityAbbr: string;
  cityLabel: string;
  neighborhood: string | null;
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

export function metroDefaultLocation(metro: MetroCity = DEFAULT_METRO_CITY): SearchLocationState {
  return {
    cityCode: metro.code,
    cityAbbr: metro.abbr,
    cityLabel: metro.label,
    neighborhood: null,
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
  const rawNeighborhood = params.get("nbh")?.trim() || params.get("loc")?.trim() || null;
  const neighborhood = stripMetroLabelPrefix(metro.abbr, rawNeighborhood);
  const lat = parseNumberParam(params.get("lat")) ?? metro.defaultCenter[0];
  const lng = parseNumberParam(params.get("lng")) ?? metro.defaultCenter[1];
  const zoom = parseNumberParam(params.get("z")) ?? metro.defaultZoom;

  return {
    cityCode: metro.code,
    cityAbbr: metro.abbr,
    cityLabel: metro.label,
    neighborhood,
    lat,
    lng,
    zoom,
  };
}

export function writeSearchLocation(params: URLSearchParams, location: SearchLocationState) {
  if (location.neighborhood) params.set("nbh", location.neighborhood);
  else params.delete("nbh");
  params.set("lat", String(location.lat));
  params.set("lng", String(location.lng));
  params.set("z", String(location.zoom));
  params.delete("loc");
  params.delete("city");
  return params;
}

export function searchLocationDisplayLabel(location: SearchLocationState): string {
  if (location.neighborhood) {
    return stripMetroLabelPrefix(location.cityAbbr, location.neighborhood) ?? location.neighborhood;
  }
  return metroCityLabel(resolveMetroCity(location.cityCode));
}

export function neighborhoodChipLabel(location: SearchLocationState): string {
  if (!location.neighborhood) return "";
  return stripMetroLabelPrefix(location.cityAbbr, location.neighborhood) ?? location.neighborhood;
}

export function isDefaultMetroLocation(location: SearchLocationState): boolean {
  const metro = resolveMetroCity(location.cityCode);
  return (
    location.cityCode === metro.code &&
    location.neighborhood == null &&
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

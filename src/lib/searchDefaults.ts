export const DEFAULT_SEARCH_CITY = "Guadalajara";

export const GUADALAJARA_LA_MINERVA_CENTER: [number, number] = [20.67439, -103.38739];

export const GUADALAJARA_LA_MINERVA_ZOOM = 13;

export function withDefaultSearchCity(query: string): string {
  const trimmed = query.trim();
  return trimmed || DEFAULT_SEARCH_CITY;
}

export function isDefaultSearchCity(query: string): boolean {
  return query.trim().toLowerCase() === DEFAULT_SEARCH_CITY.toLowerCase();
}

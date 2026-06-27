export type MetroCity = {
  code: string;
  label: string;
  abbr: string;
  metroName: string;
  enabled: boolean;
  defaultCenter: [number, number];
  defaultZoom: number;
  neighborhoodZoom: number;
  municipalityZoom: number;
};

export const METRO_CITIES: readonly MetroCity[] = [
  {
    code: "gdl",
    label: "Guadalajara",
    abbr: "GDL",
    metroName: "ZMG",
    enabled: true,
    defaultCenter: [20.67439, -103.38739],
    defaultZoom: 13,
    neighborhoodZoom: 14,
    municipalityZoom: 12,
  },
  {
    code: "mty",
    label: "Monterrey",
    abbr: "MTY",
    metroName: "ZMM",
    enabled: false,
    defaultCenter: [25.6866, -100.3161],
    defaultZoom: 12,
    neighborhoodZoom: 14,
    municipalityZoom: 12,
  },
  {
    code: "cmx",
    label: "Ciudad de México",
    abbr: "CMX",
    metroName: "ZMMV",
    enabled: false,
    defaultCenter: [19.4326, -99.1332],
    defaultZoom: 12,
    neighborhoodZoom: 14,
    municipalityZoom: 12,
  },
] as const;

export const DEFAULT_METRO_CITY = METRO_CITIES.find((city) => city.enabled) ?? METRO_CITIES[0]!;

export function normalizeMetroCode(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

export function findMetroCity(code: string | null | undefined): MetroCity | null {
  const normalized = normalizeMetroCode(code);
  if (!normalized) return null;
  return METRO_CITIES.find((city) => city.code === normalized) ?? null;
}

export function resolveMetroCity(code: string | null | undefined): MetroCity {
  const match = findMetroCity(code);
  if (match?.enabled) return match;
  return DEFAULT_METRO_CITY;
}

export function metroCityLabel(metro: MetroCity): string {
  return `${metro.abbr} - ${metro.label}`;
}

export function metroTimeZone(code: string | null | undefined): string {
  switch (normalizeMetroCode(code)) {
    case "mty":
      return "America/Monterrey";
    default:
      return "America/Mexico_City";
  }
}

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
  viewbox: { left: number; top: number; right: number; bottom: number };
  metroAreas: string[];
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
    viewbox: { left: -103.58, top: 20.87, right: -103.12, bottom: 20.37 },
    metroAreas: [
      "Guadalajara",
      "Zapopan",
      "Tlaquepaque",
      "San Pedro Tlaquepaque",
      "Tonalá",
      "Tlajomulco",
      "Tlajomulco de Zúñiga",
      "El Salto",
      "Ixtlahuacán de los Membrillos",
      "Juanacatlán",
    ],
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
    viewbox: { left: -100.45, top: 25.85, right: -100.15, bottom: 25.55 },
    metroAreas: ["Monterrey", "San Pedro Garza García", "Guadalupe", "Santa Catarina"],
  },
  {
    code: "cmx",
    label: "Ciudad de México",
    abbr: "CDMX",
    metroName: "ZMMV",
    enabled: false,
    defaultCenter: [19.4326, -99.1332],
    defaultZoom: 12,
    neighborhoodZoom: 14,
    municipalityZoom: 12,
    viewbox: { left: -99.35, top: 19.55, right: -98.95, bottom: 19.25 },
    metroAreas: ["Ciudad de México", "Miguel Hidalgo", "Benito Juárez", "Coyoacán"],
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

export function metroTimeZone(code: string | null | undefined): string {
  switch (normalizeMetroCode(code)) {
    case "mty":
      return "America/Monterrey";
    default:
      return "America/Mexico_City";
  }
}

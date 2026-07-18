import { metroTimeZone } from "@/lib/metroCities";
import type { SearchFilters } from "@/lib/searchFilters";
import type { SearchLocationState } from "@/lib/searchLocation";

/** "26 jun 2025, 14:35 · Ciudad de México · Roma Norte, Condesa" */
export function formatSavedSearchDraftLabel(
  searchLocation: Pick<SearchLocationState, "cityCode" | "cityLabel" | "neighborhoods">,
  at: Date = new Date(),
): string {
  const tz = metroTimeZone(searchLocation.cityCode);
  const parts = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).formatToParts(at);

  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = (parts.find((p) => p.type === "month")?.value ?? "").replace(/\.$/, "");
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "";
  const dateTime = `${day} ${month} ${year}, ${hour}:${minute}`;

  const city = searchLocation.cityLabel?.trim() || searchLocation.cityCode.toUpperCase();
  const segments = [dateTime, city];
  if (searchLocation.neighborhoods.length) {
    segments.push(searchLocation.neighborhoods.map((n) => n.name).join(", "));
  }
  return segments.join(" · ");
}

export function formatSavedSearchTimestamp(iso: string, cityCode: string): string {
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) return iso;
  const tz = metroTimeZone(cityCode);
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  })
    .format(at)
    .replace(/\s*a\.?\s*m\.?/i, "")
    .replace(/\s*p\.?\s*m\.?/i, "")
    .trim();
}

const GENDER_LABELS: Record<string, string> = {
  female: "Mujeres",
  male: "Hombres",
};

const LODGING_LABELS: Record<string, string> = {
  whole_home: "Casa completa",
  private_room: "Cuarto privado",
  shared_room: "Cuarto compartido",
};

const DIM_LABELS: Record<string, string> = {
  small: "Chica",
  medium: "Mediana",
  large: "Grande",
};

const TAG_LABELS: Record<string, string> = {
  "pet-friendly": "Mascotas",
  parking: "Estacionamiento",
  furnished: "Amueblado",
  "utilities-included": "Servicios incluidos",
  "lgbt-friendly": "LGBT+ friendly",
  "private-bath": "Baño privado",
};

/** Human-readable summary of all active search filters. */
export function describeActiveSearchFilters(
  filters: SearchFilters,
  searchLocation: Pick<SearchLocationState, "cityLabel" | "neighborhoods">,
): string[] {
  const lines: string[] = [];

  lines.push(
    searchLocation.neighborhoods.length
      ? `Ubicación: ${searchLocation.neighborhoods.map((n) => n.name).join(", ")}`
      : `Ciudad: ${searchLocation.cityLabel}`,
  );

  if (filters.budgetMax != null) {
    lines.push(`Renta máxima: $${filters.budgetMax.toLocaleString("es-MX")}`);
  } else if (filters.budgetMin != null) {
    lines.push(`Renta mínima: $${filters.budgetMin.toLocaleString("es-MX")}`);
  }

  if (filters.pref) {
    lines.push(`Género: ${GENDER_LABELS[filters.pref] ?? filters.pref}`);
  }

  if (filters.age != null) {
    lines.push(`Edad: ${filters.age} años`);
  } else if (filters.ageMin != null || filters.ageMax != null) {
    lines.push(`Edad: ${filters.ageMin ?? 18}–${filters.ageMax ?? 99} años`);
  }

  if (filters.wantHouse) lines.push("Tipo: Casa");
  if (filters.wantApartment) lines.push("Tipo: Departamento");
  if (filters.wantLoft) lines.push("Tipo: Loft");
  if (filters.lodgingType) {
    lines.push(`Hospedaje: ${LODGING_LABELS[filters.lodgingType] ?? filters.lodgingType}`);
  }

  if (filters.roomDimensions.length) {
    const labels = filters.roomDimensions.map((d) => DIM_LABELS[d] ?? d).join(", ");
    lines.push(`Tamaño: ${labels}`);
  }

  if (filters.availableFrom) {
    lines.push(`Disponible desde: ${filters.availableFrom}`);
  }

  if (filters.minimalStayMonths != null) {
    lines.push(`Estancia mínima: ${filters.minimalStayMonths} meses`);
  }

  if (filters.avalRequired === true) lines.push("Requiere aval");
  if (filters.avalRequired === false) lines.push("Sin aval");
  if (filters.subletAllowed === true) lines.push("Subarriendo permitido");
  if (filters.subletAllowed === false) lines.push("Sin subarriendo");

  for (const tag of filters.tags) {
    lines.push(TAG_LABELS[tag] ?? tag);
  }

  if (filters.bbox) {
    lines.push("Área del mapa seleccionada");
  }

  return lines;
}

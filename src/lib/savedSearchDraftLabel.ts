import { metroTimeZone } from "@/lib/metroCities";
import type { SearchFilters } from "@/lib/searchFilters";
import type { SearchLocationState } from "@/lib/searchLocation";

/** "Providencia · máx. $8,000" — zone plus one budget chip, not a timestamp. */
export function formatSavedSearchDraftLabel(
  searchLocation: Pick<SearchLocationState, "cityCode" | "cityLabel" | "neighborhoods">,
  filters?: SearchFilters | null,
): string {
  const zone = searchLocation.neighborhoods.length
    ? searchLocation.neighborhoods.map((n) => n.name.trim()).filter(Boolean).join(", ")
    : searchLocation.cityLabel?.trim() || searchLocation.cityCode.toUpperCase();
  const budget =
    filters?.budgetMax != null
      ? `máx. $${Math.round(filters.budgetMax).toLocaleString("es-MX")}`
      : filters?.budgetMin != null
        ? `mín. $${Math.round(filters.budgetMin).toLocaleString("es-MX")}`
        : "";
  return [zone, budget].filter(Boolean).join(" · ").slice(0, 200);
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
  private_room: "Recámara privada",
  shared_room: "Recámara compartida",
};

/** ISO / parseable date → short es-MX; leave human strings as-is. */
function formatFilterAvailableFrom(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const [y, m, d] = trimmed.slice(0, 10).split("-").map(Number);
    if (y && m && d) {
      return new Intl.DateTimeFormat("es-MX", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(y, m - 1, d));
    }
  }

  const parsed = Date.parse(trimmed);
  if (Number.isFinite(parsed) && /\d{4}/.test(trimmed)) {
    return new Intl.DateTimeFormat("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(parsed));
  }

  return trimmed;
}

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
    lines.push(`Disponible desde: ${formatFilterAvailableFrom(filters.availableFrom)}`);
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

/**
 * Compact chip labels for hub cards — short values without field prefixes
 * (city already appears in the card meta line).
 */
const MAX_NEIGHBORHOOD_CHIPS = 2;

export function describeActiveSearchFilterChips(
  filters: SearchFilters,
  searchLocation: Pick<SearchLocationState, "cityLabel" | "neighborhoods">,
): string[] {
  const chips: string[] = [];

  // High-value chips first so a long list of colonias can't crowd out budget/type/gender.
  if (filters.budgetMax != null) {
    chips.push(`Máx. $${filters.budgetMax.toLocaleString("es-MX")}`);
  } else if (filters.budgetMin != null) {
    chips.push(`Mín. $${filters.budgetMin.toLocaleString("es-MX")}`);
  }

  if (filters.wantHouse) chips.push("Casa");
  if (filters.wantApartment) chips.push("Departamento");
  if (filters.wantLoft) chips.push("Loft");
  if (filters.lodgingType) {
    chips.push(LODGING_LABELS[filters.lodgingType] ?? filters.lodgingType);
  }

  if (filters.pref) {
    chips.push(GENDER_LABELS[filters.pref] ?? filters.pref);
  }

  if (searchLocation.neighborhoods.length) {
    const names = searchLocation.neighborhoods
      .map((n) => n.name.trim())
      .filter((name) => name.length > 0);
    for (const name of names.slice(0, MAX_NEIGHBORHOOD_CHIPS)) {
      chips.push(name);
    }
    const extraNeighborhoods = names.length - MAX_NEIGHBORHOOD_CHIPS;
    if (extraNeighborhoods > 0) {
      chips.push(`+${extraNeighborhoods} colonia${extraNeighborhoods === 1 ? "" : "s"}`);
    }
  }

  if (filters.age != null) {
    chips.push(`${filters.age} años`);
  } else if (filters.ageMin != null || filters.ageMax != null) {
    chips.push(`${filters.ageMin ?? 18}–${filters.ageMax ?? 99} años`);
  }

  if (filters.roomDimensions.length) {
    for (const d of filters.roomDimensions) {
      chips.push(DIM_LABELS[d] ?? d);
    }
  }

  if (filters.availableFrom) {
    chips.push(`Desde ${formatFilterAvailableFrom(filters.availableFrom)}`);
  }

  if (filters.minimalStayMonths != null) {
    chips.push(
      filters.minimalStayMonths === 1
        ? "1 mes mín."
        : `${filters.minimalStayMonths} meses mín.`,
    );
  }

  if (filters.avalRequired === true) chips.push("Requiere aval");
  if (filters.avalRequired === false) chips.push("Sin aval");
  if (filters.subletAllowed === true) chips.push("Subarriendo permitido");
  if (filters.subletAllowed === false) chips.push("Sin subarriendo");

  for (const tag of filters.tags) {
    chips.push(TAG_LABELS[tag] ?? tag);
  }

  if (filters.bbox) {
    chips.push("Área del mapa");
  }

  return chips;
}

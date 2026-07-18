import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Calendar,
  DoorClosed,
  House,
  MapPin,
  Scan,
  Tag,
  Warehouse,
} from "lucide-react";
import { PlusOneIcon } from "@/components/icons/PlusOneIcon";
import { MOBILE_MAP_QUICK_FILTERS } from "@/components/search/searchQuickAttributes";
import { listingTagLabel } from "@/components/listing/ListingTagChips";
import { LODGING_TYPE_LABELS } from "@/lib/listingTags";
import { TAG_LABELS, type SearchFilters } from "@/lib/searchFilters";
import type { SearchLocationState } from "@/lib/searchLocation";
import type { ListingTag, RoomDimension } from "@/types/listing";

export type ActiveSearchFilterChip = {
  id: string;
  label: string;
  icon: LucideIcon;
};

const DIM_LABELS: Record<RoomDimension, string> = {
  small: "Recámara chica",
  medium: "Recámara mediana",
  large: "Recámara grande",
};

const QUICK_FILTER_TAG_IDS = new Set(
  MOBILE_MAP_QUICK_FILTERS.flatMap((f) => {
    if (f.id === "tag-mascotas") return ["mascotas"];
    if (f.id === "tag-lgbt-friendly") return ["lgbt-friendly"];
    if (f.id === "private-bathroom") return ["baño-privado"];
    if (f.id === "private-parking") return ["estacionamiento"];
    if (f.id === "furnished") return ["muebles"];
    return [];
  }),
);

function pushChip(chips: ActiveSearchFilterChip[], chip: ActiveSearchFilterChip) {
  if (chips.some((c) => c.id === chip.id)) return;
  chips.push(chip);
}

/** Active search filters as labeled chips with icons (horizontal bar + rail + advanced). */
export function activeSearchFilterChips(
  filters: SearchFilters,
  searchLocation: Pick<SearchLocationState, "cityLabel" | "neighborhoods">,
): ActiveSearchFilterChip[] {
  const chips: ActiveSearchFilterChip[] = [];

  if (searchLocation.neighborhoods.length) {
    pushChip(chips, {
      id: "location-neighborhoods",
      label: searchLocation.neighborhoods.map((n) => n.name).join(", "),
      icon: MapPin,
    });
  } else {
    pushChip(chips, {
      id: "location-city",
      label: searchLocation.cityLabel,
      icon: MapPin,
    });
  }

  for (const filter of MOBILE_MAP_QUICK_FILTERS) {
    if (!filter.isActive(filters)) continue;
    pushChip(chips, {
      id: filter.id,
      label: filter.mobileLabel ?? filter.label,
      icon: filter.icon,
    });
  }

  if (filters.wantHouse) {
    pushChip(chips, { id: "property-house", label: "Casa", icon: House });
  }
  if (filters.wantApartment) {
    pushChip(chips, { id: "property-apartment", label: "Departamento", icon: Building2 });
  }
  if (filters.wantLoft && !chips.some((c) => c.id === "property-loft")) {
    pushChip(chips, { id: "property-loft", label: "Loft", icon: Warehouse });
  }

  if (
    filters.lodgingType &&
    filters.lodgingType !== "private_room" &&
    !chips.some((c) => c.id === "room-private")
  ) {
    const icon = filters.lodgingType === "shared_room" ? PlusOneIcon : House;
    pushChip(chips, {
      id: `lodging-${filters.lodgingType}`,
      label: LODGING_TYPE_LABELS[filters.lodgingType],
      icon,
    });
  }

  for (const tag of filters.tags) {
    if (QUICK_FILTER_TAG_IDS.has(tag)) continue;
    const label = listingTagLabel(tag as ListingTag) || TAG_LABELS[tag as ListingTag] || tag;
    pushChip(chips, {
      id: `tag-${tag}`,
      label,
      icon: Tag,
    });
  }

  for (const dim of filters.roomDimensions) {
    pushChip(chips, {
      id: `room-dim-${dim}`,
      label: DIM_LABELS[dim],
      icon: DoorClosed,
    });
  }

  if (filters.availableFrom) {
    pushChip(chips, {
      id: "available-from",
      label: `Desde ${filters.availableFrom}`,
      icon: Calendar,
    });
  }

  if (filters.minimalStayMonths != null) {
    pushChip(chips, {
      id: "min-stay",
      label: `Estancia mín. ${filters.minimalStayMonths} meses`,
      icon: Calendar,
    });
  }

  if (filters.avalRequired === true) {
    pushChip(chips, { id: "aval-yes", label: "Requiere aval", icon: Tag });
  } else if (filters.avalRequired === false) {
    pushChip(chips, { id: "aval-no", label: "Sin aval", icon: Tag });
  }

  if (filters.subletAllowed === true) {
    pushChip(chips, { id: "sublet-yes", label: "Subarriendo permitido", icon: Tag });
  } else if (filters.subletAllowed === false) {
    pushChip(chips, { id: "sublet-no", label: "Sin subarriendo", icon: Tag });
  }

  if (filters.bbox) {
    pushChip(chips, { id: "map-bbox", label: "Área del mapa", icon: Scan });
  }

  return chips;
}

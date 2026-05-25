import type { ListingStatus } from "@/types/listing";

const REF_BRAND = "BES";

/** Stable 8-char hex slice from property or room ids (incl. `prp__` prefix). */
export function listingReferenceId(rawId: string): string {
  const normalized = rawId.replace(/^prp__/, "").replace(/-/g, "").toUpperCase();
  return normalized.slice(0, 8);
}

export function propertyReferenceCode(propertyId: string): string {
  return `${REF_BRAND}-P-${listingReferenceId(propertyId)}`;
}

export function roomReferenceCode(roomId: string): string {
  return `${REF_BRAND}-A-${listingReferenceId(roomId)}`;
}

const PROPERTY_STATUS_ORDER: Record<ListingStatus, number> = {
  published: 0,
  paused: 1,
  draft: 2,
  archived: 3,
};

export function propertyStatusSortKey(status: ListingStatus | undefined): number {
  return PROPERTY_STATUS_ORDER[status ?? "published"];
}

export type MyListingsSectionKey = "published" | "draft" | "paused" | "archived";

export const MY_LISTINGS_SECTIONS: readonly {
  key: MyListingsSectionKey;
  title: string;
  description: string;
  status: ListingStatus;
}[] = [
  {
    key: "published",
    title: "Publicados",
    description: "Anuncios visibles para quienes buscan roomie.",
    status: "published",
  },
  {
    key: "draft",
    title: "Borradores",
    description: "Completa y publica cuando estés listo.",
    status: "draft",
  },
  {
    key: "paused",
    title: "Pausados",
    description: "Temporalmente ocultos del público.",
    status: "paused",
  },
  {
    key: "archived",
    title: "Archivados",
    description: "Ya no se muestran en búsqueda.",
    status: "archived",
  },
];

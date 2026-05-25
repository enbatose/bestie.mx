import type { ListingStatus } from "@/types/listing";

const ROOM_REF_PATTERN = /^A([A-F0-9]{8})$/i;
const PROPERTY_REF_PATTERN = /^P([A-F0-9]{8})$/i;
const LEGACY_ROOM_REF_PATTERN = /^BES-A-([A-F0-9]{8})$/i;
const LEGACY_PROPERTY_REF_PATTERN = /^BES-P-([A-F0-9]{8})$/i;

/** Stable 8-char hex slice from property or room ids (incl. `prp__` prefix). */
export function listingReferenceId(rawId: string): string {
  const normalized = rawId.replace(/^prp__/, "").replace(/-/g, "").toUpperCase();
  return normalized.slice(0, 8);
}

export function propertyReferenceCode(propertyId: string): string {
  return `P${listingReferenceId(propertyId)}`;
}

export function roomReferenceCode(roomId: string): string {
  return `A${listingReferenceId(roomId)}`;
}

export function isListingReferenceCode(param: string): boolean {
  const t = param.trim();
  return (
    ROOM_REF_PATTERN.test(t) ||
    PROPERTY_REF_PATTERN.test(t) ||
    LEGACY_ROOM_REF_PATTERN.test(t) ||
    LEGACY_PROPERTY_REF_PATTERN.test(t)
  );
}

export function isRoomReferenceCode(param: string): boolean {
  const t = param.trim();
  return ROOM_REF_PATTERN.test(t) || LEGACY_ROOM_REF_PATTERN.test(t);
}

/** Public listing URL slug (e.g. `/anuncio/A550E8400`). */
export function listingPublicPath(roomId: string): string {
  return `/anuncio/${roomReferenceCode(roomId)}`;
}

/** Property hub URL slug (redirects to first published room). */
export function propertyPublicPath(propertyId: string): string {
  return `/propiedad/${propertyReferenceCode(propertyId)}`;
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

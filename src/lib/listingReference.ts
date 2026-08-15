import type { ListingStatus } from "@/types/listing";

const ROOM_REF_PATTERN = /^A([A-F0-9]{8})$/i;
const PROPERTY_REF_PATTERN = /^P([A-F0-9]{8})$/i;
const LEGACY_ROOM_REF_PATTERN = /^BES-A-([A-F0-9]{8})$/i;
const LEGACY_PROPERTY_REF_PATTERN = /^BES-P-([A-F0-9]{8})$/i;

/** Stable 8-char hex slice from property or room ids (incl. `prp__` prefix). */
export function listingReferenceId(rawId: string): string {
  const normalized = rawId.replace(/^prp__/, "").replace(/-/g, "").toUpperCase();
  const hexRuns = normalized.match(/[A-F0-9]{8,}/g);
  const hex = hexRuns?.[hexRuns.length - 1] ?? normalized;
  return hex.slice(0, 8);
}

export function propertyReferenceCode(propertyId: string): string {
  return `P${listingReferenceId(propertyId)}`;
}

export function roomReferenceCode(roomId: string): string {
  return `A${listingReferenceId(roomId)}`;
}

export function parseRoomReferenceSuffix(param: string): string | null {
  const t = param.trim();
  const m = t.match(ROOM_REF_PATTERN) ?? t.match(LEGACY_ROOM_REF_PATTERN);
  return m ? m[1]!.toUpperCase() : null;
}

export function parsePropertyReferenceSuffix(param: string): string | null {
  const t = param.trim();
  const m = t.match(PROPERTY_REF_PATTERN) ?? t.match(LEGACY_PROPERTY_REF_PATTERN);
  return m ? m[1]!.toUpperCase() : null;
}

/** Short code for wizard URLs (`P550E8400`). Accepts a UUID or an already-short code. */
export function wizardPropertyEditCode(propertyId: string): string {
  const t = propertyId.trim();
  if (parsePropertyReferenceSuffix(t)) return t.toUpperCase().replace(/^BES-P-/i, "P");
  return propertyReferenceCode(t);
}

/** Short code for wizard room query (`A550E8400`). */
export function wizardRoomEditCode(roomId: string): string {
  const t = roomId.trim();
  if (parseRoomReferenceSuffix(t)) return t.toUpperCase().replace(/^BES-A-/i, "A");
  return roomReferenceCode(t);
}

export function propertyMatchesEditParam(propertyId: string, editParam: string): boolean {
  const t = editParam.trim();
  if (!t || !propertyId) return false;
  if (t === propertyId) return true;
  const suffix = parsePropertyReferenceSuffix(t);
  if (suffix) return listingReferenceId(propertyId) === suffix;
  return listingReferenceId(t) === listingReferenceId(propertyId);
}

export function roomMatchesEditParam(roomId: string, roomParam: string): boolean {
  const t = roomParam.trim();
  if (!t || !roomId) return false;
  if (t === roomId) return true;
  const suffix = parseRoomReferenceSuffix(t);
  if (suffix) return listingReferenceId(roomId) === suffix;
  return listingReferenceId(t) === listingReferenceId(roomId);
}

/** `/publicar?edit=P…` (optional `&room=A…`). */
export function publishWizardEditPath(propertyId: string, roomId?: string | null): string {
  const params = new URLSearchParams();
  params.set("edit", wizardPropertyEditCode(propertyId));
  if (roomId) params.set("room", wizardRoomEditCode(roomId));
  return `/publicar?${params.toString()}`;
}

/** First-time publish confirmation — separate from `/publicar?edit=` so reload does not reopen the editor. */
export const PUBLISH_SUCCESS_PATH = "/publicar/listo";

export type PublishSuccessTarget = {
  scope: "property" | "room";
  propertyId: string | null;
  roomId: string | null;
};

/** `/publicar/listo?anuncio=A…` or `/publicar/listo?propiedad=P…` (optional `&anuncio=`). */
export function publishWizardSuccessPath(input: {
  scope: "property" | "room";
  propertyId?: string | null;
  roomId?: string | null;
}): string {
  const params = new URLSearchParams();
  if (input.scope === "property" && input.propertyId) {
    params.set("propiedad", wizardPropertyEditCode(input.propertyId));
  }
  if (input.roomId) {
    params.set("anuncio", wizardRoomEditCode(input.roomId));
  }
  const qs = params.toString();
  return qs ? `${PUBLISH_SUCCESS_PATH}?${qs}` : PUBLISH_SUCCESS_PATH;
}

export function parsePublishSuccessSearch(params: URLSearchParams): PublishSuccessTarget | null {
  const propertyRaw = params.get("propiedad")?.trim() || "";
  const roomRaw = params.get("anuncio")?.trim() || "";
  const propertyId = parsePropertyReferenceSuffix(propertyRaw)
    ? wizardPropertyEditCode(propertyRaw)
    : null;
  const roomId = parseRoomReferenceSuffix(roomRaw) ? wizardRoomEditCode(roomRaw) : null;
  if (!propertyId && !roomId) return null;
  return {
    scope: propertyId ? "property" : "room",
    propertyId,
    roomId,
  };
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

/** Published and paused share a rank so pausing does not reorder the hub list. */
const PROPERTY_STATUS_ORDER: Record<ListingStatus, number> = {
  published: 0,
  paused: 0,
  draft: 1,
  archived: 2,
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

const ROOM_REF_PATTERN = /^A([A-F0-9]{8})$/i;
const PROPERTY_REF_PATTERN = /^P([A-F0-9]{8})$/i;
/** Legacy URLs shared before the shorter slug format. */
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

export function isListingReferenceCode(param: string): boolean {
  const t = param.trim();
  return (
    ROOM_REF_PATTERN.test(t) ||
    PROPERTY_REF_PATTERN.test(t) ||
    LEGACY_ROOM_REF_PATTERN.test(t) ||
    LEGACY_PROPERTY_REF_PATTERN.test(t)
  );
}

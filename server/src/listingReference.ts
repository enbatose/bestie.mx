const ROOM_REF_PATTERN = /^A([A-F0-9]{8})$/i;
const PROPERTY_REF_PATTERN = /^P([A-F0-9]{8})$/i;
/** Legacy URLs shared before the shorter slug format. */
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
  const t = propertyId.trim();
  const parsed = parsePropertyReferenceSuffix(t);
  if (parsed) return `P${parsed}`;
  return `P${listingReferenceId(t)}`;
}

/** Public room slug (`A550E8400`). Idempotent: `A` is hex, so re-encoding `A313D1C64` used to become `AA313D1C6`. */
export function roomReferenceCode(roomId: string): string {
  const t = roomId.trim();
  const parsed = parseRoomReferenceSuffix(t);
  if (parsed) return `A${parsed}`;
  return `A${listingReferenceId(t)}`;
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

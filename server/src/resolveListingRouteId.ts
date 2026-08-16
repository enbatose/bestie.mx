import type { DatabaseSync } from "node:sqlite";
import {
  listingReferenceId,
  parsePropertyReferenceSuffix,
  parseRoomReferenceSuffix,
} from "./listingReference.js";
import { isSafePropertyId, isSafeRoomOrListingId } from "./validation.js";

function findRoomIdByReferenceSuffix(db: DatabaseSync, suffix: string): string | null {
  const want = suffix.toUpperCase();
  const rows = db.prepare("SELECT id FROM rooms").all() as { id: string }[];
  let match: string | null = null;
  for (const row of rows) {
    if (listingReferenceId(row.id) !== want) continue;
    match = row.id;
    break;
  }
  return match;
}

function findPropertyIdByReferenceSuffix(db: DatabaseSync, suffix: string): string | null {
  const want = suffix.toUpperCase();
  const rows = db.prepare("SELECT id FROM properties").all() as { id: string }[];
  for (const row of rows) {
    if (listingReferenceId(row.id) === want) return row.id;
  }
  return null;
}

/** Map `/propiedad/:id` route param to canonical property id. */
export function resolvePropertyIdFromRouteParam(db: DatabaseSync, param: string): string | null {
  const trimmed = param.trim();
  if (!trimmed || trimmed.length > 160) return null;
  const propSuffix = parsePropertyReferenceSuffix(trimmed);
  if (propSuffix) return findPropertyIdByReferenceSuffix(db, propSuffix);
  if (isSafePropertyId(trimmed)) return trimmed;
  // Legacy AI drafts used `adraft_<hex>` without the `prp__` prefix.
  if (/^adraft_[a-zA-Z0-9_-]{8,128}$/i.test(trimmed)) {
    const row = db.prepare("SELECT id FROM properties WHERE id = ?").get(trimmed) as
      | { id: string }
      | undefined;
    return row?.id ?? null;
  }
  return null;
}

/** Map `/anuncio/:id` route param to canonical room id (UUID or legacy slug). */
export function resolveRoomIdFromRouteParam(db: DatabaseSync, param: string): string | null {
  const trimmed = param.trim();
  const roomSuffix = parseRoomReferenceSuffix(trimmed);
  if (roomSuffix) return findRoomIdByReferenceSuffix(db, roomSuffix);

  if (isSafeRoomOrListingId(trimmed)) return trimmed;
  return null;
}

/**
 * Admin property-status target: `prp__…` / `P…`, or room short code `A…` → parent property.
 * Returns null when the param is malformed or nothing matches.
 */
export function resolveAdminPropertyIdFromParam(db: DatabaseSync, param: string): string | null {
  const trimmed = param.trim();
  if (!trimmed || trimmed.length > 160) return null;

  const asProperty = resolvePropertyIdFromRouteParam(db, trimmed);
  if (asProperty) return asProperty;

  const roomId = resolveRoomIdFromRouteParam(db, trimmed);
  if (!roomId) return null;

  const row = db.prepare(`SELECT property_id FROM rooms WHERE id = ?`).get(roomId) as
    | { property_id: string }
    | undefined;
  return row?.property_id ?? null;
}

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
  const propSuffix = parsePropertyReferenceSuffix(trimmed);
  if (propSuffix) return findPropertyIdByReferenceSuffix(db, propSuffix);
  if (isSafePropertyId(trimmed)) return trimmed;
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

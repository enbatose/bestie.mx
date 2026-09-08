import type { DatabaseSync } from "node:sqlite";
import { omittedAffirmedTags } from "./assistedDraftSourceTags.js";

export type OmittedTagFix = {
  propertyId: string;
  roomId: string;
  status: string;
  createdAt: string;
  added: string[];
};

type RoomCopyRow = {
  property_id: string;
  room_id: string;
  status: string;
  created_at: string;
  property_status: string;
  title: string;
  property_title: string;
  summary: string;
  property_summary: string;
  tags_json: string;
};

function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((tag): tag is string => typeof tag === "string" && tag.length > 0);
  } catch {
    return [];
  }
}

/** Room facts. A furnished house does not mean an empty room row is furnished. */
const ROOM_ONLY_TAGS = new Set([
  "muebles",
  "closet",
  "baño-privado",
  "terraza",
  "aire-acondicionado",
  "ventilador",
  "cerradura-cuarto",
]);

function omittedForRoom(row: RoomCopyRow, existing: readonly string[]): string[] {
  const propertyCopy = [row.property_title, row.property_summary].filter(Boolean).join("\n");
  const roomCopy = [row.title, row.summary].filter(Boolean).join("\n");
  const fromProperty = omittedAffirmedTags(propertyCopy, existing).filter((slug) => !ROOM_ONLY_TAGS.has(slug));
  const fromRoom = omittedAffirmedTags(roomCopy, existing);
  return [...new Set([...fromProperty, ...fromRoom])];
}

/**
 * AI drafts store the Facebook paste only inside generated summaries.
 * Add tags the stored copy clearly affirms and the room omitted.
 * Never removes a tag — a publisher may have turned it on by hand.
 */
export function backfillOmittedAssistedDraftTags(
  db: DatabaseSync,
  opts: { sinceIso: string; dryRun?: boolean },
): OmittedTagFix[] {
  const rows = db
    .prepare(
      `SELECT
         r.property_id,
         r.id AS room_id,
         r.status,
         r.created_at,
         p.status AS property_status,
         r.title,
         p.title AS property_title,
         r.summary,
         p.summary AS property_summary,
         r.tags_json
       FROM rooms r
       JOIN properties p ON p.id = r.property_id
       WHERE p.assisted_draft = 1
         AND r.status != 'archived'
         AND p.status != 'archived'
         AND r.created_at >= ?`,
    )
    .all(opts.sinceIso) as RoomCopyRow[];

  const fixes: OmittedTagFix[] = [];
  const update = db.prepare(
    `UPDATE rooms SET tags_json = ?, updated_at = ? WHERE id = ?`,
  );
  const now = new Date().toISOString();

  for (const row of rows) {
    const existing = parseTags(row.tags_json);
    const added = omittedForRoom(row, existing);
    if (added.length === 0) continue;
    const next = [...existing, ...added];
    if (!opts.dryRun) {
      update.run(JSON.stringify(next), now, row.room_id);
    }
    fixes.push({
      propertyId: row.property_id,
      roomId: row.room_id,
      status: row.property_status,
      createdAt: row.created_at,
      added,
    });
  }

  return fixes;
}

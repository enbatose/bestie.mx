import type { DatabaseSync } from "node:sqlite";
import { propertyReferenceCode, roomReferenceCode } from "./listingReference.js";
import { publicBaseUrl } from "./publicBaseUrl.js";
import { SHARE_AI_TEXT_MAX } from "./shareAiCopyLimits.js";
import { clampShareAiText, generateShareAiText } from "./shareAiCopyGemini.js";
import {
  buildTemplateShareCopy,
  shareCopyBodyLooksTruncated,
  shareCopyNeedsEmojiFormat,
  type ShareAiListingFacts,
  type ShareAiScope,
} from "./shareAiCopyPrompt.js";
import { recordGeminiTokens, recordShareAiGenerate } from "./usageAnalytics.js";

type PropRow = {
  id: string;
  publisher_id: string;
  status: string;
  post_mode: string;
  title: string;
  city: string;
  neighborhood: string;
  summary: string;
  property_kind: string | null;
  hide_pricing: number | null;
  share_ai_text: string | null;
  share_ai_text_user_edited: number | null;
};

type RoomRow = {
  id: string;
  property_id: string;
  status: string;
  title: string;
  rent_mxn: number;
  tags_json: string;
  roommate_gender_pref: string;
  age_min: number;
  age_max: number;
  summary: string;
  lodging_type: string | null;
  occupancy_status: string | null;
  share_ai_text: string | null;
  share_ai_text_user_edited: number | null;
};

function parseTags(json: string): string[] {
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

function loadProperty(db: DatabaseSync, propertyId: string): PropRow | null {
  return (
    (db
      .prepare(
        `SELECT id, publisher_id, status, post_mode, title, city, neighborhood, summary, property_kind,
                hide_pricing, share_ai_text, share_ai_text_user_edited
         FROM properties WHERE id = ?`,
      )
      .get(propertyId) as PropRow | undefined) ?? null
  );
}

function loadRoom(db: DatabaseSync, roomId: string): RoomRow | null {
  return (
    (db
      .prepare(
        `SELECT id, property_id, status, title, rent_mxn, tags_json, roommate_gender_pref, age_min, age_max,
                summary, lodging_type, occupancy_status, share_ai_text, share_ai_text_user_edited
         FROM rooms WHERE id = ?`,
      )
      .get(roomId) as RoomRow | undefined) ?? null
  );
}

function loadRoomsForProperty(db: DatabaseSync, propertyId: string): RoomRow[] {
  return db
    .prepare(
      `SELECT id, property_id, status, title, rent_mxn, tags_json, roommate_gender_pref, age_min, age_max,
              summary, lodging_type, occupancy_status, share_ai_text, share_ai_text_user_edited
       FROM rooms WHERE property_id = ? ORDER BY sort_order ASC, created_at ASC`,
    )
    .all(propertyId) as RoomRow[];
}

function isAvailableRoom(r: RoomRow): boolean {
  return r.status === "published" && (r.occupancy_status ?? "available") !== "occupied";
}

export function buildPropertyFacts(
  db: DatabaseSync,
  propertyId: string,
  baseUrl: string = publicBaseUrl(),
): ShareAiListingFacts | null {
  const prop = loadProperty(db, propertyId);
  if (!prop) return null;
  const rooms = loadRoomsForProperty(db, propertyId).filter(isAvailableRoom);
  const hidePricing = Number(prop.hide_pricing) === 1;
  const rents = hidePricing
    ? []
    : rooms.map((r) => r.rent_mxn).filter((n) => Number.isFinite(n) && n > 0);
  const tagSet = new Set<string>();
  for (const r of rooms) for (const t of parseTags(r.tags_json)) tagSet.add(t);
  const base = baseUrl.replace(/\/+$/, "");
  return {
    scope: "property",
    title: prop.title,
    city: prop.city,
    neighborhood: prop.neighborhood,
    summary: prop.summary ?? "",
    propertyKind: prop.property_kind,
    tags: [...tagSet],
    roommateGenderPref: rooms[0]?.roommate_gender_pref ?? null,
    ageMin: rooms[0]?.age_min ?? null,
    ageMax: rooms[0]?.age_max ?? null,
    lodgingType: null,
    hidePricing: hidePricing || undefined,
    rentMxn: null,
    rentMinMxn: rents.length ? Math.min(...rents) : null,
    rentMaxMxn: rents.length ? Math.max(...rents) : null,
    availableRoomCount: rooms.length,
    rooms: rooms.map((r) => ({
      title: r.title,
      rentMxn: hidePricing ? 0 : r.rent_mxn,
      lodgingType: r.lodging_type,
      tags: parseTags(r.tags_json),
      summary: r.summary ?? "",
    })),
    permalink: `${base}/propiedad/${propertyReferenceCode(prop.id)}`,
  };
}

export function buildRoomFacts(
  db: DatabaseSync,
  roomId: string,
  baseUrl: string = publicBaseUrl(),
): ShareAiListingFacts | null {
  const room = loadRoom(db, roomId);
  if (!room) return null;
  const prop = loadProperty(db, room.property_id);
  if (!prop) return null;
  const hidePricing = Number(prop.hide_pricing) === 1;
  const tags = parseTags(room.tags_json);
  const base = baseUrl.replace(/\/+$/, "");
  return {
    scope: "room",
    title: room.title || prop.title,
    city: prop.city,
    neighborhood: prop.neighborhood,
    summary: (room.summary || prop.summary || "").trim(),
    propertyKind: prop.property_kind,
    tags,
    roommateGenderPref: room.roommate_gender_pref,
    ageMin: room.age_min,
    ageMax: room.age_max,
    lodgingType: room.lodging_type,
    hidePricing: hidePricing || undefined,
    rentMxn: hidePricing ? null : room.rent_mxn,
    rentMinMxn: null,
    rentMaxMxn: null,
    availableRoomCount: 1,
    rooms: [
      {
        title: room.title,
        rentMxn: hidePricing ? 0 : room.rent_mxn,
        lodgingType: room.lodging_type,
        tags,
        summary: room.summary ?? "",
      },
    ],
    permalink: `${base}/anuncio/${roomReferenceCode(room.id)}`,
  };
}

export type ShareAiStored = {
  scope: ShareAiScope;
  propertyId: string | null;
  roomId: string | null;
  text: string;
  permalink: string;
  userEdited: boolean;
  source: "stored" | "gemini" | "template";
};

export async function getOrCreateShareAiCopy(
  db: DatabaseSync,
  opts: {
    scope: ShareAiScope;
    propertyId?: string | null;
    roomId?: string | null;
    force?: boolean;
    /** Request-host origin when available (Dev vs Prod permalinks). */
    baseUrl?: string;
  },
): Promise<ShareAiStored | null> {
  const force = Boolean(opts.force);
  const baseUrl = opts.baseUrl ?? publicBaseUrl();
  if (opts.scope === "property") {
    const propertyId = opts.propertyId?.trim() || null;
    if (!propertyId) return null;
    const prop = loadProperty(db, propertyId);
    if (!prop) return null;
    const facts = buildPropertyFacts(db, propertyId, baseUrl);
    if (!facts) return null;
    const existing = (prop.share_ai_text ?? "").trim();
    const userEdited = Boolean(prop.share_ai_text_user_edited);
    const clampedExisting = existing ? clampShareAiText(existing, facts.permalink) : "";
    // Auto-regen machine copy that was truncated or still uses classic • bullets.
    const shouldReuse =
      Boolean(clampedExisting) &&
      !force &&
      (userEdited ||
        (!shareCopyBodyLooksTruncated(clampedExisting, facts.permalink) &&
          !shareCopyNeedsEmojiFormat(existing || clampedExisting, facts.permalink)));
    if (shouldReuse) {
      recordShareAiGenerate("stored", "property");
      return {
        scope: "property",
        propertyId,
        roomId: null,
        text: clampedExisting,
        permalink: facts.permalink,
        userEdited,
        source: "stored",
      };
    }
    const gen = await generateShareAiText(facts);
    recordShareAiGenerate(gen.source, "property");
    if (gen.source === "gemini") {
      recordGeminiTokens(gen.promptTokens ?? 0, gen.outputTokens ?? 0, gen.model ?? "gemini");
    }
    persistPropertyShareText(db, propertyId, gen.text, false);
    return {
      scope: "property",
      propertyId,
      roomId: null,
      text: gen.text,
      permalink: facts.permalink,
      userEdited: false,
      source: gen.source,
    };
  }

  const roomId = opts.roomId?.trim() || null;
  if (!roomId) return null;
  const room = loadRoom(db, roomId);
  if (!room) return null;
  const facts = buildRoomFacts(db, roomId, baseUrl);
  if (!facts) return null;
  const existing = (room.share_ai_text ?? "").trim();
  const userEdited = Boolean(room.share_ai_text_user_edited);
  const clampedExisting = existing ? clampShareAiText(existing, facts.permalink) : "";
  const shouldReuse =
    Boolean(clampedExisting) &&
    !force &&
    (userEdited ||
      (!shareCopyBodyLooksTruncated(clampedExisting, facts.permalink) &&
        !shareCopyNeedsEmojiFormat(existing || clampedExisting, facts.permalink)));
  if (shouldReuse) {
    recordShareAiGenerate("stored", "room");
    return {
      scope: "room",
      propertyId: room.property_id,
      roomId,
      text: clampedExisting,
      permalink: facts.permalink,
      userEdited,
      source: "stored",
    };
  }
  const gen = await generateShareAiText(facts);
  recordShareAiGenerate(gen.source, "room");
  if (gen.source === "gemini") {
    recordGeminiTokens(gen.promptTokens ?? 0, gen.outputTokens ?? 0, gen.model ?? "gemini");
  }
  persistRoomShareText(db, roomId, gen.text, false);
  return {
    scope: "room",
    propertyId: room.property_id,
    roomId,
    text: gen.text,
    permalink: facts.permalink,
    userEdited: false,
    source: gen.source,
  };
}

export function saveShareAiCopy(
  db: DatabaseSync,
  opts: {
    scope: ShareAiScope;
    propertyId?: string | null;
    roomId?: string | null;
    text: string;
    baseUrl?: string;
  },
): ShareAiStored | null {
  const baseUrl = opts.baseUrl ?? publicBaseUrl();
  if (opts.scope === "property") {
    const propertyId = opts.propertyId?.trim() || null;
    if (!propertyId) return null;
    const facts = buildPropertyFacts(db, propertyId, baseUrl);
    if (!facts) return null;
    const text = clampShareAiText(opts.text, facts.permalink).slice(0, SHARE_AI_TEXT_MAX);
    persistPropertyShareText(db, propertyId, text, true);
    return {
      scope: "property",
      propertyId,
      roomId: null,
      text,
      permalink: facts.permalink,
      userEdited: true,
      source: "stored",
    };
  }
  const roomId = opts.roomId?.trim() || null;
  if (!roomId) return null;
  const room = loadRoom(db, roomId);
  if (!room) return null;
  const facts = buildRoomFacts(db, roomId, baseUrl);
  if (!facts) return null;
  const text = clampShareAiText(opts.text, facts.permalink).slice(0, SHARE_AI_TEXT_MAX);
  persistRoomShareText(db, roomId, text, true);
  return {
    scope: "room",
    propertyId: room.property_id,
    roomId,
    text,
    permalink: facts.permalink,
    userEdited: true,
    source: "stored",
  };
}

function persistPropertyShareText(
  db: DatabaseSync,
  propertyId: string,
  text: string,
  userEdited: boolean,
): void {
  db.prepare(
    `UPDATE properties
     SET share_ai_text = ?, share_ai_text_updated_at = datetime('now'), share_ai_text_user_edited = ?
     WHERE id = ?`,
  ).run(text, userEdited ? 1 : 0, propertyId);
}

function persistRoomShareText(db: DatabaseSync, roomId: string, text: string, userEdited: boolean): void {
  db.prepare(
    `UPDATE rooms
     SET share_ai_text = ?, share_ai_text_updated_at = datetime('now'), share_ai_text_user_edited = ?
     WHERE id = ?`,
  ).run(text, userEdited ? 1 : 0, roomId);
}

export function publisherIdForShareTarget(
  db: DatabaseSync,
  opts: { scope: ShareAiScope; propertyId?: string | null; roomId?: string | null },
): string | null {
  if (opts.scope === "property") {
    const prop = opts.propertyId ? loadProperty(db, opts.propertyId) : null;
    return prop?.publisher_id ?? null;
  }
  const room = opts.roomId ? loadRoom(db, opts.roomId) : null;
  if (!room) return null;
  return loadProperty(db, room.property_id)?.publisher_id ?? null;
}

export { buildTemplateShareCopy };

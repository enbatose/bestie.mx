import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { SELF_SERVE_MAX_INFOGRAPHICS, SELF_SERVE_MAX_TEXT_CHARS, listingPhotoSlotsRemaining } from "./assistedDraftLimits.js";
import type { ListingTag, LodgingType, PropertyKind, RoomDimension, RoommateGenderPref } from "./types.js";

export type WhatsAppBotDraft = {
  intent: "search" | "publish" | null;
  q: string;
  poiName: string | null;
  poiLat: number | null;
  poiLng: number | null;
  zoneLabel: string | null;
  budgetMax: number | null;
  pref: "female" | "male" | null;
  tags: ListingTag[];
  lodgingType: LodgingType | null;
  sourceText: string;
  photoUrls: string[];
  infographicUrls: string[];
  locLat: number | null;
  locLng: number | null;
  locLabel: string | null;
  locRadiusM: number | null;
  locApproximate: boolean;
  rentMxn: number | null;
  title: string;
  neighborhood: string;
  summary: string;
  genderPref: RoommateGenderPref;
  ageMin: number;
  ageMax: number;
  availableFrom: string | null;
  minStay: number;
  roomDimension: RoomDimension;
  pubTags: ListingTag[];
  /** Tags the source text or the model says the room does NOT have. Never published. */
  deniedTags: ListingTag[];
  lodging: LodgingType;
  propertyKind: PropertyKind | null;
  depositMxn: number | null;
  bathrooms: number | null;
  bedroomsTotal: number | null;
  /** Essentials already known (AI or a tap), so the bot does not re-ask them. */
  roomKindSet: boolean;
  genderSet: boolean;
  tagsConfirmed: boolean;
};

const TAGS: readonly string[] = [
  "wifi",
  "agua",
  "luz",
  "gas",
  "mascotas",
  "estacionamiento",
  "muebles",
  "baño-privado",
  "fumar",
  "ventilador",
  "closet",
  "fiestas",
  "aire-acondicionado",
  "seguridad-acceso",
  "vigilancia",
  "lavanderia",
  "lavadora",
  "secadora",
  "cocina-equipada",
  "terraza",
  "lgbt-friendly",
  "profesionistas",
  "estudiantes",
  "residentes-medicos",
  "nomadas-digitales",
  "individuos-solo",
  "parejas",
  "familiar-ninos",
  "servicios-incluidos",
  "cerradura-cuarto",
  "agua-caliente",
  "cerca-transporte",
];

function asTags(raw: unknown): ListingTag[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is ListingTag => typeof t === "string" && TAGS.includes(t));
}

export function emptyWhatsAppDraft(): WhatsAppBotDraft {
  return {
    intent: null,
    q: "",
    poiName: null,
    poiLat: null,
    poiLng: null,
    zoneLabel: null,
    budgetMax: null,
    pref: null,
    tags: [],
    lodgingType: null,
    sourceText: "",
    photoUrls: [],
    infographicUrls: [],
    locLat: null,
    locLng: null,
    locLabel: null,
    locRadiusM: null,
    locApproximate: true,
    rentMxn: null,
    title: "",
    neighborhood: "",
    summary: "",
    genderPref: "any",
    ageMin: 22,
    ageMax: 45,
    availableFrom: null,
    minStay: 1,
    roomDimension: "medium",
    pubTags: [],
    deniedTags: [],
    lodging: "private_room",
    propertyKind: null,
    depositMxn: null,
    bathrooms: null,
    bedroomsTotal: null,
    roomKindSet: false,
    genderSet: false,
    tagsConfirmed: false,
  };
}

function parseDraft(raw: string): WhatsAppBotDraft {
  const base = emptyWhatsAppDraft();
  try {
    const j = JSON.parse(raw) as Partial<WhatsAppBotDraft>;
    const draft: WhatsAppBotDraft = {
      ...base,
      intent: j.intent === "search" || j.intent === "publish" ? j.intent : null,
      q: typeof j.q === "string" ? j.q : "",
      poiName: typeof j.poiName === "string" ? j.poiName : null,
      poiLat: typeof j.poiLat === "number" && Number.isFinite(j.poiLat) ? j.poiLat : null,
      poiLng: typeof j.poiLng === "number" && Number.isFinite(j.poiLng) ? j.poiLng : null,
      zoneLabel: typeof j.zoneLabel === "string" ? j.zoneLabel : null,
      budgetMax: typeof j.budgetMax === "number" && Number.isFinite(j.budgetMax) ? j.budgetMax : null,
      pref: j.pref === "female" || j.pref === "male" ? j.pref : null,
      tags: asTags(j.tags),
      lodgingType:
        j.lodgingType === "private_room" || j.lodgingType === "shared_room" || j.lodgingType === "whole_home"
          ? j.lodgingType
          : null,
      sourceText: typeof j.sourceText === "string" ? j.sourceText.slice(0, SELF_SERVE_MAX_TEXT_CHARS) : "",
      photoUrls: Array.isArray(j.photoUrls)
        ? j.photoUrls.filter((u): u is string => typeof u === "string" && u.startsWith("/api/uploads/"))
        : [],
      infographicUrls: Array.isArray(j.infographicUrls)
        ? j.infographicUrls.filter((u): u is string => typeof u === "string" && u.startsWith("/api/uploads/")).slice(0, SELF_SERVE_MAX_INFOGRAPHICS)
        : [],
      locLat: typeof j.locLat === "number" && Number.isFinite(j.locLat) ? j.locLat : null,
      locLng: typeof j.locLng === "number" && Number.isFinite(j.locLng) ? j.locLng : null,
      locLabel: typeof j.locLabel === "string" ? j.locLabel : null,
      locRadiusM: typeof j.locRadiusM === "number" && Number.isFinite(j.locRadiusM) ? j.locRadiusM : null,
      locApproximate: j.locApproximate !== false,
      rentMxn: typeof j.rentMxn === "number" && Number.isFinite(j.rentMxn) ? j.rentMxn : null,
      title: typeof j.title === "string" ? j.title : "",
      neighborhood: typeof j.neighborhood === "string" ? j.neighborhood : "",
      summary: typeof j.summary === "string" ? j.summary : "",
      genderPref: j.genderPref === "female" || j.genderPref === "male" ? j.genderPref : "any",
      ageMin: typeof j.ageMin === "number" && Number.isFinite(j.ageMin) ? j.ageMin : 22,
      ageMax: typeof j.ageMax === "number" && Number.isFinite(j.ageMax) ? j.ageMax : 45,
      availableFrom: typeof j.availableFrom === "string" ? j.availableFrom : null,
      minStay: typeof j.minStay === "number" && j.minStay >= 1 ? Math.floor(j.minStay) : 1,
      roomDimension: j.roomDimension === "small" || j.roomDimension === "large" ? j.roomDimension : "medium",
      pubTags: asTags(j.pubTags),
      deniedTags: asTags(j.deniedTags),
      lodging: j.lodging === "shared_room" ? "shared_room" : "private_room",
      propertyKind:
        j.propertyKind === "house" || j.propertyKind === "apartment" || j.propertyKind === "loft"
          ? j.propertyKind
          : null,
      depositMxn:
        typeof j.depositMxn === "number" && Number.isFinite(j.depositMxn) && j.depositMxn >= 0
          ? Math.floor(j.depositMxn)
          : null,
      bathrooms: typeof j.bathrooms === "number" && j.bathrooms >= 1 ? Math.floor(j.bathrooms) : null,
      bedroomsTotal:
        typeof j.bedroomsTotal === "number" && j.bedroomsTotal >= 1 ? Math.floor(j.bedroomsTotal) : null,
      roomKindSet: j.roomKindSet === true,
      genderSet: j.genderSet === true,
      tagsConfirmed: j.tagsConfirmed === true,
    };
    const photoCap = listingPhotoSlotsRemaining(draft.infographicUrls.length);
    if (draft.photoUrls.length > photoCap) draft.photoUrls = draft.photoUrls.slice(0, photoCap);
    return draft;
  } catch {
    return base;
  }
}

export type WhatsAppChatRow = {
  publisherId: string;
  flow: string;
  draft: WhatsAppBotDraft;
};

export function getWhatsAppChat(db: DatabaseSync, psid: string): WhatsAppChatRow | null {
  const row = db
    .prepare(`SELECT publisher_id, flow, draft_json FROM messenger_chat_sessions WHERE psid = ?`)
    .get(psid) as { publisher_id: string; flow: string; draft_json: string } | undefined;
  if (!row) return null;
  return { publisherId: row.publisher_id, flow: row.flow, draft: parseDraft(row.draft_json) };
}

export function upsertWhatsAppChat(
  db: DatabaseSync,
  psid: string,
  patch: Partial<{ publisherId: string; flow: string; draft: WhatsAppBotDraft }>,
): WhatsAppChatRow {
  const existing = getWhatsAppChat(db, psid);
  const publisherId = patch.publisherId ?? existing?.publisherId ?? randomUUID();
  const flow = patch.flow ?? existing?.flow ?? "idle";
  const draft = patch.draft ?? existing?.draft ?? emptyWhatsAppDraft();
  const now = Date.now();
  db.prepare(
    `INSERT INTO messenger_chat_sessions (psid, publisher_id, flow, draft_json, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(psid) DO UPDATE SET
       publisher_id = excluded.publisher_id,
       flow = excluded.flow,
       draft_json = excluded.draft_json,
       updated_at = excluded.updated_at`,
  ).run(psid, publisherId, flow, JSON.stringify(draft), now);
  return { publisherId, flow, draft };
}

export function mergeWhatsAppPhotoUrls(
  existing: string[],
  incoming: string[],
  max: number,
): { urls: string[]; added: number; dropped: number } {
  const cap = Math.max(0, Math.floor(max) || 0);
  const out = [...existing];
  let added = 0;
  let dropped = 0;
  for (const raw of incoming) {
    if (typeof raw !== "string" || !raw.startsWith("/api/uploads/")) continue;
    if (out.includes(raw)) continue;
    if (out.length >= cap) {
      dropped += 1;
      continue;
    }
    out.push(raw);
    added += 1;
  }
  return { urls: out, added, dropped };
}

export function mergeWhatsAppInfographicUrls(existing: string[], incoming: string[]): string[] {
  const out = [...existing];
  for (const raw of incoming) {
    if (typeof raw !== "string" || !raw.startsWith("/api/uploads/")) continue;
    if (out.includes(raw)) continue;
    if (out.length >= SELF_SERVE_MAX_INFOGRAPHICS) break;
    out.push(raw);
  }
  return out;
}

function appendWhatsAppUrls(
  db: DatabaseSync,
  psid: string,
  urls: string[],
  kind: "photo" | "infographic",
  extra?: { sourceText?: string; publisherId?: string; flow?: string },
): WhatsAppChatRow & { added: number; dropped: number } {
  db.exec("BEGIN IMMEDIATE;");
  try {
    const existing = getWhatsAppChat(db, psid);
    const draft = existing?.draft ?? emptyWhatsAppDraft();
    draft.intent = "publish";
    let added = 0;
    let dropped = 0;
    if (kind === "infographic") {
      const before = draft.infographicUrls.length;
      draft.infographicUrls = mergeWhatsAppInfographicUrls(draft.infographicUrls, urls);
      added = Math.max(0, draft.infographicUrls.length - before);
      const incomingOk = urls.filter((u) => typeof u === "string" && u.startsWith("/api/uploads/")).length;
      dropped = Math.max(0, incomingOk - added);
      const photoCap = listingPhotoSlotsRemaining(draft.infographicUrls.length);
      if (draft.photoUrls.length > photoCap) draft.photoUrls = draft.photoUrls.slice(0, photoCap);
    } else {
      const merged = mergeWhatsAppPhotoUrls(
        draft.photoUrls,
        urls,
        listingPhotoSlotsRemaining(draft.infographicUrls.length),
      );
      draft.photoUrls = merged.urls;
      added = merged.added;
      dropped = merged.dropped;
    }
    if (extra?.sourceText?.trim()) {
      draft.sourceText = [draft.sourceText, extra.sourceText.trim()]
        .filter(Boolean)
        .join("\n")
        .slice(0, SELF_SERVE_MAX_TEXT_CHARS);
    }
    const row = upsertWhatsAppChat(db, psid, {
      flow: extra?.flow ?? (kind === "infographic" ? "pub_infographics" : "pub_photos"),
      draft,
      publisherId: extra?.publisherId ?? existing?.publisherId,
    });
    db.exec("COMMIT;");
    return { ...row, added, dropped };
  } catch (err) {
    try {
      db.exec("ROLLBACK;");
    } catch {
      /* */
    }
    throw err;
  }
}

/** Append listing photos without losing a concurrent album webhook. */
export function appendWhatsAppPhotoUrls(
  db: DatabaseSync,
  psid: string,
  urls: string[],
  extra?: { sourceText?: string; publisherId?: string; flow?: string },
): WhatsAppChatRow & { added: number; dropped: number } {
  return appendWhatsAppUrls(db, psid, urls, "photo", extra);
}

/** Append infographic images (cap 2). Also published into the gallery after room photos. */
export function appendWhatsAppInfographicUrls(
  db: DatabaseSync,
  psid: string,
  urls: string[],
  extra?: { sourceText?: string; publisherId?: string; flow?: string },
): WhatsAppChatRow & { added: number; dropped: number } {
  return appendWhatsAppUrls(db, psid, urls, "infographic", extra);
}

import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { ListingTag, LodgingType, RoomDimension, RoommateGenderPref } from "./types.js";

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
  lodging: LodgingType;
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
    lodging: "private_room",
  };
}

function parseDraft(raw: string): WhatsAppBotDraft {
  const base = emptyWhatsAppDraft();
  try {
    const j = JSON.parse(raw) as Partial<WhatsAppBotDraft>;
    return {
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
      sourceText: typeof j.sourceText === "string" ? j.sourceText.slice(0, 4000) : "",
      photoUrls: Array.isArray(j.photoUrls)
        ? j.photoUrls.filter((u): u is string => typeof u === "string" && u.startsWith("/api/uploads/")).slice(0, 6)
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
      lodging: j.lodging === "shared_room" ? "shared_room" : "private_room",
    };
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

const PHOTO_CAP = 6;

export function mergeWhatsAppPhotoUrls(existing: string[], incoming: string[]): string[] {
  const out = [...existing];
  for (const raw of incoming) {
    if (typeof raw !== "string" || !raw.startsWith("/api/uploads/")) continue;
    if (out.includes(raw)) continue;
    if (out.length >= PHOTO_CAP) break;
    out.push(raw);
  }
  return out;
}

/** Append listing photos without losing a concurrent album webhook. */
export function appendWhatsAppPhotoUrls(
  db: DatabaseSync,
  psid: string,
  urls: string[],
  extra?: { sourceText?: string; publisherId?: string },
): WhatsAppChatRow {
  db.exec("BEGIN IMMEDIATE;");
  try {
    const existing = getWhatsAppChat(db, psid);
    const draft = existing?.draft ?? emptyWhatsAppDraft();
    draft.intent = "publish";
    draft.photoUrls = mergeWhatsAppPhotoUrls(draft.photoUrls, urls);
    if (extra?.sourceText?.trim()) {
      draft.sourceText = [draft.sourceText, extra.sourceText.trim()].filter(Boolean).join("\n").slice(0, 4000);
    }
    const row = upsertWhatsAppChat(db, psid, {
      flow: "pub_photos",
      draft,
      publisherId: extra?.publisherId ?? existing?.publisherId,
    });
    db.exec("COMMIT;");
    return row;
  } catch (err) {
    try {
      db.exec("ROLLBACK;");
    } catch {
      /* */
    }
    throw err;
  }
}

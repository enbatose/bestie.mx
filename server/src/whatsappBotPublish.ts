import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { confidenceToRadius, extractListingDataWithGemini } from "./assistedDraftGemini.js";
import { applySourceTextTagSignals } from "./assistedDraftSourceTags.js";
import {
  composeChatRoomSummary,
  generateChatRoomSummary,
  type ChatRoomSummaryFacts,
} from "./chatListingSummary.js";
import { chatTagLabels } from "./chatPublishAmenities.js";
import { matchGdlSearchPois } from "./gdlSearchPois.js";
import { publicWebOrigin } from "./handoffTokens.js";
import { roomReferenceCode } from "./listingReference.js";
import { isListingTag } from "./listingTags.js";
import { scheduleNotifyOpsNewPostPublished } from "./newPostPublishedNotify.js";
import { scheduleNotifyPublisherAddPhotos } from "./listingAddPhotosNotify.js";
import { geocodeNamedPlaceInMetro } from "./placeGeocode.js";
import { readUploadBytes } from "./shareOgImage.js";
import type { ListingTag, PropertyKind } from "./types.js";
import {
  APPROXIMATE_RADIUS_DEFAULT_M,
  clampAge,
  clampApproximateRadiusMeters,
  clampBathrooms,
  clampBedroomsTotal,
  clampDepositMxn,
  clampListingImageUrls,
  clampRentMxn,
  clampStr,
  minimalRoomSummaryOk,
  ROOM_TITLE_MAX_LEN,
  validLatLng,
} from "./validation.js";
import type { WhatsAppBotDraft } from "./whatsappSessionStore.js";

const CITY = "Guadalajara";
/** Match the publish wizard so listing cards/headers wrap like assistant posts. */
const PROPERTY_TITLE_MAX = 70;
const PROPERTY_NEIGHBORHOOD_MAX = 50;
const ROOM_SUMMARY_MAX = 1500;

export function parseRentFromText(text: string): number | null {
  const t = text.toLowerCase().replace(/,/g, "");
  const mil = t.match(/(\d+(?:\.\d+)?)\s*mil\b/);
  if (mil) {
    const n = Number(mil[1]);
    if (Number.isFinite(n) && n > 0) return clampRentMxn(Math.round(n * 1000));
  }
  const money = t.match(/(\d{3,6})\b/);
  if (money) {
    const n = Number(money[1]);
    if (Number.isFinite(n) && n >= 1500 && n <= 80000) return clampRentMxn(n);
  }
  return null;
}

export function shortNeighborhoodLabel(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  const pois = matchGdlSearchPois(t);
  if (pois[0]) return clampStr(pois[0].name, PROPERTY_NEIGHBORHOOD_MAX);
  const first = t.split(",")[0]?.trim() || t;
  return clampStr(first, PROPERTY_NEIGHBORHOOD_MAX);
}

export function chatRoomSummaryFactsFor(draft: WhatsAppBotDraft): ChatRoomSummaryFacts {
  return {
    neighborhood: shortNeighborhoodLabel(draft.neighborhood || draft.locLabel || CITY) || CITY,
    city: CITY,
    rentMxn: draft.rentMxn != null ? clampRentMxn(draft.rentMxn) : 0,
    depositMxn: draft.depositMxn,
    lodging: draft.lodging,
    roomDimension: draft.roomDimension,
    genderPref: draft.genderPref,
    tags: draft.pubTags,
    availableFrom: draft.availableFrom,
    minStay: draft.minStay,
    photoCount: draft.photoUrls.length,
    sourceText: draft.sourceText,
  };
}

/**
 * Write the description once the essentials are known, so a publisher who
 * skipped the description step still gets a real one instead of filler.
 */
export async function ensurePublishDraftSummary(draft: WhatsAppBotDraft): Promise<WhatsAppBotDraft> {
  if (minimalRoomSummaryOk(draft.summary)) return draft;
  const summary = await generateChatRoomSummary(chatRoomSummaryFactsFor(draft));
  return { ...draft, summary: summary.slice(0, ROOM_SUMMARY_MAX) };
}

export function composeWhatsAppListingFields(draft: WhatsAppBotDraft): {
  title: string;
  neighborhood: string;
  summary: string;
  roomTitle: string;
  propertyKind: PropertyKind;
} {
  const neighborhood =
    shortNeighborhoodLabel(draft.neighborhood || draft.locLabel || CITY) || CITY;
  const rawTitle = draft.title.trim();
  const title =
    clampStr(rawTitle.length >= 10 ? rawTitle : `Cuarto en ${neighborhood}`, PROPERTY_TITLE_MAX) ||
    `Cuarto en ${neighborhood}`.slice(0, PROPERTY_TITLE_MAX);
  const written = draft.summary.trim();
  const summary = (
    minimalRoomSummaryOk(written)
      ? written
      : composeChatRoomSummary(chatRoomSummaryFactsFor(draft))
  ).slice(0, ROOM_SUMMARY_MAX);
  const roomTitle = clampStr("Recámara 1", ROOM_TITLE_MAX_LEN) || "Recámara 1";
  const propertyKind: PropertyKind =
    draft.propertyKind === "house" || draft.propertyKind === "loft" || draft.propertyKind === "apartment"
      ? draft.propertyKind
      : "apartment";
  return { title, neighborhood, summary, roomTitle, propertyKind };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Copy every field the extractor resolved into the draft. Fields the wizard
 * asks for (deposit, availability, minimum stay, bathrooms, "ideal para" tags)
 * used to be dropped here, which is why chat posts had thinner data than
 * assistant posts.
 */
function applyGeminiExtraction(draft: WhatsAppBotDraft, ex: Awaited<ReturnType<typeof extractListingDataWithGemini>>["extraction"]): WhatsAppBotDraft {
  const next = { ...draft };
  if (next.rentMxn == null && typeof ex.rentMxn === "number") next.rentMxn = clampRentMxn(ex.rentMxn);
  if (!next.title && ex.propertyTitle) next.title = clampStr(ex.propertyTitle, PROPERTY_TITLE_MAX);
  if (!next.neighborhood && ex.neighborhood) {
    next.neighborhood = shortNeighborhoodLabel(ex.neighborhood);
  }
  if (!next.summary && ex.roomSummary) next.summary = ex.roomSummary.slice(0, ROOM_SUMMARY_MAX);
  if (!next.propertyKind && (ex.propertyKind === "house" || ex.propertyKind === "apartment" || ex.propertyKind === "loft")) {
    next.propertyKind = ex.propertyKind;
  }
  if (ex.roommateGenderPref) {
    next.genderPref = ex.roommateGenderPref;
    next.genderSet = true;
  }
  if (typeof ex.ageMin === "number") next.ageMin = clampAge(ex.ageMin, 22);
  if (typeof ex.ageMax === "number") next.ageMax = clampAge(ex.ageMax, 45);
  if (ex.lodgingType === "shared_room" || ex.lodgingType === "private_room") {
    next.lodging = ex.lodgingType;
    next.roomKindSet = true;
  }
  if (ex.roomDimension) {
    next.roomDimension = ex.roomDimension;
    next.roomKindSet = true;
  }
  if (next.depositMxn == null && typeof ex.depositMxn === "number") {
    next.depositMxn = clampDepositMxn(ex.depositMxn);
  }
  if (next.availableFrom == null && ex.availableFrom && ISO_DATE.test(ex.availableFrom)) {
    next.availableFrom = ex.availableFrom;
  }
  if (typeof ex.minimalStayMonths === "number" && ex.minimalStayMonths >= 1) {
    next.minStay = Math.min(24, Math.floor(ex.minimalStayMonths));
  }
  if (next.bathrooms == null && typeof ex.bathrooms === "number") {
    next.bathrooms = clampBathrooms(ex.bathrooms);
  }
  if (next.bedroomsTotal == null && typeof ex.bedroomsTotal === "number") {
    next.bedroomsTotal = clampBedroomsTotal(ex.bedroomsTotal);
  }
  const affirmed = [...(ex.tags ?? []), ...(ex.idealParaTags ?? [])].filter(isListingTag);
  const denied = (ex.deniedTags ?? []).filter(isListingTag);
  if (denied.length) next.deniedTags = [...new Set([...next.deniedTags, ...denied])];
  if (affirmed.length) next.pubTags = [...new Set([...next.pubTags, ...affirmed])];
  if (next.deniedTags.length) {
    const deniedSet = new Set(next.deniedTags);
    next.pubTags = next.pubTags.filter((t) => !deniedSet.has(t));
  }
  if (next.locLat == null && ex.location?.lat != null && ex.location.lng != null && validLatLng(ex.location.lat, ex.location.lng)) {
    next.locLat = ex.location.lat;
    next.locLng = ex.location.lng;
    next.locLabel = shortNeighborhoodLabel(ex.location.address ?? next.locLabel);
    next.neighborhood = next.neighborhood || next.locLabel || "";
    next.locApproximate = ex.location.type !== "precise";
    next.locRadiusM = clampApproximateRadiusMeters(ex.location.radiusMeters ?? confidenceToRadius(70));
  }
  return next;
}

function mimeFromFilename(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function uploadFilename(url: string): string | null {
  const m = url.match(/^\/api\/uploads\/([^/?#]+)$/);
  return m?.[1] ?? null;
}

/**
 * Yes/No tags the model omits are false negatives on the public card, so the
 * regex signals run on the pasted text with or without a Gemini answer.
 */
function applySourceSignals(draft: WhatsAppBotDraft, sourceText: string): WhatsAppBotDraft {
  if (!sourceText.trim()) return draft;
  const ex = applySourceTextTagSignals({ tags: draft.pubTags, deniedTags: draft.deniedTags }, sourceText);
  return applyGeminiExtraction(draft, ex);
}

export async function enrichPublishDraftFromText(draft: WhatsAppBotDraft, text: string): Promise<WhatsAppBotDraft> {
  let next: WhatsAppBotDraft = {
    ...draft,
    sourceText: [draft.sourceText, text].filter(Boolean).join("\n").slice(0, 4000),
  };
  const rent = parseRentFromText(text);
  if (rent != null && next.rentMxn == null) next.rentMxn = rent;
  const pois = matchGdlSearchPois(text);
  if (pois[0] && next.locLat == null) {
    next.locLat = pois[0].lat;
    next.locLng = pois[0].lng;
    next.locLabel = pois[0].name;
    next.neighborhood = next.neighborhood || pois[0].name;
    next.locApproximate = true;
    next.locRadiusM = 400;
  }
  if (text.trim().length >= 40) {
    try {
      const gem = await extractListingDataWithGemini({ text, city: CITY });
      next = applyGeminiExtraction(next, gem.extraction);
    } catch (err) {
      console.warn("[whatsapp] publish extract failed", err instanceof Error ? err.message : err);
    }
  }
  return applySourceSignals(next, text);
}

export async function enrichPublishDraftFromInfographics(
  db: DatabaseSync,
  uploadDir: string | undefined,
  draft: WhatsAppBotDraft,
): Promise<WhatsAppBotDraft> {
  const urls = draft.infographicUrls.slice(0, 2);
  if (!urls.length) return draft;
  const images: Array<{ mimeType: string; data: string }> = [];
  if (uploadDir) {
    for (const url of urls) {
      const name = uploadFilename(url);
      if (!name) continue;
      const bytes = readUploadBytes(uploadDir, db, name);
      if (!bytes?.length) continue;
      images.push({ mimeType: mimeFromFilename(name), data: bytes.toString("base64") });
    }
  }
  if (!images.length && !draft.sourceText.trim()) return draft;
  try {
    const gem = await extractListingDataWithGemini({
      text: draft.sourceText.trim() || undefined,
      images: images.length ? images : undefined,
      city: CITY,
    });
    return applySourceSignals(applyGeminiExtraction(draft, gem.extraction), draft.sourceText);
  } catch (err) {
    console.warn("[whatsapp] infographic extract failed", err instanceof Error ? err.message : err);
    return applySourceSignals(draft, draft.sourceText);
  }
}

export async function applyLocationText(draft: WhatsAppBotDraft, text: string): Promise<WhatsAppBotDraft> {
  const next = { ...draft };
  const pois = matchGdlSearchPois(text);
  if (pois[0]) {
    next.locLat = pois[0].lat;
    next.locLng = pois[0].lng;
    next.locLabel = pois[0].name;
    next.neighborhood = next.neighborhood || pois[0].name;
    next.locApproximate = true;
    next.locRadiusM = 400;
    return next;
  }
  const pin = await geocodeNamedPlaceInMetro(text, "gdl");
  if (pin) {
    const label = shortNeighborhoodLabel(pin.name);
    next.locLat = pin.lat;
    next.locLng = pin.lng;
    next.locLabel = label || pin.name;
    next.neighborhood = next.neighborhood || next.locLabel;
    next.locApproximate = true;
    next.locRadiusM = 700;
    return next;
  }
  next.locLabel = shortNeighborhoodLabel(text) || text.slice(0, PROPERTY_NEIGHBORHOOD_MAX);
  return next;
}

export function applyNativeLocation(
  draft: WhatsAppBotDraft,
  lat: number,
  lng: number,
  name?: string,
): WhatsAppBotDraft {
  const label = shortNeighborhoodLabel(name) || draft.locLabel || "Ubicación";
  return {
    ...draft,
    locLat: lat,
    locLng: lng,
    locLabel: label,
    neighborhood: draft.neighborhood || label,
    locApproximate: true,
    locRadiusM: APPROXIMATE_RADIUS_DEFAULT_M,
  };
}

export function publishDraftReady(draft: WhatsAppBotDraft): string | null {
  if (draft.locLat == null || draft.locLng == null || !validLatLng(draft.locLat, draft.locLng)) {
    return "Falta la zona o el pin de ubicación.";
  }
  if (draft.rentMxn == null || draft.rentMxn < 1500) return "Falta la renta mensual exacta.";
  return null;
}

function roomKindLabel(draft: WhatsAppBotDraft): string {
  const size =
    draft.roomDimension === "small"
      ? "individual"
      : draft.roomDimension === "large"
        ? "grande"
        : "matrimonial";
  return draft.lodging === "shared_room" ? `Compartida ${size}` : `Privada ${size}`;
}

function genderLabel(draft: WhatsAppBotDraft): string {
  if (draft.genderPref === "female") return "Roomies: prefiere mujer";
  if (draft.genderPref === "male") return "Roomies: prefiere hombre";
  return "Roomies: cualquiera";
}

export function formatPublishPreview(draft: WhatsAppBotDraft): string {
  const fields = composeWhatsAppListingFields(draft);
  const rent = draft.rentMxn != null ? `$${draft.rentMxn} MXN/mes` : "(sin renta)";
  const radius = draft.locRadiusM ?? APPROXIMATE_RADIUS_DEFAULT_M;
  const tags = chatTagLabels(draft.pubTags);
  return [
    "*Así se vería tu anuncio:*",
    `• ${fields.title}`,
    `• ${fields.neighborhood}, ${CITY} (pin aproximado ~${radius} m)`,
    `• ${rent}${draft.depositMxn != null ? ` · depósito ${draft.depositMxn > 0 ? `$${draft.depositMxn}` : "no"}` : ""}`,
    `• ${roomKindLabel(draft)} · ${genderLabel(draft)}`,
    tags.length ? `• Etiquetas: ${tags.join(", ")}` : "• Etiquetas: ninguna todavía",
    `• ${draft.photoUrls.length} foto${draft.photoUrls.length === 1 ? "" : "s"} del espacio${draft.photoUrls.length === 0 ? " (puedes subirlas después)" : ""}`,
    draft.infographicUrls.length > 0
      ? `• ${draft.infographicUrls.length} infográfico${draft.infographicUrls.length === 1 ? "" : "s"} (también en la galería)`
      : null,
    "",
    `Descripción: ${fields.summary.slice(0, 300)}${fields.summary.length > 300 ? "…" : ""}`,
    "",
    "_Al publicar aceptas los Términos y el Aviso de privacidad. El anuncio queda público con este número._",
    `${publicWebOrigin()}/legal/terminos`,
    `${publicWebOrigin()}/legal/privacidad`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/** A tag the source explicitly denied must never ship as a Sí on the card. */
export function publishedTags(draft: WhatsAppBotDraft): ListingTag[] {
  const denied = new Set(draft.deniedTags);
  return draft.pubTags.filter((t) => !denied.has(t));
}

export type WhatsAppPublishResult =
  | { ok: true; roomId: string; propertyId: string; url: string }
  | { ok: false; error: string };

export function publishWhatsAppRoom(
  db: DatabaseSync,
  opts: { publisherId: string; contactStored: string; draft: WhatsAppBotDraft },
): WhatsAppPublishResult {
  const blocked = publishDraftReady(opts.draft);
  if (blocked) return { ok: false, error: blocked };
  const d = opts.draft;
  // Real space photos first (listing card hero), then infographics so they still appear in the gallery.
  const photos = clampListingImageUrls([...d.photoUrls, ...d.infographicUrls]);
  const lat = d.locLat!;
  const lng = d.locLng!;
  const fields = composeWhatsAppListingFields(d);
  if (!minimalRoomSummaryOk(fields.summary)) {
    return { ok: false, error: "La descripción quedó corta. Escribe un poco más del cuarto." };
  }
  const rent = clampRentMxn(d.rentMxn!);

  const propertyId = `prp__${randomUUID()}`;
  const roomId = randomUUID();
  const createdAt = new Date().toISOString();
  const radius = clampApproximateRadiusMeters(d.locRadiusM ?? APPROXIMATE_RADIUS_DEFAULT_M);
  const availFrom = d.availableFrom && /^\d{4}-\d{2}-\d{2}$/.test(d.availableFrom)
    ? d.availableFrom
    : createdAt.slice(0, 10);

  try {
    db.exec("BEGIN IMMEDIATE;");
    db.prepare(
      `INSERT INTO properties (
        id, publisher_id, status, post_mode, title, city, neighborhood, lat, lng, summary, contact_whatsapp,
        property_kind, bedrooms_total, bathrooms, show_whatsapp, hide_pricing, image_urls_json,
        is_approximate_location, approximate_radius_m, created_at, published_at
      ) VALUES (?, ?, 'published', 'room', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, '[]', 1, ?, ?, ?)`,
    ).run(
      propertyId,
      opts.publisherId,
      fields.title,
      CITY,
      fields.neighborhood,
      lat,
      lng,
      fields.summary,
      opts.contactStored,
      fields.propertyKind,
      d.bedroomsTotal != null ? clampBedroomsTotal(d.bedroomsTotal) : 1,
      d.bathrooms != null ? clampBathrooms(d.bathrooms) : 1,
      radius,
      createdAt,
      createdAt,
    );
    db.prepare(
      `INSERT INTO rooms (
        id, property_id, status, title, rent_mxn, rooms_available, tags_json, roommate_gender_pref,
        age_min, age_max, summary, lodging_type, available_from, minimal_stay_months, room_dimension,
        aval_required, sublet_allowed, sort_order, deposit_mxn, image_urls_json, created_at, updated_at,
        occupancy_status
      ) VALUES (?, ?, 'published', ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?, ?, ?, 'available')`,
    ).run(
      roomId,
      propertyId,
      fields.roomTitle,
      rent,
      JSON.stringify(publishedTags(d)),
      d.genderPref,
      clampAge(d.ageMin, 22),
      clampAge(d.ageMax, 45),
      fields.summary,
      d.lodging,
      availFrom,
      d.minStay >= 1 ? d.minStay : 1,
      d.roomDimension,
      d.depositMxn != null ? clampDepositMxn(d.depositMxn) : 0,
      JSON.stringify(photos),
      createdAt,
      createdAt,
    );
    db.exec("COMMIT;");
  } catch (err) {
    try {
      db.exec("ROLLBACK;");
    } catch {
      /* */
    }
    console.warn("[whatsapp] publish insert failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "No se pudo publicar. Intenta de nuevo en un momento." };
  }

  scheduleNotifyOpsNewPostPublished(db, propertyId);
  if (photos.length === 0) {
    scheduleNotifyPublisherAddPhotos(db, { roomId });
  }
  const url = `${publicWebOrigin()}/anuncio/${encodeURIComponent(roomReferenceCode(roomId))}`;
  return { ok: true, roomId, propertyId, url };
}

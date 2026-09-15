import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { confidenceToRadius, extractListingDataWithGemini } from "./assistedDraftGemini.js";
import { matchGdlSearchPois } from "./gdlSearchPois.js";
import { publicWebOrigin } from "./handoffTokens.js";
import { roomReferenceCode } from "./listingReference.js";
import { isListingTag } from "./listingTags.js";
import { scheduleNotifyOpsNewPostPublished } from "./newPostPublishedNotify.js";
import { geocodeNamedPlaceInMetro } from "./placeGeocode.js";
import {
  APPROXIMATE_RADIUS_DEFAULT_M,
  clampAge,
  clampApproximateRadiusMeters,
  clampListingImageUrls,
  clampRentMxn,
  clampStr,
  minimalRoomSummaryOk,
  NEIGHBORHOOD_MAX_LEN,
  ROOM_SUMMARY_MIN_LEN,
  ROOM_TITLE_MAX_LEN,
  TITLE_MAX_LEN,
  validLatLng,
} from "./validation.js";
import type { WhatsAppBotDraft } from "./whatsappSessionStore.js";

const CITY = "Guadalajara";

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

function padRoomSummary(raw: string, neighborhood: string, rent: number): string {
  let s = raw.trim();
  if (s.length < ROOM_SUMMARY_MIN_LEN) {
    const extra = ` Cuarto en ${neighborhood || CITY}, Guadalajara, por $${rent} MXN al mes. Publicado desde WhatsApp. Las fotos muestran el espacio; escríbeme en Bestie o por este mismo número.`;
    s = `${s}${extra}`.trim();
  }
  if (s.length < ROOM_SUMMARY_MIN_LEN) {
    s = `${s} Incluye lo básico para mudarte: cama y espacio para tus cosas.`.trim();
  }
  return s.slice(0, 8000);
}

export async function enrichPublishDraftFromText(draft: WhatsAppBotDraft, text: string): Promise<WhatsAppBotDraft> {
  const next: WhatsAppBotDraft = {
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
      const ex = gem.extraction;
      if (next.rentMxn == null && typeof ex.rentMxn === "number") next.rentMxn = clampRentMxn(ex.rentMxn);
      if (!next.title && ex.propertyTitle) next.title = clampStr(ex.propertyTitle, TITLE_MAX_LEN);
      if (!next.neighborhood && ex.neighborhood) next.neighborhood = clampStr(ex.neighborhood, NEIGHBORHOOD_MAX_LEN);
      if (!next.summary && ex.roomSummary) next.summary = ex.roomSummary;
      if (ex.roommateGenderPref) next.genderPref = ex.roommateGenderPref;
      if (typeof ex.ageMin === "number") next.ageMin = clampAge(ex.ageMin, 22);
      if (typeof ex.ageMax === "number") next.ageMax = clampAge(ex.ageMax, 45);
      if (ex.lodgingType === "shared_room" || ex.lodgingType === "private_room") next.lodging = ex.lodgingType;
      if (ex.roomDimension) next.roomDimension = ex.roomDimension;
      if (ex.tags?.length) next.pubTags = [...new Set([...next.pubTags, ...ex.tags.filter(isListingTag)])];
      if (next.locLat == null && ex.location?.lat != null && ex.location.lng != null && validLatLng(ex.location.lat, ex.location.lng)) {
        next.locLat = ex.location.lat;
        next.locLng = ex.location.lng;
        next.locLabel = ex.location.address ?? next.locLabel;
        next.locApproximate = ex.location.type !== "precise";
        next.locRadiusM = clampApproximateRadiusMeters(ex.location.radiusMeters ?? confidenceToRadius(70));
      }
    } catch (err) {
      console.warn("[whatsapp] publish extract failed", err instanceof Error ? err.message : err);
    }
  }
  return next;
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
    next.locLat = pin.lat;
    next.locLng = pin.lng;
    next.locLabel = pin.name;
    next.neighborhood = next.neighborhood || pin.name;
    next.locApproximate = true;
    next.locRadiusM = 700;
    return next;
  }
  next.locLabel = text.slice(0, 80);
  return next;
}

export function applyNativeLocation(
  draft: WhatsAppBotDraft,
  lat: number,
  lng: number,
  name?: string,
): WhatsAppBotDraft {
  return {
    ...draft,
    locLat: lat,
    locLng: lng,
    locLabel: name?.trim() || draft.locLabel || "Ubicación compartida",
    locApproximate: true,
    locRadiusM: APPROXIMATE_RADIUS_DEFAULT_M,
  };
}

export function publishDraftReady(draft: WhatsAppBotDraft): string | null {
  if (draft.photoUrls.length < 1) return "Falta al menos una foto del cuarto.";
  if (draft.locLat == null || draft.locLng == null || !validLatLng(draft.locLat, draft.locLng)) {
    return "Falta la zona o el pin de ubicación.";
  }
  if (draft.rentMxn == null || draft.rentMxn < 1500) return "Falta la renta mensual.";
  return null;
}

export function formatPublishPreview(draft: WhatsAppBotDraft): string {
  const zone = draft.neighborhood || draft.locLabel || CITY;
  const rent = draft.rentMxn != null ? `$${draft.rentMxn} MXN/mes` : "(sin renta)";
  const radius = draft.locRadiusM ?? APPROXIMATE_RADIUS_DEFAULT_M;
  return [
    "Así se vería tu anuncio:",
    `• ${draft.title || `Cuarto en ${zone}`}`,
    `• ${zone}, ${CITY}`,
    `• ${rent}`,
    `• Ubicación aproximada (~${radius} m)`,
    `• ${draft.photoUrls.length} foto${draft.photoUrls.length === 1 ? "" : "s"}`,
    "Al publicar aceptas los Términos y el Aviso de privacidad. El anuncio queda público con este número.",
    `${publicWebOrigin()}/legal/terminos`,
    `${publicWebOrigin()}/legal/privacidad`,
  ].join("\n");
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
  const photos = clampListingImageUrls(d.photoUrls);
  if (!photos.length) return { ok: false, error: "Las fotos no se pudieron guardar. Mándalas otra vez." };
  const lat = d.locLat!;
  const lng = d.locLng!;
  const neighborhood = clampStr(d.neighborhood || d.locLabel || "Guadalajara", NEIGHBORHOOD_MAX_LEN) || "Guadalajara";
  const rent = clampRentMxn(d.rentMxn!);
  const title = clampStr(d.title || `Cuarto en ${neighborhood}`, TITLE_MAX_LEN) || `Cuarto en ${neighborhood}`;
  const roomTitle = clampStr("Recámara", ROOM_TITLE_MAX_LEN) || "Recámara";
  const summary = padRoomSummary(d.summary, neighborhood, rent);
  if (!minimalRoomSummaryOk(summary)) return { ok: false, error: "La descripción quedó corta. Escribe un poco más del cuarto." };

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
      ) VALUES (?, ?, 'published', 'room', ?, ?, ?, ?, ?, ?, ?, NULL, 1, 1, 1, 0, '[]', 1, ?, ?, ?)`,
    ).run(
      propertyId,
      opts.publisherId,
      title,
      CITY,
      neighborhood,
      lat,
      lng,
      summary,
      opts.contactStored,
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
      ) VALUES (?, ?, 'published', ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?, ?, 'available')`,
    ).run(
      roomId,
      propertyId,
      roomTitle,
      rent,
      JSON.stringify(d.pubTags),
      d.genderPref,
      clampAge(d.ageMin, 22),
      clampAge(d.ageMax, 45),
      summary,
      d.lodging,
      availFrom,
      d.minStay >= 1 ? d.minStay : 1,
      d.roomDimension,
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
  const url = `${publicWebOrigin()}/anuncio/${encodeURIComponent(roomReferenceCode(roomId))}`;
  return { ok: true, roomId, propertyId, url };
}

import type { Draft, RoomDraft } from "@/pages/PublishWizardPage";
import {
  addDraftRoomToProperty,
  createDraftProperty,
  isListingsApiConfigured,
  patchDraftRoom,
  publishPropertyBundle,
  updateProperty,
} from "@/lib/listingsApi";
import { isRoomIdealParaTag, LISTING_TAG_SLUG_SET } from "@/lib/listingTags";
import { draftImagesToUrls } from "@/lib/publishWizard/draftImages";
import { roomsAvailableFromIdealTags } from "@/lib/publishWizard/wizardTags";
import type { ListingStatus, ListingTag, PropertyKind, RoommateGenderPref } from "@/types/listing";
import type { PublishWizardServerSync } from "@/lib/publishWizard/previewSession";

/** Titles used in `PublishWizardPage` steps — keep in sync when renaming steps. */
export const WIZARD_STEP_TITLES = {
  POST_MODE: "¿Qué tipo de espacio deseas publicar?",
  LOCATION: "¿Dónde se ubica el espacio?",
  PROPERTY_GENERAL: "¿Cómo es tu espacio?",
  ROOMS: "Recámaras",
  PHOTOS: "Fotos",
  TAG_PHOTOS: "Etiquetar fotos",
  REVIEW: "Revisar y publicar",
} as const;

const VALID_PROPERTY_KINDS: readonly PropertyKind[] = ["house", "apartment", "loft"];
const VALID_ROOM_LODGING_TYPES = ["private_room", "shared_room"] as const;
const VALID_ROOMMATE_GENDER_PREFS: readonly RoommateGenderPref[] = ["any", "female", "male"];

export const CITY_ANCHOR = {
  Guadalajara: { neighborhood: "Zona metropolitana", lat: 20.675_138, lng: -103.347_345 },
} as const;

const DRAFT_WA_PLACEHOLDER = "0000000000000";
const SINGLE_ROOM_DEFAULT_TITLE = "Recámara 1";

const PROPERTY_TITLE_MIN = 10;
const PROPERTY_TITLE_MAX = 70;
const PROPERTY_NEIGHBORHOOD_MIN = 3;
const PROPERTY_NEIGHBORHOOD_MAX = 50;
const PROPERTY_SUMMARY_MIN = 200;
const PROPERTY_SUMMARY_MAX = 1500;
const PROPERTY_BEDROOMS_MAX = 20;
const PROPERTY_BATHROOMS_MAX = 10;
const PROPERTY_OCCUPANTS_MAX = 50;
const ROOM_SUMMARY_MIN = 200;
const ROOM_SUMMARY_MAX = 1500;

const DEFAULT_PROPERTY_SUMMARY =
  "Cuéntanos qué hace especial a la propiedad en general. Describe las zonas comunes (sala, cocina, terraza, áreas del edificio) y la convivencia. (Importante: Los detalles específicos de la recámara disponible los llenaremos en el Paso 4).";
const LEGACY_DEFAULT_PROPERTY_SUMMARY =
  "Cuéntanos qué hace especial a tu hogar. Describe la propiedad y sus zonas comunes (baños, cocina, estacionamiento), sin olvidar las reglas de convivencia y ese toque único que lo distingue.";

function tagOk(t: string): t is ListingTag {
  return LISTING_TAG_SLUG_SET.has(t);
}

function isDefaultPropertySummarySeed(value: string) {
  const t = value.trim();
  return t === DEFAULT_PROPERTY_SUMMARY || t === LEGACY_DEFAULT_PROPERTY_SUMMARY;
}

export function normalizeWhatsApp(s: string): string {
  return s.replace(/\D/g, "");
}

function validLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function stepPrefix(stepIndex: number, section: string, message: string): string {
  return `Paso ${stepIndex + 1} · ${section}: ${message}`;
}

export function wizardContactDigits(contactWhatsApp: string, showPublic: boolean): string {
  if (!showPublic) return DRAFT_WA_PLACEHOLDER;
  const d = normalizeWhatsApp(contactWhatsApp);
  return d.length >= 10 ? d : DRAFT_WA_PLACEHOLDER;
}

export function showWizardPropertyBathroomsField(d: Draft): boolean {
  return d.propertyKind === "loft" || d.postMode === "property";
}

export function effectiveWizardPropertyBathrooms(d: Draft): number {
  const b = d.propertyBathrooms;
  if (Number.isFinite(b) && b > 0) return b;
  return 1;
}

export function resolveLatLngForDraft(d: Draft): { lat: number; lng: number } {
  const anchor = CITY_ANCHOR[d.city];
  if (!d.useCustomMapPin) return { lat: anchor.lat, lng: anchor.lng };
  const lat = Number(String(d.customLat).replace(",", "."));
  const lng = Number(String(d.customLng).replace(",", "."));
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return { lat: anchor.lat, lng: anchor.lng };
}

export function effectiveRoomTitle(room: Pick<RoomDraft, "title">, postMode: Draft["postMode"]): string {
  const trimmed = room.title.trim();
  if (trimmed) return trimmed;
  if (postMode === "room") return SINGLE_ROOM_DEFAULT_TITLE;
  return "";
}

export function effectiveRoomsAvailable(draft: Draft, roomIndex: number): number {
  const room = draft.rooms[roomIndex];
  if (!room) return 1;
  if (draft.postMode === "property") return Math.max(1, room.roomsAvailable);
  return roomsAvailableFromIdealTags(room.tags);
}

export function draftPropertyImageUrls(draft: Draft): string[] {
  return draftImagesToUrls(draft.propertyImageUrls);
}

export function draftRoomImageUrls(draft: Draft, roomIndex: number): string[] {
  return draftImagesToUrls(draft.roomImageUrls[roomIndex] ?? []);
}

export function mergedRoomTagsForPayload(d: Draft, roomIndex: number): ListingTag[] {
  const room = d.rooms[roomIndex];
  if (!room) return [];
  const seen = new Set<ListingTag>();
  const out: ListingTag[] = [];
  for (const t of [...d.propertyTags, ...room.tags]) {
    if (!tagOk(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  if (room.rentIncludesUtilities) {
    if (!out.includes("servicios-incluidos")) out.push("servicios-incluidos");
  } else {
    return out.filter((t) => t !== "servicios-incluidos");
  }
  return out;
}

function occupantCountsInvalidReason(d: Draft): string | null {
  if (
    d.occupiedByWomenCount == null ||
    !Number.isInteger(d.occupiedByWomenCount) ||
    d.occupiedByWomenCount < 0 ||
    d.occupiedByWomenCount > PROPERTY_OCCUPANTS_MAX
  ) {
    return `Indica cuántas mujeres (Besties) hay en la propiedad (entre 0 y ${PROPERTY_OCCUPANTS_MAX}).`;
  }
  if (
    d.occupiedByMenCount == null ||
    !Number.isInteger(d.occupiedByMenCount) ||
    d.occupiedByMenCount < 0 ||
    d.occupiedByMenCount > PROPERTY_OCCUPANTS_MAX
  ) {
    return `Indica cuántos hombres (Besties) hay en la propiedad (entre 0 y ${PROPERTY_OCCUPANTS_MAX}).`;
  }
  return null;
}

export function propertyGeneralStepInvalidReason(d: Draft): string | null {
  if (d.propertyTitle.trim().length < PROPERTY_TITLE_MIN) {
    return `El título del anuncio debe tener al menos ${PROPERTY_TITLE_MIN} caracteres.`;
  }
  if (d.propertyTitle.trim().length > PROPERTY_TITLE_MAX) {
    return `El título del anuncio no puede exceder los ${PROPERTY_TITLE_MAX} caracteres.`;
  }
  if (d.neighborhood.trim().length < PROPERTY_NEIGHBORHOOD_MIN) {
    return `Indica la colonia o zona (mínimo ${PROPERTY_NEIGHBORHOOD_MIN} caracteres).`;
  }
  if (d.neighborhood.trim().length > PROPERTY_NEIGHBORHOOD_MAX) {
    return `La colonia o zona no puede exceder los ${PROPERTY_NEIGHBORHOOD_MAX} caracteres.`;
  }
  if (d.postMode === "property") {
    if (d.propertySummary.trim().length < PROPERTY_SUMMARY_MIN) {
      return `La descripción de la propiedad y áreas comunes debe tener al menos ${PROPERTY_SUMMARY_MIN} caracteres.`;
    }
    if (d.propertySummary.trim().length > PROPERTY_SUMMARY_MAX) {
      return `La descripción de la propiedad no puede exceder los ${PROPERTY_SUMMARY_MAX} caracteres.`;
    }
    if (isDefaultPropertySummarySeed(d.propertySummary)) {
      return "Sustituye el texto de ejemplo por tu propia descripción de la propiedad y las zonas comunes.";
    }
  }
  if (
    d.propertyKind !== "loft" &&
    (!Number.isFinite(d.propertyBedroomsTotal) || d.propertyBedroomsTotal < 1)
  ) {
    return "Indica cuántas recámaras tiene la propiedad (al menos 1).";
  }
  if (d.propertyBedroomsTotal > PROPERTY_BEDROOMS_MAX) {
    return `El número de recámaras no puede exceder las ${PROPERTY_BEDROOMS_MAX}.`;
  }
  if (
    showWizardPropertyBathroomsField(d) &&
    (!Number.isFinite(d.propertyBathrooms) || d.propertyBathrooms < 1)
  ) {
    return "Indica cuántos baños tiene la propiedad (mínimo 1).";
  }
  if (showWizardPropertyBathroomsField(d) && d.propertyBathrooms > PROPERTY_BATHROOMS_MAX) {
    return `El número de baños no puede exceder los ${PROPERTY_BATHROOMS_MAX}.`;
  }
  if (d.postMode === "property" && !VALID_PROPERTY_KINDS.includes(d.propertyKind)) {
    return "Selecciona el tipo de vivienda (Casa, Departamento o Loft).";
  }
  return occupantCountsInvalidReason(d);
}

export function contactStepInvalidReason(d: Draft): string | null {
  if (!d.showWhatsApp) {
    return "Activa “Mostrar WhatsApp en el anuncio” e ingresa tu número de contacto.";
  }
  const digits = normalizeWhatsApp(d.contactWhatsApp);
  if (digits.length < 10 || digits.length > 15) {
    return "Ingresa un WhatsApp válido (10–15 dígitos).";
  }
  if (/^0+$/.test(digits)) {
    return "Ingresa un número de WhatsApp real (no puede ser solo ceros).";
  }
  return null;
}

export function locationStepInvalidReason(d: Draft): string | null {
  if (!d.city?.trim()) {
    return "Selecciona una ciudad.";
  }
  if (!d.useCustomMapPin) {
    return "Arrastra el marcador en el mapa para indicar la ubicación de tu espacio.";
  }
  const { lat, lng } = resolveLatLngForDraft(d);
  if (!validLatLng(lat, lng)) {
    return "La ubicación en el mapa no es válida.";
  }
  return null;
}

export function photosStepInvalidReason(d: Draft): string | null {
  if (d.postMode === "room") {
    if (draftRoomImageUrls(d, 0).length < 1) {
      return "Sube al menos 1 foto de tu espacio.";
    }
    return null;
  }
  const unassigned = d.unassignedImageUrls.length;
  const roomPhotos = d.roomImageUrls.reduce((sum, row) => sum + row.length, 0);
  const shared = d.propertyImageUrls.length;
  if (unassigned + roomPhotos + shared < 1) {
    return "Sube al menos 1 foto antes de continuar.";
  }
  return null;
}

export function tagPhotosStepInvalidReason(d: Draft): string | null {
  if (d.postMode !== "property") return null;
  if (d.unassignedImageUrls.length > 0) {
    return "Categoriza todas las fotos sin asignar (Sin categorizar) antes de continuar.";
  }
  return null;
}

export function publishPhotosInvalidReason(d: Draft): string | null {
  const stepErr = photosStepInvalidReason(d);
  if (stepErr) return stepErr;
  const tagErr = tagPhotosStepInvalidReason(d);
  if (tagErr) return tagErr;
  if (d.postMode === "property") {
    for (let i = 0; i < d.rooms.length; i++) {
      if (draftRoomImageUrls(d, i).length < 1) {
        return `Sube al menos 1 foto para la recámara ${i + 1}.`;
      }
    }
  }
  return null;
}

/** Validates the current wizard step before advancing with “Siguiente”. */
export function validateWizardStepByTitle(
  stepTitle: string,
  draft: Draft,
  stepIndex: number,
): string | null {
  switch (stepTitle) {
    case WIZARD_STEP_TITLES.LOCATION: {
      const err = locationStepInvalidReason(draft);
      return err ? stepPrefix(stepIndex, "Ubicación", err) : null;
    }
    case WIZARD_STEP_TITLES.PROPERTY_GENERAL: {
      const err = propertyGeneralStepInvalidReason(draft) ?? contactStepInvalidReason(draft);
      return err ? stepPrefix(stepIndex, "Datos generales", err) : null;
    }
    case WIZARD_STEP_TITLES.ROOMS: {
      const err = validateRoomsForSubmit(draft);
      return err ? stepPrefix(stepIndex, "Recámaras", err) : null;
    }
    case WIZARD_STEP_TITLES.PHOTOS: {
      const err = photosStepInvalidReason(draft);
      return err ? stepPrefix(stepIndex, "Fotos", err) : null;
    }
    case WIZARD_STEP_TITLES.TAG_PHOTOS: {
      const err = tagPhotosStepInvalidReason(draft);
      return err ? stepPrefix(stepIndex, "Etiquetar fotos", err) : null;
    }
    default:
      return null;
  }
}

function roomTitleRequired(d: Pick<Draft, "postMode">): boolean {
  return d.postMode === "property";
}

function roomValidationSuffix(roomIndex: number, roomCount: number): string {
  return roomCount > 1 ? ` (recámara ${roomIndex + 1})` : "";
}

function roomHasIdealParaTag(tags: readonly ListingTag[]): boolean {
  return tags.some((t) => isRoomIdealParaTag(t));
}

export function validateRoomsForSubmit(d: Draft): string | null {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const needTitle = roomTitleRequired(d);
  for (let i = 0; i < d.rooms.length; i++) {
    const r = d.rooms[i]!;
    const suffix = roomValidationSuffix(i, d.rooms.length);
    if (needTitle && !r.title.trim()) {
      return `Cada recámara necesita un título${suffix}.`;
    }
    const summaryTrim = r.summary.trim();
    if (!summaryTrim) {
      return `Cada recámara necesita una descripción${suffix}.`;
    }
    const len = summaryTrim.length;
    if (len < ROOM_SUMMARY_MIN) {
      return `La descripción de cada recámara${suffix} debe tener al menos ${ROOM_SUMMARY_MIN} caracteres.`;
    }
    if (len > ROOM_SUMMARY_MAX) {
      return `La descripción de cada recámara${suffix} no puede exceder los ${ROOM_SUMMARY_MAX} caracteres.`;
    }
    if (!Number.isFinite(r.rentMxn) || r.rentMxn <= 0) {
      return `En cada recámara${suffix} indica una renta mayor a 0.`;
    }
    if (!Number.isFinite(r.roomsAvailable) || r.roomsAvailable < 1) {
      return `En cada recámara${suffix} indica al menos 1 plaza o espacio disponible.`;
    }
    if (r.ageMin < 18 || r.ageMax < 18 || r.ageMax > 99) {
      return "La edad mínima y máxima debe estar entre 18 y 99 años.";
    }
    if (r.ageMin > r.ageMax) {
      return `En cada recámara${suffix} la edad mínima no puede ser mayor que la máxima.`;
    }
    if (!iso.test(r.availableFrom.trim())) {
      return `En cada recámara${suffix} indica una fecha “Disponible desde” válida (AAAA-MM-DD).`;
    }
    if (!Number.isFinite(r.minimalStayMonths) || r.minimalStayMonths < 1) {
      return `En cada recámara${suffix} la estancia mínima debe ser de al menos 1 mes.`;
    }
    if (!Number.isFinite(r.depositMxn) || r.depositMxn < 0) {
      return `En cada recámara${suffix} indica el depósito (puede ser 0).`;
    }
    if (d.postMode === "room") {
      if (!VALID_ROOM_LODGING_TYPES.includes(r.lodgingType as (typeof VALID_ROOM_LODGING_TYPES)[number])) {
        return `Selecciona el tipo de recámara (privada o compartida)${suffix}.`;
      }
      if (!VALID_ROOMMATE_GENDER_PREFS.includes(r.roommateGenderPref)) {
        return `Selecciona la preferencia de convivencia (Hombre, Mujer o Sin preferencia)${suffix}.`;
      }
    }
    if (!roomHasIdealParaTag(r.tags)) {
      return `Selecciona al menos una opción en “Ideal para”${suffix}.`;
    }
  }
  return null;
}

export function getPublishBlockedReason(draft: Draft): string | null {
  const locationErr = locationStepInvalidReason(draft);
  if (locationErr) return `Paso · Ubicación: ${locationErr}`;

  const generalErr = propertyGeneralStepInvalidReason(draft);
  if (generalErr) return `Paso · Datos generales: ${generalErr}`;

  const contactErr = contactStepInvalidReason(draft);
  if (contactErr) return `Paso · Contacto: ${contactErr}`;

  const roomsErr = validateRoomsForSubmit(draft);
  if (roomsErr) return `Paso · Recámaras: ${roomsErr}`;

  const photosErr = publishPhotosInvalidReason(draft);
  if (photosErr) return `Paso · Fotos: ${photosErr}`;

  return null;
}

export { PROPERTY_SUMMARY_MIN, PROPERTY_SUMMARY_MAX, ROOM_SUMMARY_MIN, ROOM_SUMMARY_MAX, PROPERTY_TITLE_MAX };

export async function syncDraftToServer(
  draft: Draft,
  serverSync: PublishWizardServerSync,
): Promise<PublishWizardServerSync> {
  if (!isListingsApiConfigured()) return serverSync;

  const anchor = CITY_ANCHOR[draft.city];
  const neighborhood = draft.neighborhood.trim() || anchor.neighborhood;
  const { lat, lng } = resolveLatLngForDraft(draft);
  const wa = wizardContactDigits(draft.contactWhatsApp, draft.showWhatsApp);

  for (let attempt = 0; attempt < 2; attempt++) {
    let propertyId = serverSync.propertyId;
    let roomIds = [...serverSync.roomIds];

    if (!propertyId) {
      const prop = await createDraftProperty({
        title: draft.propertyTitle.trim() || "Sin título",
        city: draft.city,
        neighborhood,
        lat,
        lng,
        summary: draft.propertySummary.trim(),
        contactWhatsApp: wa,
        propertyKind: draft.propertyKind,
        bedroomsTotal: draft.propertyBedroomsTotal,
        bathrooms: effectiveWizardPropertyBathrooms(draft),
        showWhatsApp: draft.showWhatsApp,
        imageUrls: draftPropertyImageUrls(draft),
        isApproximateLocation: draft.isApproximateLocation,
        occupiedByWomenCount: draft.occupiedByWomenCount,
        occupiedByMenCount: draft.occupiedByMenCount,
      });
      propertyId = prop.id;
      roomIds = draft.rooms.map(() => "");
    }

    while (roomIds.length < draft.rooms.length) roomIds.push("");
    roomIds = roomIds.slice(0, draft.rooms.length);

    for (let i = 0; i < draft.rooms.length; i++) {
      const r = draft.rooms[i]!;
      const payload = {
        title: effectiveRoomTitle(r, draft.postMode) || "Recámara en borrador",
        rentMxn: r.rentMxn,
        roomsAvailable: effectiveRoomsAvailable(draft, i),
        tags: mergedRoomTagsForPayload(draft, i),
        roommateGenderPref: r.roommateGenderPref,
        ageMin: r.ageMin,
        ageMax: r.ageMax,
        summary: r.summary.trim(),
        lodgingType: r.lodgingType,
        availableFrom: r.availableFrom.trim(),
        minimalStayMonths: r.minimalStayMonths,
        roomDimension: r.roomDimension,
        depositMxn: r.depositMxn,
        imageUrls: draftRoomImageUrls(draft, i),
      };
      const rid = roomIds[i];
      if (!rid) {
        const created = await addDraftRoomToProperty(propertyId!, payload);
        roomIds[i] = created.id;
      } else {
        await patchDraftRoom(propertyId!, rid, payload);
      }
    }

    try {
      await updateProperty(propertyId!, {
        postMode: draft.postMode,
        title: draft.propertyTitle.trim() || "Sin título",
        summary: draft.propertySummary.trim(),
        city: draft.city,
        neighborhood,
        lat,
        lng,
        contactWhatsApp: wa,
        propertyKind: draft.propertyKind,
        bedroomsTotal: draft.propertyBedroomsTotal,
        bathrooms: effectiveWizardPropertyBathrooms(draft),
        showWhatsApp: draft.showWhatsApp,
        imageUrls: draftPropertyImageUrls(draft),
        isApproximateLocation: draft.isApproximateLocation,
        occupiedByWomenCount: draft.occupiedByWomenCount,
        occupiedByMenCount: draft.occupiedByMenCount,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt === 0 && (msg.includes("update_property_http_404") || msg.includes("update_property_http_403"))) {
        serverSync = { propertyId: "", roomIds: [] };
        continue;
      }
      throw e;
    }

    return { propertyId, roomIds };
  }

  throw new Error("sync_draft_failed");
}

export type PublishDraftResult =
  | { kind: "published"; roomId: string }
  | { kind: "auth_required" }
  | { kind: "error"; message: string };

export async function publishDraftFromWizard(opts: {
  draft: Draft;
  serverSync: PublishWizardServerSync;
  editingLiveProperty: { status: Extract<ListingStatus, "published" | "paused"> } | null;
  apiOn: boolean;
  isLoggedIn: boolean;
}): Promise<PublishDraftResult> {
  const { draft, editingLiveProperty, apiOn, isLoggedIn } = opts;
  let serverSync = opts.serverSync;

  const blocked = getPublishBlockedReason(draft);
  if (blocked) return { kind: "error", message: blocked };

  const anchor = CITY_ANCHOR[draft.city];
  const neighborhood = draft.neighborhood.trim() || anchor.neighborhood;
  const digits = normalizeWhatsApp(draft.contactWhatsApp);

  if (!isLoggedIn) {
    if (apiOn) {
      try {
        serverSync = (await syncDraftToServer(draft, serverSync)) ?? serverSync;
      } catch (e) {
        return { kind: "error", message: e instanceof Error ? e.message : "No se pudo guardar el borrador." };
      }
    }
    return { kind: "auth_required" };
  }

  if (!apiOn) {
    return { kind: "error", message: "Configura la API para publicar en el catálogo." };
  }

  try {
    serverSync = (await syncDraftToServer(draft, serverSync)) ?? serverSync;
    const { lat, lng } = resolveLatLngForDraft(draft);
    const firstRoomId =
      serverSync.roomIds.find((id) => typeof id === "string" && id.length > 0) ?? null;

    if (serverSync.propertyId && firstRoomId) {
      const propPatch: Parameters<typeof updateProperty>[1] = {
        postMode: draft.postMode,
        title: draft.propertyTitle.trim(),
        summary: draft.propertySummary.trim(),
        city: draft.city,
        neighborhood,
        lat,
        lng,
        contactWhatsApp: draft.showWhatsApp ? digits : "",
        propertyKind: draft.propertyKind,
        bedroomsTotal: draft.propertyBedroomsTotal,
        bathrooms: effectiveWizardPropertyBathrooms(draft),
        showWhatsApp: draft.showWhatsApp,
        imageUrls: draftPropertyImageUrls(draft),
        isApproximateLocation: draft.isApproximateLocation,
        occupiedByWomenCount: draft.occupiedByWomenCount,
        occupiedByMenCount: draft.occupiedByMenCount,
      };
      if (editingLiveProperty?.status === "paused" || !editingLiveProperty) {
        propPatch.status = "published";
      }
      await updateProperty(serverSync.propertyId, propPatch);
      return { kind: "published", roomId: firstRoomId };
    }

    const res = await publishPropertyBundle({
      legalAccepted: true,
      property: {
        postMode: draft.postMode,
        title: draft.propertyTitle.trim(),
        city: draft.city,
        neighborhood,
        lat,
        lng,
        summary: draft.propertySummary.trim(),
        contactWhatsApp: draft.showWhatsApp ? digits : "",
        propertyKind: draft.propertyKind,
        bedroomsTotal: draft.propertyBedroomsTotal,
        bathrooms: effectiveWizardPropertyBathrooms(draft),
        showWhatsApp: draft.showWhatsApp,
        imageUrls: draftPropertyImageUrls(draft),
        isApproximateLocation: draft.isApproximateLocation,
        occupiedByWomenCount: draft.occupiedByWomenCount,
        occupiedByMenCount: draft.occupiedByMenCount,
      },
      rooms: draft.rooms.map((r, i) => ({
        title: effectiveRoomTitle(r, draft.postMode),
        rentMxn: Math.max(1, r.rentMxn),
        roomsAvailable: effectiveRoomsAvailable(draft, i),
        tags: mergedRoomTagsForPayload(draft, i),
        roommateGenderPref: r.roommateGenderPref,
        ageMin: r.ageMin,
        ageMax: r.ageMax,
        summary: r.summary.trim(),
        lodgingType: r.lodgingType,
        availableFrom: r.availableFrom.trim(),
        minimalStayMonths: r.minimalStayMonths,
        roomDimension: r.roomDimension,
        depositMxn: r.depositMxn,
        imageUrls: draftRoomImageUrls(draft, i),
      })),
    });
    const first = res.rooms[0];
    if (!first) return { kind: "error", message: "La API no devolvió recámaras." };
    return { kind: "published", roomId: first.id };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "No se pudo publicar." };
  }
}

export async function saveDraftFromWizard(opts: {
  draft: Draft;
  serverSync: PublishWizardServerSync;
  apiOn: boolean;
}): Promise<{ serverSync: PublishWizardServerSync; error?: string }> {
  const blocked =
    propertyGeneralStepInvalidReason(opts.draft) ?? validateRoomsForSubmit(opts.draft);
  if (blocked) return { serverSync: opts.serverSync, error: blocked };

  if (!opts.apiOn) {
    return { serverSync: opts.serverSync, error: "Configura la API para guardar en el servidor." };
  }

  try {
    const serverSync = await syncDraftToServer(opts.draft, opts.serverSync);
    return { serverSync };
  } catch (e) {
    return {
      serverSync: opts.serverSync,
      error: e instanceof Error ? e.message : "No se pudo guardar el borrador en el servidor.",
    };
  }
}

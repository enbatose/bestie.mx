import type { Draft, RoomDraft } from "@/pages/PublishWizardPage";
import { isRoomAvailableForRent } from "@/lib/roomDisplay";
import {
  addDraftRoomToProperty,
  createDraftProperty,
  deleteDraftRoom,
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

export function effectiveRoomTitle(
  room: Pick<RoomDraft, "title" | "customName">,
  postMode: Draft["postMode"],
): string {
  const custom = room.customName?.trim();
  if (custom) return custom;
  const trimmed = room.title.trim();
  if (trimmed) return trimmed;
  if (postMode === "room") return SINGLE_ROOM_DEFAULT_TITLE;
  return "";
}

export function roomApiFieldsFromDraft(draft: Draft, room: RoomDraft, roomIndex: number) {
  const occupied = !isRoomAvailableForRent(room);
  const base = {
    id: room.id,
    customName: room.customName?.trim() || undefined,
    occupancyStatus: room.occupancyStatus,
    title: effectiveRoomTitle(room, draft.postMode) || "Recámara en borrador",
  };
  if (occupied) {
    return {
      ...base,
      rentMxn: 0,
      roomsAvailable: 1,
      tags: [] as ListingTag[],
      roommateGenderPref: room.occupantGender,
      ageMin: room.occupantAge,
      ageMax: room.occupantAge,
      summary: "",
      depositMxn: 0,
      occupantGender: room.occupantGender,
      occupantAge: room.occupantAge,
      imageUrls: [] as string[],
    };
  }
  return {
    ...base,
    rentMxn: room.rentMxn,
    roomsAvailable: effectiveRoomsAvailable(draft, roomIndex),
    tags: mergedRoomTagsForPayload(draft, roomIndex),
    roommateGenderPref: room.roommateGenderPref,
    ageMin: room.ageMin,
    ageMax: room.ageMax,
    summary: room.summary.trim(),
    lodgingType: room.lodgingType,
    availableFrom: room.availableFrom.trim(),
    minimalStayMonths: room.minimalStayMonths,
    roomDimension: room.roomDimension,
    depositMxn: room.depositMxn,
    imageUrls: draftRoomImageUrls(draft, roomIndex),
  };
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

/** Room posts store photos on the room slot; mirror them on the property for API sync/publish. */
export function draftPropertyImageUrlsForSync(draft: Draft): string[] {
  if (draft.postMode === "room") {
    return draftRoomImageUrls(draft, 0);
  }
  return draftPropertyImageUrls(draft);
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

export function contactStepInvalidReason(_d: Draft): string | null {
  return null;
}

export function resolveListingContactForApi(
  profilePhoneE164: string | null | undefined,
  draft: Draft,
): { contactWhatsApp: string; showWhatsApp: boolean } {
  const raw = profilePhoneE164?.trim() || draft.contactWhatsApp?.trim() || "";
  const digits = normalizeWhatsApp(raw.replace(/^\+/, ""));
  const valid = digits.length >= 10 && digits.length <= 15 && !/^0+$/.test(digits);
  return {
    contactWhatsApp: valid ? digits : DRAFT_WA_PLACEHOLDER,
    showWhatsApp: valid,
  };
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
    if (draftPropertyImageUrls(d).length < 1) {
      return "Sube al menos 1 foto de áreas comunes.";
    }
    for (let i = 0; i < d.rooms.length; i++) {
      const room = d.rooms[i]!;
      if (!isRoomAvailableForRent(room)) continue;
      if (draftRoomImageUrls(d, i).length < 1) {
        return `Sube al menos 1 foto para ${room.customName?.trim() || `la recámara ${i + 1}`}.`;
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
      const err = propertyGeneralStepInvalidReason(draft);
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

    if (d.postMode === "property" && !isRoomAvailableForRent(r)) {
      if (!Number.isFinite(r.occupantAge) || r.occupantAge < 18 || r.occupantAge > 99) {
        return `Indica la edad del ocupante actual${suffix} (18–99 años).`;
      }
      if (!["any", "female", "male"].includes(r.occupantGender)) {
        return `Indica el género del ocupante actual${suffix}.`;
      }
      continue;
    }

    if (needTitle && !r.customName?.trim() && !r.title?.trim()) {
      return `Cada recámara necesita un nombre o título${suffix}.`;
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
  profilePhoneE164?: string | null,
): Promise<PublishWizardServerSync> {
  if (!isListingsApiConfigured()) return serverSync;

  const anchor = CITY_ANCHOR[draft.city];
  const neighborhood = draft.neighborhood.trim() || anchor.neighborhood;
  const { lat, lng } = resolveLatLngForDraft(draft);
  const contact = resolveListingContactForApi(profilePhoneE164, draft);
  const wa = wizardContactDigits(contact.contactWhatsApp, contact.showWhatsApp);

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
        showWhatsApp: contact.showWhatsApp,
        imageUrls: draftPropertyImageUrlsForSync(draft),
        isApproximateLocation: draft.isApproximateLocation,
        streetViewPov: draft.streetViewPov ?? null,
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
      const payload = roomApiFieldsFromDraft(draft, r, i);
      const knownServerId = roomIds[i]?.trim() || "";
      if (knownServerId) {
        try {
          await patchDraftRoom(propertyId!, knownServerId, payload);
          roomIds[i] = knownServerId;
          continue;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!msg.includes("patch_room_http_404")) throw e;
          await deleteDraftRoom(propertyId!, knownServerId);
        }
      }
      const created = await addDraftRoomToProperty(propertyId!, { ...payload, id: r.id });
      roomIds[i] = created.id;
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
        showWhatsApp: contact.showWhatsApp,
        imageUrls: draftPropertyImageUrlsForSync(draft),
        isApproximateLocation: draft.isApproximateLocation,
        streetViewPov: draft.streetViewPov ?? null,
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
  profilePhoneE164?: string | null;
}): Promise<PublishDraftResult> {
  const { draft, editingLiveProperty, apiOn, isLoggedIn, profilePhoneE164 } = opts;
  let serverSync = opts.serverSync;

  const blocked = getPublishBlockedReason(draft);
  if (blocked) return { kind: "error", message: blocked };

  const anchor = CITY_ANCHOR[draft.city];
  const neighborhood = draft.neighborhood.trim() || anchor.neighborhood;
  const contact = resolveListingContactForApi(profilePhoneE164, draft);
  const digits = contact.contactWhatsApp;

  if (!isLoggedIn) {
    if (apiOn) {
      try {
        serverSync = (await syncDraftToServer(draft, serverSync, profilePhoneE164)) ?? serverSync;
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
    serverSync = (await syncDraftToServer(draft, serverSync, profilePhoneE164)) ?? serverSync;
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
        contactWhatsApp: contact.showWhatsApp ? digits : "",
        propertyKind: draft.propertyKind,
        bedroomsTotal: draft.propertyBedroomsTotal,
        bathrooms: effectiveWizardPropertyBathrooms(draft),
        showWhatsApp: contact.showWhatsApp,
        imageUrls: draftPropertyImageUrlsForSync(draft),
        isApproximateLocation: draft.isApproximateLocation,
        streetViewPov: draft.streetViewPov ?? null,
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
        contactWhatsApp: contact.showWhatsApp ? digits : "",
        propertyKind: draft.propertyKind,
        bedroomsTotal: draft.propertyBedroomsTotal,
        bathrooms: effectiveWizardPropertyBathrooms(draft),
        showWhatsApp: contact.showWhatsApp,
        imageUrls: draftPropertyImageUrlsForSync(draft),
        isApproximateLocation: draft.isApproximateLocation,
        streetViewPov: draft.streetViewPov ?? null,
        occupiedByWomenCount: draft.occupiedByWomenCount,
        occupiedByMenCount: draft.occupiedByMenCount,
      },
      rooms: draft.rooms.map((r, i) => {
        const fields = roomApiFieldsFromDraft(draft, r, i);
        return {
          ...fields,
          rentMxn: isRoomAvailableForRent(r) ? Math.max(1, fields.rentMxn) : 0,
        };
      }),
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
  profilePhoneE164?: string | null;
}): Promise<{ serverSync: PublishWizardServerSync; error?: string }> {
  const blocked =
    propertyGeneralStepInvalidReason(opts.draft) ?? validateRoomsForSubmit(opts.draft);
  if (blocked) return { serverSync: opts.serverSync, error: blocked };

  if (!opts.apiOn) {
    return { serverSync: opts.serverSync, error: "Configura la API para guardar en el servidor." };
  }

  try {
    const serverSync = await syncDraftToServer(opts.draft, opts.serverSync, opts.profilePhoneE164);
    return { serverSync };
  } catch (e) {
    return {
      serverSync: opts.serverSync,
      error: e instanceof Error ? e.message : "No se pudo guardar el borrador en el servidor.",
    };
  }
}

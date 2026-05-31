import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, CloudCheck, ShieldCheck, Wand2 } from "lucide-react";
import { seedForStep } from "@/lib/adminSeedData";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { WizardLocationMap, WIZARD_APPROXIMATE_RADIUS_M } from "@/components/WizardLocationMap";
import { StreetViewPovEditor } from "@/components/publish/StreetViewPovEditor";
import { WizardNumberStepper } from "@/components/WizardNumberStepper";
import { BulkImageUploader } from "@/components/BulkImageUploader";
import { PropertyRoomManager } from "@/components/publish/PropertyRoomManager";
import { PublishWizardReviewStep } from "@/components/publish/PublishWizardReviewStep";
import { WizardSaveDraftButton } from "@/components/publish/WizardSaveDraftButton";
import {
  deleteDraftRoom,
  fetchPropertyWithRooms,
  isListingsApiConfigured,
} from "@/lib/listingsApi";
import { authLinkPublisher, authMe, consumeHandoffToken, type AuthMe } from "@/lib/authApi";
import { listingPublicPath } from "@/lib/listingReference";
import { type PublishWizardServerSync, publishWizardLastStepIndex } from "@/lib/publishWizard/previewSession";
import {
  LISTING_TAG_LABEL_OVERRIDES,
  LISTING_TAG_SLUG_SET,
  migrateDraftTagScopes,
  PROPERTY_AMENITY_TAG_SLUGS,
  PROPERTY_PERMITIDO_TAG_SLUGS,
  PROPERTY_SCOPE_TAG_SET,
  PROPERTY_SCOPE_TAG_SLUGS,
  ROOMMATE_GENDER_PREF_FIELD_LABEL,
  ROOM_TAG_GROUPS,
} from "@/lib/listingTags";
import {
  hydrateDraftImagesFromUrls,
  normalizeDraftImages,
  normalizePersistedDraftImages,
  type DraftImage,
} from "@/lib/publishWizard/draftImages";
import {
  CITY_ANCHOR,
  draftPropertyImageUrls,
  draftRoomImageUrls,
  effectiveRoomsAvailable,
  effectiveWizardPropertyBathrooms,
  getPublishBlockedReason,
  locationStepInvalidReason,
  normalizeWhatsApp,
  photosStepInvalidReason,
  propertyGeneralStepInvalidReason,
  resolveLatLngForDraft,
  showWizardPropertyBathroomsField,
  validateRoomsForSubmit,
  validateWizardStepByTitle,
  wizardContactDigits,
  publishDraftFromWizard,
  syncDraftToServer,
  ROOM_SUMMARY_MIN,
} from "@/lib/publishWizard/publishCore";
import { firstRoomIndexWithIssues } from "@/lib/publishWizard/roomWizardValidation";
import {
  applyPropertyRentRoomCount,
  hydrateRoomOccupantCounts,
  propertyRentRoomCount,
  syncPropertyRoomSlotsToTotal,
} from "@/lib/publishWizard/propertyRoomSlots";
import { ROOM_SINGLE_FLOW_PHOTO_HINT, roomsAvailableFromIdealTags } from "@/lib/publishWizard/wizardTags";
import { newRoomDraftId } from "@/lib/roomDisplay";
import { TAG_LABELS } from "@/lib/searchFilters";
import { normalizeRoomDraft } from "@/lib/publishWizard/normalizeRoomDraft";
import type {
  ListingStatus,
  ListingTag,
  LodgingType,
  PropertyKind,
  PropertyWithRooms,
  RoomDimension,
  RoomOccupancyStatus,
  RoommateGenderPref,
  StreetViewPov,
} from "@/types/listing";

/** Aligned with server `PROPERTY_SUMMARY_MIN_LEN` (minimum property description length). */
const PROPERTY_TITLE_MIN = 10;
const PROPERTY_TITLE_MAX = 70;
const PROPERTY_NEIGHBORHOOD_MIN = 3;
const PROPERTY_NEIGHBORHOOD_MAX = 50;
const PROPERTY_SUMMARY_MIN = 200;
const PROPERTY_SUMMARY_MAX = 1500;
const PROPERTY_BEDROOMS_MAX = 20;
const PROPERTY_BATHROOMS_MAX = 10;

/** Index in `steps` for paso 1 — tipo de espacio (banner de cuenta para invitados). */
const WIZARD_STEP_POST_MODE = 0;

/** Index in `steps` for “Datos generales” (título, colonia, descripción de la propiedad). */
const WIZARD_STEP_PROPERTY_GENERAL = 2;
/** Index in `steps` for “Recámaras” (disponibilidad, descripción, chips de recámara). */
const WIZARD_STEP_RECAMARAS = 3;

const ROOM_PLAZAS_MAX = 12;
const ROOM_STAY_MAX = 36;

const ROOM_SUMMARY_MAX = 1500;

/** Título por defecto del listado en modo un solo cuarto (campo oculto en el paso Recámaras). */
const SINGLE_ROOM_DEFAULT_TITLE = "Recámara 1";

const ROOM_SUMMARY_PLACEHOLDER =
  "Comparte los detalles que harían que alguien quiera vivir aquí. Describe la vista, el tipo de cama, si cuenta con espacio para trabajar y el ambiente general con los roomies.";

const WIZARD_PROPERTY_AMENITY_SLUGS = PROPERTY_AMENITY_TAG_SLUGS;
const WIZARD_PROPERTY_PERMITIDO_SLUGS = PROPERTY_PERMITIDO_TAG_SLUGS;
const WIZARD_STEP3_TAG_SET = PROPERTY_SCOPE_TAG_SET;
const WIZARD_STEP4_TAG_LABELS = LISTING_TAG_LABEL_OVERRIDES;
const WIZARD_ROOM_TAG_GROUPS = ROOM_TAG_GROUPS;

function formatAutosaveTime(ts: number | null): string | null {
  if (!ts) return null;
  return new Date(ts).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function syncDraftPhotoFields(d: Draft): Draft {
  const commonAreaPhotos = normalizeDraftImages(d.commonAreaPhotos ?? d.propertyImageUrls ?? []);
  const legacyRows = d.roomImageUrls ?? [];
  const rooms = d.rooms.map((room, i) => ({
    ...room,
    photos: normalizeDraftImages(room.photos ?? legacyRows[i] ?? []),
  }));
  const roomImageUrls = rooms.map((r) => r.photos);
  return {
    ...d,
    rooms,
    commonAreaPhotos,
    propertyImageUrls: commonAreaPhotos,
    roomImageUrls,
  };
}

function normalizePersistedDraft(d: Draft): Draft {
  const migrated = migrateDraftTagScopes(normalizePersistedDraftImages(d));
  const rooms = (migrated.rooms ?? []).map((room) => normalizeRoomDraft(room));
  const roomImageUrls = [...(migrated.roomImageUrls ?? [])];
  while (roomImageUrls.length < rooms.length) roomImageUrls.push([]);
  const base: Draft = {
    ...migrated,
    commonAreaPhotos: normalizeDraftImages(migrated.commonAreaPhotos ?? migrated.propertyImageUrls ?? []),
    rooms: rooms.length ? rooms : [defaultRoom()],
    roomImageUrls: roomImageUrls.slice(0, rooms.length || 1),
  };
  return syncDraftPhotoFields(normalizePropertyRoomSlots(base));
}

function normalizePropertyRoomSlots(d: Draft): Draft {
  if (d.postMode !== "property") return d;
  const synced = syncPropertyRoomSlotsToTotal(d, defaultRoom);
  const rentCount = Math.min(synced.rooms.length, propertyRentRoomCount(synced));
  return applyPropertyRentRoomCount(synced, rentCount, defaultRoom);
}

/** Fecha local en `America/Mexico_City` como `YYYY-MM-DD` (compatible con `<input type="date">`). */
function isoDateInMexicoCity(date: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (y && m && day) return `${y}-${m}-${day}`;
  return date.toISOString().slice(0, 10);
}

type NominatimAddress = Record<string, string>;

function pickAddrPart(addr: NominatimAddress | undefined, keys: readonly string[]): string {
  if (!addr) return "";
  for (const k of keys) {
    const v = addr[k]?.trim();
    if (v) return v;
  }
  return "";
}

/** Colonia / zona from reverse-geocode (same keys as the area segment in `privacyLocationFromNominatim`). */
function neighborhoodFromNominatimAddress(addr: NominatimAddress | undefined): string {
  return pickAddrPart(addr, [
    "neighbourhood",
    "suburb",
    "quarter",
    "city_block",
    "district",
    "city_district",
    "hamlet",
  ]);
}

/**
 * Privacy preview from the same Nominatim `address` object as the full line (no extra fetch).
 * Keeps colonia + calle + código postal + ciudad/estado; omits número exterior, interior y POIs tipo negocio.
 */
function privacyLocationFromNominatim(
  addr: NominatimAddress | undefined,
  fallbackNeighborhood: string,
  fallbackCity: string,
): string {
  const area = pickAddrPart(addr, [
    "neighbourhood",
    "suburb",
    "quarter",
    "city_block",
    "district",
    "city_district",
    "hamlet",
  ]);
  const road = pickAddrPart(addr, ["road", "pedestrian", "footway", "residential", "path"]);
  const postcode = pickAddrPart(addr, ["postcode"]);
  const city =
    pickAddrPart(addr, ["city", "town", "village", "municipality"]) || fallbackCity.trim();
  const state = pickAddrPart(addr, ["state", "region"]);
  const country = pickAddrPart(addr, ["country"]);

  const parts: string[] = [];
  if (area) parts.push(area);
  if (road) parts.push(road);
  if (postcode) parts.push(postcode);
  if (city && city !== area && city !== road) parts.push(city);
  if (state && state !== city) parts.push(state);
  if (country) parts.push(country);

  if (parts.length > 0) return parts.join(", ");

  const fb = [fallbackNeighborhood.trim(), fallbackCity.trim()].filter(Boolean);
  const fbPost = postcode ? `${fb.join(", ")}${fb.length ? ", " : ""}${postcode}` : fb.join(", ");
  return fbPost.trim() || postcode || fallbackCity;
}

/** Valid-length placeholder until the user enters a real number; publishing rejects all-zero contacts server-side. */
const DRAFT_WA_PLACEHOLDER = "0000000000000";

type ServerSync = {
  propertyId: string | null;
  /** Parallel to `rooms`; empty string = room not created on the server yet. */
  roomIds: string[];
};

const CITIES = ["Guadalajara"] as const;

export type RoomDraft = {
  /** Persistent id (synced with server room row). */
  id: string;
  customName: string;
  occupancyStatus: RoomOccupancyStatus;
  occupantGender: RoommateGenderPref;
  occupantAge: number;
  /** Current occupants when `occupancyStatus === 'occupied'`. */
  occupantWomenCount: number;
  occupantMenCount: number;
  title: string;
  rentMxn: number;
  depositMxn: number;
  roomsAvailable: number;
  summary: string;
  tags: ListingTag[];
  roommateGenderPref: RoommateGenderPref;
  ageMin: number;
  ageMax: number;
  lodgingType: LodgingType;
  /** ISO `YYYY-MM-DD` — available-from date for the room. */
  availableFrom: string;
  minimalStayMonths: number;
  roomDimension: RoomDimension;
  /** Renta incluye servicios (independiente de los chips Wi‑Fi / agua / luz / gas del paso 3). */
  rentIncludesUtilities: boolean;
  /** Room-specific photos (interior); distinct from property common areas. */
  photos: DraftImage[];
};

export type Draft = {
  /** Strategy: 'room' = single-room post; 'property' = property/multi-room post. */
  postMode: "room" | "property";
  city: (typeof CITIES)[number];
  propertyTitle: string;
  neighborhood: string;
  contactWhatsApp: string;
  propertySummary: string;
  propertyKind: PropertyKind;
  /** Total bedrooms in the building. */
  propertyBedroomsTotal: number;
  /** Bathrooms count (half baths allowed, 0.5 steps). */
  propertyBathrooms: number;
  /** Occupants already living in other rooms (integers ≥ 0; required in paso 3). */
  occupiedByWomenCount: number | null;
  occupiedByMenCount: number | null;
  /** When true, show WhatsApp on the public listing. */
  showWhatsApp: boolean;
  useCustomMapPin: boolean;
  customLat: string;
  customLng: string;
  /**
   * Shared-area / facade photos for property posts.
   * Legacy alias: `propertyImageUrls` (kept in sync when persisting drafts).
   */
  commonAreaPhotos: DraftImage[];
  /**
   * Tagged property images (shared areas / facade) — `/api/uploads/...` from server.
   * @deprecated Prefer `commonAreaPhotos`; kept in sync for legacy draft JSON.
   */
  propertyImageUrls: DraftImage[];
  /** Untagged pool (mandatory to tag for property-mode before publishing). */
  unassignedImageUrls: DraftImage[];
  /** One array per room index. */
  roomImageUrls: DraftImage[][];
  /** Tags de la propiedad (paso 3); se unen a cada recámara al persistir. */
  propertyTags: ListingTag[];
  rooms: RoomDraft[];
  legalAccepted: boolean;
  isApproximateLocation: boolean;
  /** Optional locked Street View camera angle for public listings. */
  streetViewPov?: StreetViewPov;
};

const defaultRoom = (): RoomDraft => ({
  id: newRoomDraftId(),
  customName: "",
  occupancyStatus: "available",
  occupantGender: "any",
  occupantAge: 25,
  occupantWomenCount: 0,
  occupantMenCount: 0,
  title: "",
  rentMxn: 0,
  depositMxn: 0,
  roomsAvailable: 1,
  summary: "",
  tags: [],
  roommateGenderPref: "any",
  ageMin: 22,
  ageMax: 45,
  lodgingType: "private_room",
  availableFrom: isoDateInMexicoCity(),
  minimalStayMonths: 1,
  roomDimension: "medium",
  rentIncludesUtilities: false,
  photos: [],
});

const DEFAULT_PROPERTY_SUMMARY =
  "Describe cómo es la convivencia, la sala, la cocina, y las reglas generales de la casa.";

/** Previous wizard placeholder; still treated as “example text” so borradores viejos piden sustitución. */
const LEGACY_DEFAULT_PROPERTY_SUMMARY =
  "Cuéntanos qué hace especial a tu hogar. Describe la propiedad y sus zonas comunes (baños, cocina, estacionamiento), sin olvidar las reglas de convivencia y ese toque único que lo distingue.";
const DRAFT_ONLY_ROOM_TITLE_SEEDS = [
  "Cuarto disponible",
  "Recámara disponible",
  "Vivienda completa",
  "Cuarto en borrador",
  "Recámara en borrador",
] as const;

const defaultDraft = (): Draft => ({
  postMode: "room",
  city: "Guadalajara",
  propertyTitle: "",
  neighborhood: "",
  contactWhatsApp: "",
  propertySummary: "",
  propertyKind: "house",
  propertyBedroomsTotal: 1,
  propertyBathrooms: 0,
  occupiedByWomenCount: 0,
  occupiedByMenCount: 0,
  showWhatsApp: true,
  useCustomMapPin: false,
  customLat: "",
  customLng: "",
  propertyImageUrls: [],
  commonAreaPhotos: [],
  unassignedImageUrls: [],
  roomImageUrls: [[]],
  propertyTags: [],
  rooms: [{ ...defaultRoom(), title: SINGLE_ROOM_DEFAULT_TITLE }],
  legalAccepted: false,
  isApproximateLocation: false,
});

function isDraftOnlyRoomTitleSeed(value: string) {
  return DRAFT_ONLY_ROOM_TITLE_SEEDS.includes(value.trim() as (typeof DRAFT_ONLY_ROOM_TITLE_SEEDS)[number]);
}

function isDefaultPropertySummarySeed(value: string) {
  const t = value.trim();
  return t === DEFAULT_PROPERTY_SUMMARY || t === LEGACY_DEFAULT_PROPERTY_SUMMARY;
}

function roomTitlePlaceholder(room: Pick<RoomDraft, "lodgingType">) {
  return room.lodgingType === "whole_home" ? "Vivienda completa" : "Recámara disponible";
}

function roomTitleRequired(d: Pick<Draft, "postMode">): boolean {
  return d.postMode === "property";
}

/** Título enviado al API; en modo un solo cuarto el campo no se muestra en el paso Recámaras. */
function effectiveRoomTitle(
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

function convertRoomDraftToProperty(d: Draft): Draft {
  if (d.postMode === "property") return d;
  const rooms = d.rooms.length > 0 ? d.rooms : [defaultRoom()];
  return {
    ...d,
    postMode: "property",
    ...(d.propertyKind === "loft"
      ? { propertyBedroomsTotal: 1 }
      : {
          propertyBedroomsTotal: Math.max(
            1,
            Math.min(
              PROPERTY_BEDROOMS_MAX,
              Number.isFinite(d.propertyBedroomsTotal) ? d.propertyBedroomsTotal : 1,
            ),
          ),
        }),
    propertyTitle: d.propertyTitle.trim().toLowerCase() === "sin título" ? "" : d.propertyTitle,
    propertySummary: isDefaultPropertySummarySeed(d.propertySummary) ? "" : d.propertySummary,
    rooms,
    roomImageUrls: rooms.map((_, i) => d.roomImageUrls[i] ?? []),
  };
}


function isFreshDefaultDraft(d: Draft): boolean {
  return (
    JSON.stringify({ ...d, legalAccepted: false }) === JSON.stringify({ ...defaultDraft(), legalAccepted: false })
  );
}

/** Autosave must not create server rows until required numbers are set (defaults are empty/zero). */
function wizardHasMinimumFieldsForAutosave(d: Draft): boolean {
  if (!Number.isFinite(d.propertyBedroomsTotal) || d.propertyBedroomsTotal < 1) return false;
  if (
    showWizardPropertyBathroomsField(d) &&
    (!Number.isFinite(d.propertyBathrooms) || d.propertyBathrooms <= 0)
  ) {
    return false;
  }
  return true;
}

function resumeStepForDraft(draft: Draft, opts: { upgrade: boolean }): number {
  if (opts.upgrade) return 2;

  if (locationStepInvalidReason(draft)) return 1;

  if (propertyGeneralStepInvalidReason(draft)) return 2;

  if (validateRoomsForSubmit(draft)) return 3;

  if (draft.postMode === "room" && photosStepInvalidReason(draft)) return 4;

  return draft.postMode === "property" ? 4 : 5;
}

function pickCity(city: string): (typeof CITIES)[number] {
  return (CITIES as readonly string[]).includes(city) ? (city as (typeof CITIES)[number]) : "Guadalajara";
}

function tagOk(t: string): t is ListingTag {
  return LISTING_TAG_SLUG_SET.has(t);
}

function togglePropertyTag(d: Draft, tag: ListingTag): Draft {
  const prop = d.propertyTags.filter((t) => t !== "servicios-incluidos");
  const isOn = prop.includes(tag);
  const nextTags = !isOn ? [...prop, tag] : prop.filter((t) => t !== tag);
  return { ...d, propertyTags: nextTags.filter(tagOk) };
}

function toggleRoomTag(d: Draft, roomIndex: number, tag: ListingTag, active: boolean): Draft {
  return {
    ...d,
    rooms: d.rooms.map((r, j) => {
      if (j !== roomIndex) return r;
      const tags = r.tags.filter((t) => t !== "servicios-incluidos");
      const nextTags = !active
        ? tags.includes(tag)
          ? tags
          : [...tags, tag]
        : tags.filter((t) => t !== tag);
      const filtered = nextTags.filter(tagOk);
      const roomsAvailable = roomsAvailableFromIdealTags(filtered);
      return { ...r, tags: filtered, roomsAvailable };
    }),
  };
}

/** Migra tags legacy; no vincula `servicios-incluidos` con Wi‑Fi / agua / luz / gas en estado. */
function normalizeRoomTagsFromServer(raw: readonly ListingTag[]): ListingTag[] {
  let next = [...raw].filter((t) => t !== "servicios-incluidos" && t !== "agua-caliente");
  if (raw.includes("lavanderia")) {
    next = next.filter((t) => t !== "lavanderia");
    if (!next.includes("lavadora")) next.push("lavadora");
    if (!next.includes("secadora")) next.push("secadora");
  }
  return [...new Set(next)].filter(tagOk);
}

function splitHydratedPropertyAndRoomTags(
  rooms: Array<{ tags: ListingTag[] }>,
): { propertyTags: ListingTag[]; perRoomTags: ListingTag[][] } {
  const unionProp = new Set<ListingTag>();
  for (const rm of rooms) {
    for (const t of rm.tags) {
      if (WIZARD_STEP3_TAG_SET.has(t)) unionProp.add(t);
    }
  }
  const propertyTags = [...unionProp].filter(tagOk);
  const perRoomTags = rooms.map((rm) =>
    rm.tags.filter((t) => !WIZARD_STEP3_TAG_SET.has(t)).filter(tagOk),
  );
  return { propertyTags, perRoomTags };
}

function mergedRoomTagsForPayload(d: Draft, roomIndex: number): ListingTag[] {
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

function draftFromPropertyBundle(bundle: PropertyWithRooms): { draft: Draft; serverSync: ServerSync } {
  const p = bundle.property;
  const srvRooms = [...bundle.rooms].sort((a, b) => a.sortOrder - b.sortOrder);
  const city = pickCity(p.city);
  const anchor = CITY_ANCHOR[city];
  const usePin =
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    (Math.abs(p.lat - anchor.lat) > 0.0002 || Math.abs(p.lng - anchor.lng) > 0.0002);
  let roomDrafts: RoomDraft[] =
    srvRooms.length > 0
      ? srvRooms.map((r) =>
          hydrateRoomOccupantCounts({
          ...defaultRoom(),
          id: r.id,
          customName: r.customName?.trim() ?? "",
          occupancyStatus: r.occupancyStatus === "occupied" ? "occupied" : "available",
          occupantGender: r.occupantGender ?? "any",
          occupantAge:
            r.occupantAge != null && Number.isFinite(r.occupantAge)
              ? Math.min(99, Math.max(18, r.occupantAge))
              : 25,
          occupantWomenCount:
            r.occupantWomenCount != null && Number.isFinite(Number(r.occupantWomenCount))
              ? Math.max(0, Math.floor(Number(r.occupantWomenCount)))
              : 0,
          occupantMenCount:
            r.occupantMenCount != null && Number.isFinite(Number(r.occupantMenCount))
              ? Math.max(0, Math.floor(Number(r.occupantMenCount)))
              : 0,
          title:
            r.status === "draft" && isDraftOnlyRoomTitleSeed(r.title)
              ? ""
              : r.customName?.trim() || r.title,
          rentMxn: r.rentMxn,
          depositMxn: r.depositMxn,
          roomsAvailable: r.roomsAvailable,
          summary: r.summary,
          rentIncludesUtilities: (r.tags ?? []).includes("servicios-incluidos"),
          tags: normalizeRoomTagsFromServer((r.tags ?? []) as ListingTag[]),
          roommateGenderPref: r.roommateGenderPref,
          ageMin: Math.min(99, Math.max(18, Number(r.ageMin) || 18)),
          ageMax: (() => {
            const mn = Math.min(99, Math.max(18, Number(r.ageMin) || 18));
            const mx = Math.min(99, Math.max(18, Number(r.ageMax) || 99));
            return mx < mn ? mn : mx;
          })(),
          lodgingType: r.lodgingType ?? "private_room",
          availableFrom: (r.availableFrom ?? isoDateInMexicoCity()).slice(0, 10),
          minimalStayMonths: r.minimalStayMonths ?? 1,
          roomDimension: r.roomDimension ?? "medium",
          photos: hydrateDraftImagesFromUrls(r.photos ?? r.imageUrls ?? []),
        }),
        )
      : [defaultRoom()];

  let propertyTags: ListingTag[] = [];
  if (srvRooms.length > 0) {
    const split = splitHydratedPropertyAndRoomTags(roomDrafts.map((rd) => ({ tags: rd.tags })));
    propertyTags = split.propertyTags;
    roomDrafts = roomDrafts.map((rd, i) => ({
      ...rd,
      tags: split.perRoomTags[i] ?? [],
    }));
  }

  const draft: Draft = {
    ...defaultDraft(),
    postMode: p.postMode === "room" ? "room" : "property",
    city,
    propertyTitle: p.title,
    neighborhood: p.neighborhood,
    contactWhatsApp:
      p.showWhatsApp === false || /^0+$/.test(String(p.contactWhatsApp ?? "").replace(/\D/g, ""))
        ? ""
        : p.contactWhatsApp || "",
    propertySummary:
      p.status === "draft" && isDefaultPropertySummarySeed(p.summary) ? "" : p.summary?.trim() ? p.summary : "",
    propertyKind: p.propertyKind ?? "house",
    propertyBedroomsTotal:
      p.propertyKind === "loft"
        ? 1
        : Math.max(
            1,
            Math.min(
              PROPERTY_BEDROOMS_MAX,
              Number.isFinite(Number(p.bedroomsTotal)) ? Math.floor(Number(p.bedroomsTotal)) : 1,
            ),
          ),
    propertyBathrooms: p.bathrooms,
    occupiedByWomenCount:
      p.occupiedByWomenCount != null && Number.isFinite(Number(p.occupiedByWomenCount))
        ? Math.max(0, Math.floor(Number(p.occupiedByWomenCount)))
        : 0,
    occupiedByMenCount:
      p.occupiedByMenCount != null && Number.isFinite(Number(p.occupiedByMenCount))
        ? Math.max(0, Math.floor(Number(p.occupiedByMenCount)))
        : 0,
    showWhatsApp: p.showWhatsApp,
    useCustomMapPin: usePin,
    customLat: usePin ? String(p.lat) : "",
    customLng: usePin ? String(p.lng) : "",
    propertyImageUrls: hydrateDraftImagesFromUrls(p.commonAreaPhotos ?? p.imageUrls ?? []),
    commonAreaPhotos: hydrateDraftImagesFromUrls(p.commonAreaPhotos ?? p.imageUrls ?? []),
    unassignedImageUrls: [],
    roomImageUrls:
      srvRooms.length > 0
        ? srvRooms.map((r) => hydrateDraftImagesFromUrls(r.photos ?? r.imageUrls ?? []))
        : [[]],
    propertyTags,
    rooms: roomDrafts,
    legalAccepted:
      p.status === "published" || p.status === "paused",
    isApproximateLocation: Boolean((p as { isApproximateLocation?: unknown }).isApproximateLocation),
    ...(p.streetViewPov ? { streetViewPov: p.streetViewPov } : {}),
  };
  return {
    draft: normalizePersistedDraft(draft),
    serverSync:
      srvRooms.length > 0
        ? { propertyId: p.id, roomIds: srvRooms.map((r) => r.id) }
        : { propertyId: p.id, roomIds: [] },
  };
}

/** Drop old per-browser wizard caches so a new publication never restores prior fields. */
function clearLegacyWizardDraftStorage(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("bestie-publish-draft-v4:")) toRemove.push(k);
    }
    for (const k of toRemove) localStorage.removeItem(k);
    localStorage.removeItem("bestie-publish-draft-v3");
    localStorage.removeItem("bestie-publish-draft-v2");
  } catch {
    /* ignore */
  }
}

type WizardResumeState = {
  resumeDraft?: Draft;
  resumeServerSync?: PublishWizardServerSync;
  resumeStep?: number;
};

export function PublishWizardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { openAuthModal } = useAuthModal();
  const [searchParams, setSearchParams] = useSearchParams();
  const handoffToken = searchParams.get("handoff");
  const editPropertyId = searchParams.get("edit");
  const editListingId = searchParams.get("room");
  const upgrade = searchParams.get("upgrade") === "1";
  const handoffLock = useRef(false);
  const [handoffBanner, setHandoffBanner] = useState<string | null>(null);
  /** Loaded property was published or paused — save sends PATCH (not publish-bundle). */
  const [editingLiveProperty, setEditingLiveProperty] = useState<{
    status: Extract<ListingStatus, "published" | "paused">;
  } | null>(null);
  const [editBundleReady, setEditBundleReady] = useState(() => !searchParams.get("edit"));
  const [liveEditReturnListingId, setLiveEditReturnListingId] = useState<string | null>(
    () => searchParams.get("room"),
  );
  const apiOn = isListingsApiConfigured();
  const [step, setStep] = useState(0);
  const [expandedPropertyRoomIndex, setExpandedPropertyRoomIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(() => defaultDraft());
  const [serverSync, setServerSync] = useState<ServerSync>(() => ({ propertyId: null, roomIds: [] }));
  const [previewRoomIndex, setPreviewRoomIndex] = useState(0);
  const [publishSuccessRoomId, setPublishSuccessRoomId] = useState<string | null>(null);
  const [submitInFlight, setSubmitInFlight] = useState<"publish" | "draft" | null>(null);
  const [wizardDraftSaveNote, setWizardDraftSaveNote] = useState<"idle" | "saved">("idle");
  const [publishErr, setPublishErr] = useState<string | null>(null);
  const [autosaveNote, setAutosaveNote] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastAutosavedAt, setLastAutosavedAt] = useState<number | null>(null);
  const [showAutosaveToast, setShowAutosaveToast] = useState(false);
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);
  /** Avoid writing default/empty draft to localStorage before per-user hydration (or API bootstrap) finishes. */
  const [storageReady, setStorageReady] = useState(false);
  /** Single reverse-geocode result for the pin; privacy mode derives a shorter label from `address`, same coordinates. */
  const [mapGeocode, setMapGeocode] = useState<{
    displayFull: string;
    address?: NominatimAddress;
    latKey: string;
    lngKey: string;
  } | null>(null);
  /** Monotonic id so stale reverse-geocode responses never commit after a newer drag/coords change. */
  const reverseGeoGenRef = useRef(0);
  /** Tracks autofill from map pin so we can refresh when the pin moves but not overwrite manual edits. */
  const neighborhoodAutofillFromPinRef = useRef<{ latKey: string; value: string } | null>(null);

  const roomLodgingSig = useMemo(
    () => (draft.postMode === "room" ? draft.rooms.map((r) => r.lodgingType).join("|") : ""),
    [draft.postMode, draft.rooms],
  );

  useEffect(() => {
    if (draft.postMode !== "room") return;
    setDraft((d) => {
      if (d.postMode !== "room") return d;
      if (!d.rooms.some((r) => r.lodgingType === "whole_home")) return d;
      return {
        ...d,
        rooms: d.rooms.map((r) =>
          r.lodgingType === "whole_home" ? { ...r, lodgingType: "private_room" as const } : r,
        ),
      };
    });
  }, [draft.postMode, roomLodgingSig]);

  useEffect(() => {
    if (!apiOn) {
      setMe(null);
      return;
    }
    void authMe().then(setMe).catch(() => setMe(null));
  }, [apiOn]);

  useEffect(() => {
    const st = location.state as WizardResumeState | null;
    if (!st?.resumeDraft) return;
    setDraft(normalizePersistedDraft(st.resumeDraft));
    if (st.resumeServerSync) setServerSync(st.resumeServerSync);
    if (typeof st.resumeStep === "number" && Number.isFinite(st.resumeStep)) {
      setStep(Math.max(0, st.resumeStep));
    }
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate]);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const serverSyncRef = useRef(serverSync);
  serverSyncRef.current = serverSync;
  const meRef = useRef(me);
  meRef.current = me;
  const storageReadyRef = useRef(storageReady);
  storageReadyRef.current = storageReady;
  const prevUserIdRef = useRef<string | null>(undefined);
  const didHydrateLocalForUserRef = useRef<string | null>(null);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runAutosaveRef = useRef<() => Promise<ServerSync | null>>(async () => null);

  useEffect(() => {
    if (me === undefined) return;
    if (!me) {
      prevUserIdRef.current = null;
      didHydrateLocalForUserRef.current = null;
      setStorageReady(false);
      setEditingLiveProperty(null);
      setDraft(defaultDraft());
      setServerSync({ propertyId: null, roomIds: [] });
      setStep(0);
      setAutosaveNote("idle");
      setLastAutosavedAt(null);
      setShowAutosaveToast(false);
      return;
    }
    const uid = me.id;
    const prevUid = prevUserIdRef.current;
    if (prevUid != null && prevUid !== uid) {
      didHydrateLocalForUserRef.current = null;
    }
    if (prevUid !== uid) {
      prevUserIdRef.current = uid;
      void authLinkPublisher().catch(() => undefined);
    }
    if (editPropertyId || handoffToken) return;
    if (didHydrateLocalForUserRef.current === uid) return;
    didHydrateLocalForUserRef.current = uid;
    clearLegacyWizardDraftStorage();
    setDraft(defaultDraft());
    setServerSync({ propertyId: null, roomIds: [] });
    setStep(0);
    setAutosaveNote("idle");
    setLastAutosavedAt(null);
    setShowAutosaveToast(false);
    setStorageReady(true);
  }, [me, editPropertyId, handoffToken]);

  useEffect(() => {
    if (!handoffToken) {
      handoffLock.current = false;
      return;
    }
    if (!apiOn || handoffLock.current) return;
    handoffLock.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const { draftPropertyId } = await consumeHandoffToken(handoffToken);
        await authLinkPublisher();
        if (draftPropertyId) {
          const bundle = await fetchPropertyWithRooms(draftPropertyId);
          if (bundle && !cancelled) {
            const mapped = draftFromPropertyBundle(bundle);
            setDraft(mapped.draft);
            setServerSync(mapped.serverSync);
            setHandoffBanner("Tu borrador desde Messenger está cargado.");
          }
        } else if (!cancelled) {
          setHandoffBanner("Sesión de publicación restaurada. Continúa donde la dejaste.");
        }
        if (!cancelled) {
          const session = await authMe();
          if (session?.id) didHydrateLocalForUserRef.current = session.id;
          setStorageReady(true);
          setSearchParams(
            (prev) => {
              const n = new URLSearchParams(prev);
              n.delete("handoff");
              return n;
            },
            { replace: true },
          );
        }
      } catch (e) {
        if (!cancelled) {
          setPublishErr(e instanceof Error ? e.message : "No se pudo abrir el enlace de Messenger.");
          handoffLock.current = false;
          setStorageReady(true);
          setSearchParams(
            (prev) => {
              const n = new URLSearchParams(prev);
              n.delete("handoff");
              return n;
            },
            { replace: true },
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiOn, handoffToken, setSearchParams]);

  useEffect(() => {
    if (!editPropertyId) return;
    if (!apiOn) return;
    setEditBundleReady(false);
    let cancelled = false;
    void (async () => {
      try {
        const bundle = await fetchPropertyWithRooms(editPropertyId);
        if (bundle && !cancelled) {
          const mapped = draftFromPropertyBundle(bundle);
          const ps = bundle.property.status;
          setEditingLiveProperty(
            ps === "published" || ps === "paused" ? { status: ps } : null,
          );
          const nextDraft =
            upgrade && mapped.draft.postMode === "room"
              ? convertRoomDraftToProperty(mapped.draft)
              : mapped.draft;
          setDraft(nextDraft);
          setServerSync(mapped.serverSync);

          const srvRooms = [...bundle.rooms].sort((a, b) => a.sortOrder - b.sortOrder);
          let previewIdx = 0;
          if (editListingId) {
            const found = srvRooms.findIndex((r) => r.id === editListingId);
            if (found >= 0) previewIdx = found;
          }
          setPreviewRoomIndex(previewIdx);
          const returnId =
            (editListingId && srvRooms.some((r) => r.id === editListingId)
              ? editListingId
              : srvRooms[previewIdx]?.id) ?? srvRooms.find((r) => r.status === "published")?.id ?? srvRooms[0]?.id ?? null;
          setLiveEditReturnListingId(returnId);

          if (!upgrade && (ps === "published" || ps === "paused")) {
            setStep(publishWizardLastStepIndex(nextDraft.postMode));
          } else {
            setStep(resumeStepForDraft(nextDraft, { upgrade }));
          }

          if (upgrade && mapped.draft.postMode === "room") {
            setHandoffBanner(
              "Borrador cargado como propiedad con múltiples cuartos. Completa la información faltante para agregar cuartos y publicar.",
            );
          } else if (ps === "published" || ps === "paused") {
            setHandoffBanner(
              ps === "paused"
                ? "Anuncio en pausa. Edita por sección y usa “Guardar y republicar” para volver a activarlo en búsqueda."
                : null,
            );
          } else {
            setHandoffBanner("Borrador cargado para editar.");
          }
          const session = await authMe();
          if (session?.id) didHydrateLocalForUserRef.current = session.id;
        }
      } catch (e) {
        if (!cancelled) {
          setEditingLiveProperty(null);
          setPublishErr(e instanceof Error ? e.message : "No se pudo cargar el borrador.");
        }
      } finally {
        if (!cancelled) {
          setEditBundleReady(true);
          setStorageReady(true);
          setSearchParams(
            (prev) => {
              const n = new URLSearchParams(prev);
              n.delete("edit");
              n.delete("upgrade");
              n.delete("room");
              return n;
            },
            { replace: true },
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiOn, editPropertyId, editListingId, upgrade, setSearchParams]);

  /** Drop any stale reverse-geocode label; the UI shows a coordinate fallback until Nominatim returns. */
  useLayoutEffect(() => {
    if (!draft.useCustomMapPin) return;
    setMapGeocode(null);
  }, [draft.city, draft.customLat, draft.customLng, draft.useCustomMapPin]);

  useEffect(() => {
    if (!draft.useCustomMapPin) {
      reverseGeoGenRef.current += 1;
      setMapGeocode(null);
      return;
    }
    const { lat, lng } = resolveLatLngForDraft(draft);
    const latKey = lat.toFixed(6);
    const lngKey = lng.toFixed(6);
    const requestId = ++reverseGeoGenRef.current;
    const ac = new AbortController();
    const REVERSE_DEBOUNCE_MS = 180;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
            {
              signal: ac.signal,
              headers: { "User-Agent": "bestie.mx-publish-wizard" },
            },
          );
          if (requestId !== reverseGeoGenRef.current) return;
          if (res.ok) {
            const data = (await res.json()) as {
              display_name?: string;
              address?: NominatimAddress;
            };
            if (requestId !== reverseGeoGenRef.current) return;
            const displayFull = (data.display_name ?? "").trim() || "Dirección aproximada";
            setMapGeocode({ displayFull, address: data.address, latKey, lngKey });
          } else if (requestId === reverseGeoGenRef.current) {
            setMapGeocode({ displayFull: "Ubicación aproximada", latKey, lngKey });
          }
        } catch (e) {
          if (ac.signal.aborted) return;
          if (requestId !== reverseGeoGenRef.current) return;
          setMapGeocode({ displayFull: "Ubicación aproximada", latKey, lngKey });
        }
      })();
    }, REVERSE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [draft.city, draft.customLat, draft.customLng, draft.useCustomMapPin]);

  useEffect(() => {
    if (!draft.useCustomMapPin || !mapGeocode?.address) return;
    const latKey = mapGeocode.latKey;
    const next = neighborhoodFromNominatimAddress(mapGeocode.address).trim();
    if (!next) return;

    setDraft((d) => {
      const cur = d.neighborhood.trim();
      const auto = neighborhoodAutofillFromPinRef.current;
      const shouldApply = cur === "" || (auto !== null && cur === auto.value);
      if (!shouldApply) return d;

      neighborhoodAutofillFromPinRef.current = { latKey, value: next };
      if (d.neighborhood === next) return d;
      return { ...d, neighborhood: next };
    });
  }, [draft.useCustomMapPin, mapGeocode?.latKey, mapGeocode?.lngKey, mapGeocode?.address]);

  const mapAddressShown = useMemo(() => {
    if (!draft.useCustomMapPin) return null;
    const anchor = CITY_ANCHOR[draft.city];
    const nbh = draft.neighborhood.trim() || anchor.neighborhood;
    const { lat, lng } = resolveLatLngForDraft(draft);
    const latKey = lat.toFixed(6);
    const lngKey = lng.toFixed(6);
    const hasValidCustomCoords =
      Number.isFinite(Number(String(draft.customLat).replace(",", "."))) &&
      Number.isFinite(Number(String(draft.customLng).replace(",", ".")));

    if (!hasValidCustomCoords) return null;

    if (!mapGeocode || mapGeocode.latKey !== latKey || mapGeocode.lngKey !== lngKey) return null;

    if (draft.isApproximateLocation) {
      return privacyLocationFromNominatim(mapGeocode.address, nbh, draft.city);
    }
    return mapGeocode.displayFull;
  }, [
    draft.city,
    draft.isApproximateLocation,
    draft.neighborhood,
    draft.useCustomMapPin,
    mapGeocode,
    resolveLatLngForDraft,
    draft.customLat,
    draft.customLng,
  ]);

  runAutosaveRef.current = async (): Promise<ServerSync | null> => {
    if (!isListingsApiConfigured()) return null;
    if (!meRef.current?.id || !storageReadyRef.current) {
      setAutosaveNote("idle");
      return null;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setAutosaveNote("idle");
      return null;
    }
    const d = draftRef.current;
    if (isFreshDefaultDraft(d) || !wizardHasMinimumFieldsForAutosave(d)) {
      setAutosaveNote("idle");
      return null;
    }

    try {
      setAutosaveNote("saving");
      const synced = await syncDraftToServer(d, serverSyncRef.current, meRef.current?.phoneE164);
      serverSyncRef.current = synced.serverSync;
      setServerSync(synced.serverSync);
      setDraft(synced.draft);
      setAutosaveNote("saved");
      setLastAutosavedAt(Date.now());
      window.setTimeout(() => {
        setAutosaveNote((n) => (n === "saved" ? "idle" : n));
      }, 2000);
      return synced.serverSync;
    } catch {
      setAutosaveNote("error");
      return null;
    }
  };

  const flushWizardAutosave = useCallback(async (): Promise<ServerSync | null> => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (!apiOn) return serverSyncRef.current.propertyId ? serverSyncRef.current : null;
    if (isFreshDefaultDraft(draftRef.current)) {
      return serverSyncRef.current.propertyId ? serverSyncRef.current : null;
    }
    const out = await runAutosaveRef.current();
    return out ?? (serverSyncRef.current.propertyId ? serverSyncRef.current : null);
  }, [apiOn]);

  useEffect(() => {
    if (!apiOn || !storageReady) return;
    if (!meRef.current?.id) return;
    if (isFreshDefaultDraft(draftRef.current)) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      void runAutosaveRef.current();
    }, 900);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [draft, apiOn, me?.id, storageReady]);

  useEffect(() => {
    if (!apiOn || !me) return;
    if (autosaveNote !== "saved") return;
    setShowAutosaveToast(true);
    if (autosaveToastTimerRef.current) {
      clearTimeout(autosaveToastTimerRef.current);
    }
    autosaveToastTimerRef.current = setTimeout(() => {
      setShowAutosaveToast(false);
      autosaveToastTimerRef.current = null;
    }, 2600);
    return () => {
      if (autosaveToastTimerRef.current) {
        clearTimeout(autosaveToastTimerRef.current);
      }
    };
  }, [autosaveNote, apiOn, me]);

  function updateRoom(i: number, patch: Partial<RoomDraft>) {
    setDraft((d) => ({
      ...d,
      rooms: d.rooms.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    }));
  }

  function setPropertyRentRoomCount(count: number) {
    setDraft((draft) => applyPropertyRentRoomCount(draft, count, defaultRoom));
  }

  function setPropertyBedroomTotal(count: number) {
    const d = draftRef.current;
    const prevTotal = d.rooms.length;
    const nextTotal = Math.max(1, Math.min(PROPERTY_BEDROOMS_MAX, Math.floor(count)));
    setDraft((draft) => {
      const synced = syncPropertyRoomSlotsToTotal(
        { ...draft, propertyBedroomsTotal: nextTotal },
        defaultRoom,
      );
      const rentCount = Math.min(propertyRentRoomCount(synced), synced.rooms.length);
      return applyPropertyRentRoomCount(synced, rentCount, defaultRoom);
    });
    if (nextTotal >= prevTotal) {
      setServerSync((s) => {
        const roomIds = [...s.roomIds];
        while (roomIds.length < nextTotal) roomIds.push("");
        return { ...s, roomIds: roomIds.slice(0, nextTotal) };
      });
      return;
    }
    const pid = serverSyncRef.current.propertyId;
    if (apiOn && pid) {
      for (let i = nextTotal; i < prevTotal; i++) {
        const rid = serverSyncRef.current.roomIds[i];
        if (rid) void deleteDraftRoom(pid, rid).catch(() => undefined);
      }
    }
    setServerSync((s) => ({ ...s, roomIds: s.roomIds.slice(0, nextTotal) }));
  }

  function addRoom() {
    if (draftRef.current.postMode === "room") return;
    setDraft((d) => ({
      ...d,
      rooms: [...d.rooms, defaultRoom()],
      roomImageUrls: [...d.roomImageUrls, []],
    }));
    setServerSync((s) => (s.propertyId ? { ...s, roomIds: [...s.roomIds, ""] } : s));
  }

  function removeRoom(i: number) {
    if (draftRef.current.postMode === "room") return;
    const pid = serverSyncRef.current.propertyId;
    const rid = serverSyncRef.current.roomIds[i] || draftRef.current.rooms[i]?.id;
    if (apiOn && pid && rid) {
      void deleteDraftRoom(pid, rid).catch(() => undefined);
    }
    setServerSync((s) => ({
      ...s,
      roomIds: s.roomIds.filter((_, j) => j !== i),
    }));
    setDraft((d) => ({
      ...d,
      rooms: d.rooms.length <= 1 ? d.rooms : d.rooms.filter((_, j) => j !== i),
      roomImageUrls:
        d.rooms.length <= 1 ? d.roomImageUrls : d.roomImageUrls.filter((_, j) => j !== i),
    }));
  }

  const steps = useMemo(
    () => [
      {
        title: "¿Qué tipo de espacio deseas publicar?",
        body: (
          <form className="space-y-6">
            <div className="rounded-xl border border-border bg-bg-light p-4 px-5 shadow-sm space-y-4">
              <h3 className="text-[15px] font-bold text-primary">Tipo de espacio</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      postMode: "room",
                      rooms: [{ ...defaultRoom(), title: SINGLE_ROOM_DEFAULT_TITLE }],
                      roomImageUrls: [d.roomImageUrls[0] ?? []],
                      propertySummary: "",
                      ...(d.propertyKind === "loft"
                        ? { propertyBedroomsTotal: 1 }
                        : {
                            propertyBedroomsTotal: Math.max(
                              1,
                              Math.min(
                                PROPERTY_BEDROOMS_MAX,
                                Number.isFinite(d.propertyBedroomsTotal) ? d.propertyBedroomsTotal : 1,
                              ),
                            ),
                          }),
                    }))
                  }
                  className={`rounded-2xl border-2 px-4 py-5 text-left transition ${
                    draft.postMode === "room"
                      ? "border-secondary bg-secondary/10 ring-2 ring-secondary/40"
                      : "border-border bg-surface hover:bg-surface-elevated"
                  }`}
                >
                  <div className="text-base font-bold text-primary">Un cuarto o Loft</div>
                  <p className="mt-2 text-xs text-muted">
                    Publica un cuarto o Loft de forma rápida y sencilla. Ideal para la búsqueda ocasional de un roomie.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDraft((d) => {
                      if (d.postMode === "property") return d;
                      return applyPropertyRentRoomCount(
                        syncPropertyRoomSlotsToTotal(
                          { ...d, postMode: "property", rooms: [defaultRoom()], roomImageUrls: [[]] },
                          defaultRoom,
                        ),
                        1,
                        defaultRoom,
                      );
                    })
                  }
                  className={`rounded-2xl border-2 px-4 py-5 text-left transition ${
                    draft.postMode === "property"
                      ? "border-secondary bg-secondary/10 ring-2 ring-secondary/40"
                      : "border-border bg-surface hover:bg-surface-elevated"
                  }`}
                >
                  <div className="text-base font-bold text-primary">Propiedad con múltiples cuartos</div>
                  <p className="mt-2 text-xs text-muted">
                    Publica varios cuartos dentro de una misma propiedad, separa fotografías por cuarto o áreas comunes.
                    Ideal para viviendas con muchos roomies o alta rotación.
                  </p>
                </button>
              </div>
              <p className="text-xs text-muted">
                <strong className="font-semibold text-body">Tip</strong>: Puedes cambiar el tipo de espacio de
                &quot;Cuarto&quot; a &quot;Propiedad&quot; incluso después de haber publicado tu anuncio.
              </p>
            </div>
          </form>
        ),
      },
      {
        title: "¿Dónde se ubica el espacio?",
        body: (
          <form className="space-y-6">
            <div className="rounded-xl border border-border bg-bg-light p-4 px-5 shadow-sm space-y-4">
              <h3 id="publish-step-city-heading" className="text-[15px] font-bold text-primary">
                Ciudad
              </h3>
              <div className="block text-sm font-medium text-body">
                <span className="mb-2 block text-xs text-muted">
                  Selecciona la ciudad donde se encuentra el espacio.
                </span>
                <select
                  aria-labelledby="publish-step-city-heading"
                  value={draft.city}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, city: e.target.value as Draft["city"] }))
                  }
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
                >
                  {CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-bg-light p-4 px-5 shadow-sm space-y-4">
              <h3 className="text-[15px] font-bold text-primary">
                Dirección en Mapa
              </h3>
              <div>
                <p className="text-sm font-medium text-body">
                  Arrastra el marcador para colocar la ubicación.
                  <span className="text-red-600"> *</span>
                </p>
                <div className="mt-3">
                  <WizardLocationMap
                    key={draft.city}
                    center={[CITY_ANCHOR[draft.city].lat, CITY_ANCHOR[draft.city].lng]}
                    position={(() => {
                      const { lat, lng } = resolveLatLngForDraft(draft);
                      return [lat, lng] as [number, number];
                    })()}
                    hasDefinedLocation={draft.useCustomMapPin}
                    locationLabel={mapAddressShown}
                    onPositionChange={(lat, lng) => {
                      setDraft((d) => ({
                        ...d,
                        useCustomMapPin: true,
                        customLat: lat.toFixed(7),
                        customLng: lng.toFixed(7),
                        streetViewPov: undefined,
                      }));
                    }}
                    showApproximateRadius={draft.isApproximateLocation}
                    approximateRadiusMeters={WIZARD_APPROXIMATE_RADIUS_M}
                  />
                </div>

                <h3 className="mt-4 text-sm font-bold text-primary border-b border-border pb-1">
                  Nivel de privacidad
                </h3>
                <label className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3 cursor-pointer transition hover:bg-surface-elevated">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-secondary focus:outline-none focus:ring-2 focus:ring-border focus:ring-offset-0"
                    checked={draft.isApproximateLocation}
                    onChange={(e) => {
                      const hideExact = e.target.checked;
                      setDraft((d) => ({
                        ...d,
                        isApproximateLocation: hideExact,
                        ...(hideExact ? { streetViewPov: undefined } : {}),
                      }));
                    }}
                  />
                  <div>
                    <span className="block text-sm font-semibold text-primary">
                      Ocultar dirección exacta en el anuncio
                    </span>
                    <span className="block text-xs text-muted">
                      Para proteger tu dirección exacta, el marcador aparecerá en un punto aleatorio dentro de un radio
                      aproximado de 200 metros de la ubicación real.
                    </span>
                  </div>
                </label>

                {draft.isApproximateLocation ? (
                  <p className="rounded-lg border border-border bg-surface-elevated p-3 text-xs text-muted transition-opacity duration-200">
                    Para proteger tu privacidad, la dirección que aparece arriba está simplificada. Además, el mapa de
                    búsqueda mostrará un pin con una ubicación aleatoria dentro del perímetro mostrado en el mapa.
                  </p>
                ) : null}

                {!draft.isApproximateLocation && draft.useCustomMapPin ? (() => {
                  const { lat, lng } = resolveLatLngForDraft(draft);
                  return (
                    <div className="transition-opacity duration-200">
                      <h3 className="mt-8 mb-3 text-lg font-semibold text-gray-900">
                        Vista de la propiedad
                      </h3>
                      <StreetViewPovEditor
                        lat={lat}
                        lng={lng}
                        pov={draft.streetViewPov}
                        onPovChange={(streetViewPov) =>
                          setDraft((d) => ({ ...d, streetViewPov }))
                        }
                      />
                      <p className="mt-2 text-sm text-gray-800">
                        <span className="font-bold">TIP:</span> Gira la cámara para que apunte a la fachada de tu
                        propiedad. Esta toma exacta será la que se mostrará en tu anuncio público.
                      </p>
                    </div>
                  );
                })() : null}
              </div>
            </div>
          </form>
        ),
      },
      {
        title: "¿Cómo es tu espacio?",
        body: (
          <form className="space-y-6">
            {draft.postMode === "property" ? (
              <p className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm leading-snug text-body">
                <strong className="text-primary">Solo propiedad y áreas comunes.</strong> En este paso describe la
                vivienda en general — sala, cocina, jardín, convivencia, etc. — y sube fotos de espacios compartidos.{" "}
                <strong className="text-body">No incluyas detalles ni fotos por habitación</strong>; cada recámara se
                completa en el siguiente paso.
              </p>
            ) : null}
            <div className="rounded-xl border border-border bg-bg-light p-4 px-5 shadow-sm space-y-4">
              <h3 className="text-[15px] font-bold text-primary">
                Datos Generales
              </h3>
              {draft.postMode === "property" ? (
                <p className="text-xs text-muted leading-snug">
                  Título, ubicación y descripción general de la propiedad. Las recámaras se configuran en el paso 4.
                </p>
              ) : null}
              <label className="block text-sm font-medium text-body">
                Título del anuncio
                <span className="text-red-600"> *</span>
                <input
                  value={draft.propertyTitle}
                  onChange={(e) => setDraft((d) => ({ ...d, propertyTitle: e.target.value }))}
                  maxLength={PROPERTY_TITLE_MAX}
                  placeholder="Ej. Casa compartida Chapalita / Depa zona Minerva"
                  className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
                />
                <span className="mt-1 block text-right text-[10px] text-muted">
                  {draft.propertyTitle.trim().length} / {PROPERTY_TITLE_MAX}
                </span>
              </label>
              <label className="block text-sm font-medium text-body">
                Colonia o zona
                <span className="text-red-600"> *</span>
                <input
                  value={draft.neighborhood}
                  onChange={(e) => setDraft((d) => ({ ...d, neighborhood: e.target.value }))}
                  maxLength={PROPERTY_NEIGHBORHOOD_MAX}
                  placeholder="Ej. Chapultepec, Versalles…"
                  className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
                />
              </label>
              {draft.postMode === "property" ? (
                <>
                  <label className="block text-sm font-medium text-body">
                    El ambiente y las áreas comunes
                    <span className="text-red-600"> *</span>
                    <textarea
                      value={draft.propertySummary}
                      onChange={(e) => setDraft((d) => ({ ...d, propertySummary: e.target.value }))}
                      rows={5}
                      maxLength={PROPERTY_SUMMARY_MAX}
                      placeholder={DEFAULT_PROPERTY_SUMMARY}
                      className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
                    />
                    <span className="mt-1 block text-xs text-muted">
                      Mínimo {PROPERTY_SUMMARY_MIN} caracteres · Solo convivencia y zonas compartidas (cada recámara
                      se describe en el paso 4) · {draft.propertySummary.trim().length} ahora
                    </span>
                  </label>

                  <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                    <div className="mb-4 border-l-4 border-blue-500 bg-blue-50 p-4 text-sm leading-snug text-body">
                      🚨 <strong>Solo áreas compartidas.</strong> Sube aquí fotos de la sala, cocina, baños
                      compartidos y exteriores. Te pediremos las fotos específicas de cada recámara en el siguiente paso.
                    </div>
                    <BulkImageUploader
                      title="Fotos de áreas comunes"
                      images={draft.commonAreaPhotos}
                      maxCount={40}
                      apiOn={apiOn}
                      hint="Sala, cocina, baños compartidos, lavandería, estacionamiento, fachada y jardín."
                      onImagesChange={(next) =>
                        setDraft((d) => ({
                          ...d,
                          commonAreaPhotos: next,
                          propertyImageUrls: next,
                        }))
                      }
                    />
                  </div>
                </>
              ) : null}
            </div>

            <div className="rounded-xl border border-border bg-bg-light p-4 px-5 shadow-sm space-y-4">
              <h3 className="text-[15px] font-bold text-primary">
                Detalles de la propiedad
              </h3>
              <label className="block text-sm font-medium text-body">
                Tipo de vivienda
                <span className="text-red-600"> *</span>
                <select
                  value={draft.propertyKind}
                  onChange={(e) => {
                    const kind = e.target.value as PropertyKind;
                    setDraft((d) => ({
                      ...d,
                      propertyKind: kind,
                      ...(kind === "loft" ? { propertyBedroomsTotal: 1 } : {}),
                    }));
                  }}
                  className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
                >
                  <option value="house">Casa</option>
                  <option value="apartment">Departamento</option>
                  <option value="loft">Loft</option>
                </select>
              </label>
              {draft.propertyKind === "loft" ? (
                <p className="text-xs text-muted leading-relaxed">
                  <strong className="text-body">Tip</strong>
                  : Un loft es una propiedad completa de un solo cuarto, donde áreas como la sala, el comedor o la cocina
                  no se cuentan como habitaciones independientes.
                </p>
              ) : null}
              {draft.postMode === "room" ? (
              <div
                className={`grid gap-4 ${showWizardPropertyBathroomsField(draft) ? "sm:grid-cols-2" : ""}`}
              >
                <div className="block text-sm font-medium text-body">
                  <span className="block">
                    ¿Cuántas recámaras tiene la propiedad?
                    <span className="text-red-600"> *</span>
                  </span>
                  <WizardNumberStepper
                    value={
                      draft.propertyKind === "loft"
                        ? 1
                        : Math.min(
                            PROPERTY_BEDROOMS_MAX,
                            Math.max(1, draft.propertyBedroomsTotal),
                          )
                    }
                    min={1}
                    max={PROPERTY_BEDROOMS_MAX}
                    disabled={draft.propertyKind === "loft"}
                    onChange={(n) => setPropertyBedroomTotal(n)}
                    decrementLabel="Menos recámaras"
                    incrementLabel="Más recámaras"
                  />
                  <span className="mt-1 block text-xs text-muted">
                    Incluye recámaras habitadas + disponibles
                  </span>
                </div>
                {showWizardPropertyBathroomsField(draft) ? (
                  <div>
                    <label className="block text-sm font-medium text-body">
                      {draft.propertyKind === "loft" ? "Baños" : "Baños (total)"}
                      <span className="text-red-600"> *</span>
                      <input
                        type="number"
                        min={0}
                        max={PROPERTY_BATHROOMS_MAX}
                        step={0.5}
                        value={draft.propertyBathrooms === 0 ? "" : draft.propertyBathrooms}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            propertyBathrooms: Math.min(
                              PROPERTY_BATHROOMS_MAX,
                              Math.max(0, Math.round(Number(e.target.value) * 2) / 2 || 0),
                            ),
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
                      />
                    </label>
                  </div>
                ) : null}
              </div>
              ) : null}
              <div className="mt-4 space-y-4 border-t border-border pt-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-body">La propiedad cuenta con:</label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {WIZARD_PROPERTY_AMENITY_SLUGS.map((tag) => {
                      const active = draft.propertyTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          role="checkbox"
                          aria-checked={active}
                          onClick={() => setDraft((d) => togglePropertyTag(d, tag))}
                          className={`rounded-full px-3 py-2 text-left text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-0 ${
                            active
                              ? "bg-primary text-primary-fg shadow-sm ring-1 ring-primary/20"
                              : "border border-border bg-surface text-body shadow-sm hover:bg-surface-elevated"
                          }`}
                        >
                          {TAG_LABELS[tag]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-body">Se permite:</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {WIZARD_PROPERTY_PERMITIDO_SLUGS.map((tag) => {
                      const active = draft.propertyTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          role="checkbox"
                          aria-checked={active}
                          onClick={() => setDraft((d) => togglePropertyTag(d, tag))}
                          className={`rounded-full px-3 py-2 text-left text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-0 ${
                            active
                              ? "bg-primary text-primary-fg shadow-sm ring-1 ring-primary/20"
                              : "border border-border bg-surface text-body shadow-sm hover:bg-surface-elevated"
                          }`}
                        >
                          {TAG_LABELS[tag]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </form>
        ),
      },
      {
        title: draft.postMode === "property" ? "Administrador de recámaras" : "Recámaras",
        body:
          draft.postMode === "property" ? (
            <PropertyRoomManager
              draft={draft}
              propertyKind={draft.propertyKind}
              propertyBedroomsTotal={draft.propertyBedroomsTotal}
              propertyBedroomsMax={PROPERTY_BEDROOMS_MAX}
              onBedroomTotalChange={setPropertyBedroomTotal}
              expandedRoomIndex={expandedPropertyRoomIndex}
              onExpandedRoomIndexChange={setExpandedPropertyRoomIndex}
              preferOccupiedFirst={!editPropertyId && !editingLiveProperty}
              onRentRoomCountChange={setPropertyRentRoomCount}
              onOccupancyStatusChange={(roomIndex, status) =>
                setDraft((d) => ({
                  ...d,
                  rooms: d.rooms.map((room, i) =>
                    i === roomIndex ? { ...room, occupancyStatus: status } : room,
                  ),
                }))
              }
              onUpdateRoom={updateRoom}
              onRoomPhotosChange={(roomIndex, photos) =>
                setDraft((d) =>
                  syncDraftPhotoFields({
                    ...d,
                    rooms: d.rooms.map((room, i) => (i === roomIndex ? { ...room, photos } : room)),
                  }),
                )
              }
              onToggleTag={(roomIndex, tag, active) =>
                setDraft((d) => toggleRoomTag(d, roomIndex, tag, active))
              }
              onSaveProgress={() => void submitWizardProgressDraft()}
              saveProgressInFlight={submitInFlight === "draft"}
              saveProgressSaved={wizardDraftSaveNote === "saved"}
              showSaveProgress={apiOn}
              apiOn={apiOn}
            />
          ) : (
          <div className="space-y-6">
            {draft.rooms.map((room, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-bg-light p-4 shadow-md ring-1 ring-primary/10"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Recámara {i + 1}
                  </p>
                  {draft.rooms.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeRoom(i)}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Quitar
                    </button>
                  ) : null}
                </div>
                <div className="mt-2 rounded-xl border border-border bg-surface p-4 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-primary">
                    Información principal
                  </h3>
                  {draft.postMode === "property" ? (
                    <label className="block text-sm font-medium text-body">
                      Título del espacio
                      <span className="text-red-600"> *</span>
                      <input
                        value={room.title}
                        onChange={(e) => updateRoom(i, { title: e.target.value })}
                        placeholder={roomTitlePlaceholder(room)}
                        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                      />
                    </label>
                  ) : null}
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-body">
                      {draft.postMode === "room" ? "Tipo de recámara" : "Tipo de espacio"}
                      <span className="text-red-600"> *</span>
                      <select
                        value={
                          draft.postMode === "room" && room.lodgingType === "whole_home"
                            ? "private_room"
                            : room.lodgingType
                        }
                        onChange={(e) =>
                          updateRoom(i, { lodgingType: e.target.value as LodgingType })
                        }
                        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                      >
                        {draft.postMode === "room" ? (
                          <>
                            <option value="private_room">Recámara privada</option>
                            <option value="shared_room">Recámara compartida</option>
                          </>
                        ) : (
                          <>
                            <option value="private_room">Recámara privada</option>
                            <option value="shared_room">Recámara compartida</option>
                            <option value="whole_home">Vivienda completa</option>
                          </>
                        )}
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-body">
                      Tamaño de la recámara
                      <span className="text-red-600"> *</span>
                      <select
                        value={room.roomDimension}
                        onChange={(e) =>
                          updateRoom(i, { roomDimension: e.target.value as RoomDimension })
                        }
                        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                      >
                        {draft.postMode === "room" ? (
                          <>
                            <option value="small">Individual (Cabe cama individual + buró)</option>
                            <option value="medium">
                              Matrimonial (Cabe cama matrimonial + escritorio)
                            </option>
                            <option value="large">Grande (Cabe cama Queen/King + área de estar)</option>
                          </>
                        ) : (
                          <>
                            <option value="small">Pequeño</option>
                            <option value="medium">Mediano</option>
                            <option value="large">Grande</option>
                          </>
                        )}
                      </select>
                    </label>
                    <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-body">
                          Renta (MXN / mes)
                          <span className="text-red-600"> *</span>
                          <input
                            type="number"
                            min={0}
                            step={100}
                            value={room.rentMxn === 0 ? "" : room.rentMxn}
                            onChange={(e) =>
                              updateRoom(i, { rentMxn: Math.max(0, Number(e.target.value) || 0) })
                            }
                            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                          />
                        </label>
                        <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-elevated/50 px-3 py-2.5 text-body">
                          <input
                            type="checkbox"
                            checked={room.rentIncludesUtilities}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              updateRoom(i, { rentIncludesUtilities: checked });
                            }}
                            className="mt-0.5 size-4 shrink-0 rounded border-border text-primary"
                          />
                          <span>
                            <span className="block text-sm font-medium text-body">
                              Servicios básicos incluidos
                            </span>
                            <span className="mt-0.5 block text-xs text-muted leading-snug">
                              Activa esta opción si el precio de renta ya cubre luz, agua, gas e internet (Wi-Fi).
                            </span>
                          </span>
                        </label>
                      </div>
                      <label className="block text-sm font-medium text-body">
                        Depósito (MXN)
                        <span className="text-red-600"> *</span>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={room.depositMxn === 0 ? "" : room.depositMxn}
                          onChange={(e) =>
                            updateRoom(i, { depositMxn: Math.max(0, Number(e.target.value) || 0) })
                          }
                          placeholder="0"
                          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-border bg-surface p-4 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-primary">
                    Disponibilidad
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {draft.postMode === "property" ? (
                      <div className="block text-sm font-medium text-body">
                        <span className="block">
                          Plazas / espacios
                          <span className="text-red-600"> *</span>
                        </span>
                        <WizardNumberStepper
                          value={Math.min(ROOM_PLAZAS_MAX, Math.max(1, room.roomsAvailable))}
                          min={1}
                          max={ROOM_PLAZAS_MAX}
                          onChange={(n) => updateRoom(i, { roomsAvailable: n })}
                          decrementLabel="Menos plazas"
                          incrementLabel="Más plazas"
                        />
                      </div>
                    ) : null}
                    <label className="block text-sm font-medium text-body">
                      Disponible desde
                      <span className="text-red-600"> *</span>
                      <input
                        type="date"
                        value={room.availableFrom}
                        onChange={(e) => updateRoom(i, { availableFrom: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                      />
                    </label>
                    <div className="block text-sm font-medium text-body">
                      <span className="block">
                        Estancia mín. (meses)
                        <span className="text-red-600"> *</span>
                      </span>
                      <WizardNumberStepper
                        editableCenter
                        maxInputDigits={2}
                        value={Math.min(
                          ROOM_STAY_MAX,
                          Math.max(0, room.minimalStayMonths),
                        )}
                        min={0}
                        max={ROOM_STAY_MAX}
                        onChange={(n) => updateRoom(i, { minimalStayMonths: n })}
                        decrementLabel="Menos meses"
                        incrementLabel="Más meses"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-border bg-surface p-4 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-primary">
                    Perfil buscado
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block text-sm font-medium text-body">
                      {ROOMMATE_GENDER_PREF_FIELD_LABEL}
                      <span className="text-red-600"> *</span>
                      <select
                        value={room.roommateGenderPref}
                        onChange={(e) =>
                          updateRoom(i, {
                            roommateGenderPref: e.target.value as RoommateGenderPref,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                      >
                        <option value="any">Sin preferencia</option>
                        <option value="female">Mujeres</option>
                        <option value="male">Hombres</option>
                      </select>
                    </label>
                    <div className="block text-sm font-medium text-body">
                      <span className="block">
                        Edad mín.
                        <span className="text-red-600"> *</span>
                      </span>
                      <WizardNumberStepper
                        editableCenter
                        maxInputDigits={2}
                        value={Math.min(99, Math.max(18, room.ageMin))}
                        min={18}
                        max={99}
                        onChange={(n) =>
                          updateRoom(i, {
                            ageMin: n,
                            ageMax: room.ageMax < n ? n : room.ageMax,
                          })
                        }
                        decrementLabel="Menor edad mínima"
                        incrementLabel="Mayor edad mínima"
                      />
                    </div>
                    <div className="block text-sm font-medium text-body">
                      <span className="block">
                        Edad máx.
                        <span className="text-red-600"> *</span>
                      </span>
                      <WizardNumberStepper
                        editableCenter
                        maxInputDigits={2}
                        value={Math.min(99, Math.max(18, room.ageMax))}
                        min={18}
                        max={99}
                        onChange={(n) =>
                          updateRoom(i, {
                            ageMax: n,
                            ageMin: room.ageMin > n ? n : room.ageMin,
                          })
                        }
                        decrementLabel="Menor edad máxima"
                        incrementLabel="Mayor edad máxima"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-border bg-surface p-4 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-primary">
                    Detalles de la recámara
                  </h3>
                  <label className="block text-sm font-medium text-body">
                    Descripción de la recámara
                    <span className="text-red-600"> *</span>
                    <textarea
                      value={room.summary}
                      onChange={(e) => updateRoom(i, { summary: e.target.value })}
                      rows={3}
                      maxLength={ROOM_SUMMARY_MAX}
                      placeholder={ROOM_SUMMARY_PLACEHOLDER}
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                    />
                    <span
                      className={`mt-1 block text-xs ${
                        room.summary.trim().length < ROOM_SUMMARY_MIN ? "text-amber-700" : "text-muted"
                      }`}
                    >
                      {room.summary.trim().length}/{ROOM_SUMMARY_MIN}
                    </span>
                  </label>
                  <div className="mt-3 space-y-4">
                    {WIZARD_ROOM_TAG_GROUPS.map((group) => (
                      <div key={group.title}>
                        <p className="text-sm font-medium text-body">
                          {group.title}
                          {group.title === "Ideal para" ? (
                            <span className="text-red-600"> *</span>
                          ) : null}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {group.tags.map((tag) => {
                            const active = room.tags.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                role="checkbox"
                                aria-checked={active}
                                onClick={() => setDraft((d) => toggleRoomTag(d, i, tag, active))}
                                className={`rounded-full px-3 py-2 text-left text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-0 ${
                                  active
                                    ? "bg-primary text-primary-fg shadow-sm ring-1 ring-primary/20"
                                    : "border border-border bg-surface text-body shadow-sm hover:bg-surface-elevated"
                                }`}
                              >
                                {WIZARD_STEP4_TAG_LABELS[tag] ?? TAG_LABELS[tag]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          ),
      },
      ...(draft.postMode === "room"
        ? ([
            {
              title: "Fotos",
              body: (
                <form className="space-y-6">
                  {draft.rooms.map((room, i) => (
                    <div
                      key={room.id}
                      className="rounded-xl border border-border bg-bg-light p-4 px-5 shadow-sm space-y-4"
                    >
                      <BulkImageUploader
                        title="Fotos de tu espacio"
                        images={room.photos}
                        maxCount={20}
                        apiOn={apiOn}
                        hint={ROOM_SINGLE_FLOW_PHOTO_HINT}
                        onImagesChange={(next) => {
                          setDraft((d) =>
                            syncDraftPhotoFields({
                              ...d,
                              rooms: d.rooms.map((r, ri) => (ri === i ? { ...r, photos: next } : r)),
                            }),
                          );
                        }}
                      />
                    </div>
                  ))}
                </form>
              ),
            },
          ] as const)
        : []),
      {
        title: "Revisar y publicar",
        body: null,
      },
    ],
    [draft, apiOn, mapAddressShown, mapGeocode, expandedPropertyRoomIndex, wizardDraftSaveNote, submitInFlight, editPropertyId, editingLiveProperty, me],
  );

  const maxStepIndex = Math.max(0, steps.length - 1);
  const safeStep = Math.min(Math.max(0, step), maxStepIndex);
  const current = steps[safeStep]!;
  const isPublishStep = current.title === "Revisar y publicar";
  const isLiveListingEdit = Boolean(editingLiveProperty && !upgrade);

  const autofillStep = useCallback(
    (stepIndex: number) => {
      setDraft((d) => normalizePersistedDraft({ ...d, ...seedForStep(stepIndex, d) }));
    },
    [],
  );

  /** Figma/dev: deep-link wizard step and mode (e.g. `/publicar?publishMode=room&publishStep=2`). */
  const publishModeParam = searchParams.get("publishMode");
  const publishStepParam = searchParams.get("publishStep");

  useEffect(() => {
    if (publishModeParam !== "room" && publishModeParam !== "property") return;
    setDraft((d) => {
      if (publishModeParam === "room") {
        if (d.postMode === "room") return d;
        const first = d.rooms[0] ?? defaultRoom();
        return {
          ...d,
          postMode: "room",
          rooms: [
            {
              ...defaultRoom(),
              ...first,
              title: first.title?.trim() || SINGLE_ROOM_DEFAULT_TITLE,
              lodgingType:
                first.lodgingType === "whole_home" ? "private_room" : first.lodgingType,
            },
          ],
          roomImageUrls: d.roomImageUrls.length ? [[...(d.roomImageUrls[0] ?? [])]] : [[]],
          propertySummary: "",
        };
      }
      if (d.postMode === "property") return d;
      return {
        ...d,
        postMode: "property",
        rooms: [defaultRoom()],
        roomImageUrls: [[]],
      };
    });
  }, [publishModeParam]);

  useEffect(() => {
    if (publishStepParam == null || publishStepParam === "") return;
    const n = Number.parseInt(publishStepParam, 10);
    if (!Number.isFinite(n) || n < 0) return;
    setStep(Math.min(n, maxStepIndex));
  }, [publishStepParam, maxStepIndex]);

  useLayoutEffect(() => {
    if (step !== safeStep) {
      setStep(safeStep);
    }
  }, [step, safeStep]);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [step]);

  const publishBlockedReason = useMemo(() => getPublishBlockedReason(draft), [draft]);

  async function submitPublish() {
    setPublishErr(null);
    const blocked = getPublishBlockedReason(draftRef.current);
    if (blocked) {
      setPublishErr(blocked);
      return;
    }
    if (me === undefined) {
      setPublishErr("Comprobando tu sesión… intenta de nuevo en un momento.");
      return;
    }
    if (!me) {
      setSubmitInFlight("draft");
      try {
        let resumeDraft = draftRef.current;
        if (apiOn) {
          const synced = await syncDraftToServer(
            draftRef.current,
            serverSyncRef.current,
            meRef.current?.phoneE164,
          );
          serverSyncRef.current = synced.serverSync;
          setServerSync(synced.serverSync);
          setDraft(synced.draft);
          setLastAutosavedAt(Date.now());
          resumeDraft = synced.draft;
        }
        navigate("/entrar", {
          replace: true,
          state: {
            registrationNotice:
              "Tu anuncio ya está creado como borrador. Para activarlo y publicarlo, inicia sesión o crea una cuenta.",
            resumeDraft,
            resumeServerSync: serverSyncRef.current,
            resumeStep: step,
          },
        });
      } catch (e) {
        setPublishErr(e instanceof Error ? e.message : "No se pudo guardar el borrador.");
      } finally {
        setSubmitInFlight(null);
      }
      return;
    }

    setSubmitInFlight("publish");
    try {
      const result = await publishDraftFromWizard({
        draft: draftRef.current,
        serverSync: serverSyncRef.current,
        editingLiveProperty,
        apiOn,
        isLoggedIn: true,
        profilePhoneE164: me?.phoneE164,
      });
      if (result.kind === "published") {
        setDraft(result.draft);
        const roomIdx = Math.min(
          previewRoomIndex,
          Math.max(0, draftRef.current.rooms.length - 1),
        );
        const returnId =
          serverSyncRef.current.roomIds[roomIdx] ?? liveEditReturnListingId ?? result.roomId;

        if (editingLiveProperty?.status === "published") {
          navigate(listingPublicPath(returnId), {
            replace: true,
            state: { listingUpdated: true },
          });
          return;
        }

        setEditingLiveProperty(null);
        setServerSync({ propertyId: null, roomIds: [] });
        serverSyncRef.current = { propertyId: null, roomIds: [] };
        setPublishSuccessRoomId(returnId);
        return;
      }
      if (result.kind === "error") {
        setDraft(result.draft);
        setPublishErr(result.message);
      }
    } catch (e) {
      setPublishErr(e instanceof Error ? e.message : "No se pudo publicar.");
    } finally {
      setSubmitInFlight(null);
    }
  }

  async function submitWizardProgressDraft(opts?: { finish?: boolean }) {
    setPublishErr(null);
    if (!apiOn) {
      setPublishErr("Configura la API para guardar en el servidor.");
      return;
    }
    if (isFreshDefaultDraft(draftRef.current)) {
      setPublishErr("Selecciona un tipo de espacio antes de guardar.");
      return;
    }
    if (me === undefined) {
      setPublishErr("Comprobando tu sesión… intenta de nuevo en un momento.");
      return;
    }

    setSubmitInFlight("draft");
    setWizardDraftSaveNote("idle");
    try {
      let resumeDraft = draftRef.current;
      const synced = await syncDraftToServer(
        draftRef.current,
        serverSyncRef.current,
        meRef.current?.phoneE164,
      );
      serverSyncRef.current = synced.serverSync;
      setServerSync(synced.serverSync);
      setDraft(synced.draft);
      setLastAutosavedAt(Date.now());
      resumeDraft = synced.draft;

      if (!me) {
        navigate("/entrar", {
          replace: true,
          state: {
            registrationNotice:
              "Tu anuncio ya está creado como borrador. Inicia sesión o crea una cuenta para retomarlo en Mis anuncios.",
            resumeDraft,
            resumeServerSync: serverSyncRef.current,
            resumeStep: step,
          },
        });
        return;
      }

      if (opts?.finish) {
        navigate("/mis-anuncios", { state: { draftSaved: true } });
        return;
      }

      setWizardDraftSaveNote("saved");
      window.setTimeout(() => {
        setWizardDraftSaveNote((n) => (n === "saved" ? "idle" : n));
      }, 2500);
    } catch (e) {
      setPublishErr(e instanceof Error ? e.message : "No se pudo guardar el borrador en el servidor.");
    } finally {
      setSubmitInFlight(null);
    }
  }

  async function submitServerDraft() {
    await submitWizardProgressDraft({ finish: true });
  }

  if (editPropertyId && !editBundleReady) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-sm text-muted">Cargando tu anuncio para editar…</p>
      </div>
    );
  }

  if (isLiveListingEdit && editingLiveProperty) {
    const reviewRoomIndex = Math.min(previewRoomIndex, Math.max(0, draft.rooms.length - 1));
    const returnListingId =
      liveEditReturnListingId ?? serverSync.roomIds[reviewRoomIndex] ?? null;
    const autosaveTimeLabel = formatAutosaveTime(lastAutosavedAt);

    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        {showAutosaveToast && apiOn && me ? (
          <div className="fixed right-4 top-[72px] z-50">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900 shadow-sm">
              <CloudCheck className="size-3.5" aria-hidden />
              Auto-guardado
              {autosaveTimeLabel ? ` ${autosaveTimeLabel}` : ""}
            </div>
          </div>
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight text-primary">Editar anuncio</h1>
        {handoffBanner ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {handoffBanner}
          </p>
        ) : null}

        <div className="mt-6">
          <PublishWizardReviewStep
            draft={draft}
            roomIndex={reviewRoomIndex}
            onRoomIndexChange={setPreviewRoomIndex}
            onDraftChange={(updater) => setDraft((d) => updater(d))}
            apiOn={apiOn}
            profilePhoneE164={me?.phoneE164}
            publishBlockedReason={publishBlockedReason}
            actionErr={publishErr}
            submitInFlight={submitInFlight}
            onSaveDraft={() => void submitServerDraft()}
            onPublish={() => void submitPublish()}
            liveEdit={{
              status: editingLiveProperty.status,
              returnListingId,
            }}
          />
        </div>
      </div>
    );
  }

  if (publishSuccessRoomId) {
    const successTitle =
      draft.postMode === "property"
        ? "¡Todo listo! Tu propiedad ya está publicada"
        : "¡Todo listo! Tu habitación ya está publicada";

    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6 sm:py-24">
        <div
          className="mx-auto inline-flex rounded-full bg-emerald-50 p-4 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          aria-hidden
        >
          <CheckCircle2 className="size-10" strokeWidth={2} />
        </div>

        <h1 className="mt-8 text-2xl font-bold text-slate-900 dark:text-slate-50">{successTitle}</h1>
        <p className="mx-auto mt-2 max-w-md text-base leading-relaxed text-slate-600 dark:text-slate-400">
          Tu anuncio ya está visible para la comunidad. Te notificaremos en cuanto alguien se interese en tu espacio.
        </p>

        <div className="mx-auto mt-6 max-w-md rounded-xl bg-slate-50 p-4 text-left dark:bg-slate-800/60">
          <ul className="space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <li>
              <span aria-hidden>💬 </span>
              <strong className="font-semibold text-slate-800 dark:text-slate-100">Recibe mensajes:</strong> Atiende a
              los interesados directamente desde tu bandeja de entrada.
            </li>
            <li>
              <span aria-hidden>✏️ </span>
              <strong className="font-semibold text-slate-800 dark:text-slate-100">Control total:</strong> Modifica
              precios, fotos o pausa el anuncio desde la sección &quot;Mis Anuncios&quot;.
            </li>
          </ul>
        </div>

        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            to={listingPublicPath(publishSuccessRoomId)}
            className="inline-flex w-full max-w-xs items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-fg shadow-sm transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Ver mi anuncio
          </Link>
          <Link
            to="/"
            className="text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Ir al Inicio
          </Link>
        </div>
      </div>
    );
  }

  const autosaveTimeLabel = formatAutosaveTime(lastAutosavedAt);
  return (
    <div className={`mx-auto px-4 py-8 sm:px-6 sm:py-10 ${isPublishStep ? "max-w-3xl" : "max-w-2xl"}`}>
      {showAutosaveToast && apiOn && me ? (
        <div className="fixed right-4 top-[72px] z-50">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900 shadow-sm">
            <CloudCheck className="size-3.5" aria-hidden />
            Auto-guardado
            {autosaveTimeLabel ? ` ${autosaveTimeLabel}` : ""}
          </div>
        </div>
      ) : null}
      <h1 className="text-2xl font-bold tracking-tight text-primary">Publicar</h1>

      {safeStep === WIZARD_STEP_POST_MODE && me === null ? (
        <div
          role="status"
          className="mt-8 rounded-xl border border-indigo-200/90 bg-indigo-50 p-4 shadow-sm dark:border-indigo-500/35 dark:bg-indigo-950/45"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 flex-1 gap-3">
              <ShieldCheck
                className="mt-0.5 size-6 shrink-0 text-indigo-600 dark:text-indigo-400"
                strokeWidth={2}
                aria-hidden
              />
              <p className="text-sm font-medium leading-relaxed text-indigo-950 dark:text-indigo-100">
                ¡Guarda tu progreso! Inicia sesión o crea una cuenta para que tu anuncio se guarde automáticamente si
                tu sesión expira.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openAuthModal("/publicar")}
              className="inline-flex w-full shrink-0 items-center justify-center rounded-full border border-indigo-300 bg-surface px-4 py-2.5 text-sm font-semibold text-indigo-900 shadow-sm transition hover:bg-indigo-100/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-indigo-400/45 dark:bg-indigo-900/55 dark:text-indigo-50 dark:ring-offset-slate-900 dark:hover:bg-indigo-900/85 sm:w-auto"
            >
              Iniciar sesión
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Paso {safeStep + 1} de {steps.length}
            </p>
            <h2 className="mt-2 text-lg font-semibold text-body">{current.title}</h2>
          </div>
          {me?.isAdmin ? (
            <button
              type="button"
              onClick={() => autofillStep(safeStep)}
              className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 dark:border-amber-500/50 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
              title="Solo visible para administradores"
            >
              <Wand2 className="size-3.5" aria-hidden />
              Autopoblar
            </button>
          ) : null}
        </div>
        <div className="mt-4 space-y-4">
          {isPublishStep ? (
            <PublishWizardReviewStep
              draft={draft}
              roomIndex={Math.min(previewRoomIndex, Math.max(0, draft.rooms.length - 1))}
              onRoomIndexChange={setPreviewRoomIndex}
              onDraftChange={(updater) => setDraft((d) => updater(d))}
              apiOn={apiOn}
              profilePhoneE164={me?.phoneE164}
              publishBlockedReason={publishBlockedReason}
              actionErr={publishErr}
              submitInFlight={submitInFlight}
              onSaveDraft={() => void submitServerDraft()}
              onPublish={() => void submitPublish()}
            />
          ) : (
            current.body
          )}
        </div>
        {publishErr && !isPublishStep ? (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {publishErr}
          </p>
        ) : null}

        <div
          className={`mt-8 flex flex-wrap items-center gap-3 ${step > 0 ? "justify-between" : "justify-end"}`}
        >
          {step > 0 ? (
            <button
              type="button"
              onClick={() => {
                setPublishErr(null);
                setStep((s) => Math.max(0, s - 1));
              }}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-body transition hover:bg-surface-elevated"
            >
              Atrás
            </button>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            {!isPublishStep && apiOn ? (
              <WizardSaveDraftButton
                onClick={() => void submitWizardProgressDraft()}
                inFlight={submitInFlight === "draft"}
                saved={wizardDraftSaveNote === "saved"}
                disabled={submitInFlight === "publish"}
              />
            ) : null}
            {!isPublishStep ? (
              <button
                type="button"
                onClick={() => {
                  const err = validateWizardStepByTitle(current.title, draft, safeStep);
                  if (err) {
                    setPublishErr(err);
                    if (
                      draft.postMode === "property" &&
                      (current.title === "Administrador de recámaras" || current.title === "Recámaras")
                    ) {
                      const idx = firstRoomIndexWithIssues(draft);
                      if (idx >= 0) setExpandedPropertyRoomIndex(idx);
                    }
                    return;
                  }
                  setPublishErr(null);
                  setStep((s) => Math.min(steps.length - 1, s + 1));
                }}
                disabled={submitInFlight !== null}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-50"
              >
                Siguiente
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

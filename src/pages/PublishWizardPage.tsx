import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { WizardLocationMap } from "@/components/WizardLocationMap";
import { WizardNumberStepper } from "@/components/WizardNumberStepper";
import { BulkImageUploader } from "@/components/BulkImageUploader";
import {
  addDraftRoomToProperty,
  createDraftProperty,
  deleteDraftRoom,
  fetchPropertyWithRooms,
  isListingsApiConfigured,
  patchDraftRoom,
  publishPropertyBundle,
  updateProperty,
} from "@/lib/listingsApi";
import { authLinkPublisher, authMe, consumeHandoffToken, type AuthMe } from "@/lib/authApi";
import { apiAbsoluteUrl } from "@/lib/mediaUrl";
import { BASIC_UTILITIES_TAGS, LISTING_TAG_SLUG_SET, utilitiesBundleSatisfied } from "@/lib/listingTags";
import { TAG_LABELS } from "@/lib/searchFilters";
import type {
  ListingStatus,
  ListingTag,
  LodgingType,
  PropertyKind,
  PropertyWithRooms,
  RoomDimension,
  RoommateGenderPref,
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
const PROPERTY_OCCUPANTS_MAX = 50;

/** Index in `steps` for “Datos generales” (título, colonia, descripción de la propiedad). */
const WIZARD_STEP_PROPERTY_GENERAL = 2;
/** Paso 5 en UI (Fotos; incluye contacto). */
const WIZARD_STEP_FOTOS = 4;

const ROOM_PLAZAS_MAX = 12;
const ROOM_STAY_MAX = 36;

/** Título por defecto del listado en modo un solo cuarto (campo oculto en el paso Recámaras). */
const SINGLE_ROOM_DEFAULT_TITLE = "Recámara 1";

/** Placeholder only (not a validation seed); `room.summary` stays empty until the user types. */
const ROOM_SUMMARY_PLACEHOLDER =
  "Ej. Recámara con excelente luz natural y clóset amplio. Ideal para WFH (silenciosa y con buena ventilación). El baño se comparte solo con una persona. Buscamos a alguien que valore el orden y la buena convivencia para mantener un ambiente profesional y relajado.";

const BASIC_UTILITIES_TAG_SET = new Set<string>(BASIC_UTILITIES_TAGS);

/** Etiquetas del paso Recámaras, agrupadas para escaneo rápido (todas las `ListingTag` del producto). */
const WIZARD_ROOM_TAG_GROUPS: { title: string; tags: readonly ListingTag[] }[] = [
  {
    title: "Básicos de la propiedad",
    tags: [
      "wifi",
      "agua",
      "luz",
      "gas",
      "muebles",
      "cocina-equipada",
      "lavadora",
      "secadora",
      "cerca-transporte",
    ],
  },
  {
    title: "Comodidades de la recámara",
    tags: ["baño-privado", "aire-acondicionado", "estacionamiento", "terraza", "cerradura-cuarto"],
  },
  {
    title: "Seguridad y vibe",
    tags: ["seguridad-acceso", "vigilancia", "lgbt-friendly", "mascotas"],
  },
  { title: "Reglas", tags: ["fumar", "fiestas"] },
];

function isoToday(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
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

const CITY_ANCHOR: Record<
  (typeof CITIES)[number],
  { neighborhood: string; lat: number; lng: number }
> = {
  Guadalajara: { neighborhood: "Zona metropolitana", lat: 20.675_138, lng: -103.347_345 },
};

/** Modo cuarto: select “Ocupación permitida” → `roomsAvailable` 1 o 2. */
type RoomOccupationAllowed = "individuals_only" | "couples_or_individuals";

type RoomDraft = {
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
};

type Draft = {
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
   * Tagged property images (shared areas / facade) — `/api/uploads/...` from server.
   * Note: we don't persist per-image tags yet; this is the post-tagging bucket.
   */
  propertyImageUrls: string[];
  /** Untagged pool (mandatory to tag for property-mode before publishing). */
  unassignedImageUrls: string[];
  /** One array per room index. */
  roomImageUrls: string[][];
  rooms: RoomDraft[];
  legalAccepted: boolean;
  isApproximateLocation: boolean;
};

const defaultRoom = (): RoomDraft => ({
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
  availableFrom: "",
  minimalStayMonths: 1,
  roomDimension: "medium",
});

const DEFAULT_PROPERTY_SUMMARY =
  "Cuéntanos qué hace especial a la propiedad en general. Describe las zonas comunes (sala, cocina, terraza, áreas del edificio) y la convivencia. (Importante: Los detalles específicos de la recámara disponible los llenaremos en el Paso 4).";

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
  showWhatsApp: false,
  useCustomMapPin: false,
  customLat: "",
  customLng: "",
  propertyImageUrls: [],
  unassignedImageUrls: [],
  roomImageUrls: [[]],
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

function propertyGeneralStepInvalidReason(d: Draft): string | null {
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
  if (d.propertySummary.trim().length < PROPERTY_SUMMARY_MIN) {
    return `La descripción de la propiedad y áreas comunes debe tener al menos ${PROPERTY_SUMMARY_MIN} caracteres.`;
  }
  if (d.propertySummary.trim().length > PROPERTY_SUMMARY_MAX) {
    return `La descripción de la propiedad no puede exceder los ${PROPERTY_SUMMARY_MAX} caracteres.`;
  }
  if (isDefaultPropertySummarySeed(d.propertySummary)) {
    return "Sustituye el texto de ejemplo por tu propia descripción de la propiedad y las zonas comunes.";
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
  if (showWizardPropertyBathroomsField(d) && d.propertyBathrooms > PROPERTY_BATHROOMS_MAX) {
    return `El número de baños no puede exceder los ${PROPERTY_BATHROOMS_MAX}.`;
  }
  return occupantCountsInvalidReason(d);
}

function roomTitlePlaceholder(room: Pick<RoomDraft, "lodgingType">) {
  return room.lodgingType === "whole_home" ? "Vivienda completa" : "Recámara disponible";
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
  for (const r of d.rooms) {
    if (!Number.isFinite(r.rentMxn) || r.rentMxn <= 0) return false;
    if (!Number.isFinite(r.roomsAvailable) || r.roomsAvailable < 1) return false;
    if (r.ageMin < 18 || r.ageMax < 18 || r.ageMax > 99 || r.ageMin > r.ageMax) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.availableFrom.trim())) return false;
    if (!Number.isFinite(r.minimalStayMonths) || r.minimalStayMonths < 1) return false;
  }
  return true;
}

function wizardContactDigits(contactWhatsApp: string, showPublic: boolean): string {
  if (!showPublic) return DRAFT_WA_PLACEHOLDER;
  const d = normalizeWhatsApp(contactWhatsApp);
  return d.length >= 10 ? d : DRAFT_WA_PLACEHOLDER;
}

function normalizeWhatsApp(s: string): string {
  return s.replace(/\D/g, "");
}

/** Show "Baños (total)" for loft listings, or in full-property (multi-room) wizard mode. */
function showWizardPropertyBathroomsField(d: Draft): boolean {
  return d.propertyKind === "loft" || d.postMode === "property";
}

/** Bathrooms sent to the API (minimum 1 when the field is hidden we still persist a sensible default). */
function effectiveWizardPropertyBathrooms(d: Draft): number {
  const b = d.propertyBathrooms;
  if (Number.isFinite(b) && b > 0) return b;
  return 1;
}

function resumeStepForDraft(draft: Draft, opts: { upgrade: boolean }): number {
  if (opts.upgrade) return 2;

  const propertyCoreMissing =
    Boolean(propertyGeneralStepInvalidReason(draft)) ||
    !Number.isFinite(draft.propertyBedroomsTotal) ||
    draft.propertyBedroomsTotal < 1 ||
    (showWizardPropertyBathroomsField(draft) &&
      (!Number.isFinite(draft.propertyBathrooms) || draft.propertyBathrooms <= 0));

  if (propertyCoreMissing) return 2;

  const contactMissing =
    draft.showWhatsApp && normalizeWhatsApp(draft.contactWhatsApp).length < 10;

  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  const roomsMissing =
    draft.rooms.length === 0 ||
    draft.rooms.some(
      (room) =>
        !room.title.trim() ||
        !room.summary.trim() ||
        room.rentMxn <= 0 ||
        room.roomsAvailable < 1 ||
        room.depositMxn < 0 ||
        room.ageMin < 18 ||
        room.ageMax < 18 ||
        room.ageMax > 99 ||
        room.ageMin > room.ageMax ||
        !isoDate.test(room.availableFrom.trim()) ||
        room.minimalStayMonths < 1,
    );

  if (roomsMissing) return 3;
  if (contactMissing) return 4;

  if (draft.postMode === "property" && draft.unassignedImageUrls.length > 0) return 5;

  return draft.postMode === "property" ? 6 : 5;
}

function pickCity(city: string): (typeof CITIES)[number] {
  return (CITIES as readonly string[]).includes(city) ? (city as (typeof CITIES)[number]) : "Guadalajara";
}

function tagOk(t: string): t is ListingTag {
  return LISTING_TAG_SLUG_SET.has(t);
}

/** Migrate legacy tags; “Servicios básicos incluidos” is represented only by agua+luz+gas+wifi in state. */
function normalizeRoomTagsFromServer(raw: readonly ListingTag[]): ListingTag[] {
  const hadServicios = raw.includes("servicios-incluidos");
  const bundleFromTags = utilitiesBundleSatisfied(raw);
  let next = [...raw].filter((t) => t !== "servicios-incluidos" && t !== "agua-caliente");
  if (raw.includes("lavanderia")) {
    next = next.filter((t) => t !== "lavanderia");
    if (!next.includes("lavadora")) next.push("lavadora");
    if (!next.includes("secadora")) next.push("secadora");
  }
  if (hadServicios || bundleFromTags) {
    for (const t of BASIC_UTILITIES_TAGS) {
      if (!next.includes(t)) next.push(t);
    }
  }
  return [...new Set(next)].filter(tagOk);
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
  const roomDrafts: RoomDraft[] =
    srvRooms.length > 0
      ? srvRooms.map((r) => ({
          ...defaultRoom(),
          title: r.status === "draft" && isDraftOnlyRoomTitleSeed(r.title) ? "" : r.title,
          rentMxn: r.rentMxn,
          depositMxn: r.depositMxn,
          roomsAvailable: r.roomsAvailable,
          summary: r.summary,
          tags: normalizeRoomTagsFromServer((r.tags ?? []) as ListingTag[]),
          roommateGenderPref: r.roommateGenderPref,
          ageMin: Math.min(99, Math.max(18, Number(r.ageMin) || 18)),
          ageMax: (() => {
            const mn = Math.min(99, Math.max(18, Number(r.ageMin) || 18));
            const mx = Math.min(99, Math.max(18, Number(r.ageMax) || 99));
            return mx < mn ? mn : mx;
          })(),
          lodgingType: r.lodgingType ?? "private_room",
          availableFrom: (r.availableFrom ?? isoToday()).slice(0, 10),
          minimalStayMonths: r.minimalStayMonths ?? 1,
          roomDimension: r.roomDimension ?? "medium",
        }))
      : [defaultRoom()];
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
    propertyImageUrls: p.imageUrls ?? [],
    unassignedImageUrls: [],
    roomImageUrls: srvRooms.length > 0 ? srvRooms.map((r) => r.imageUrls ?? []) : [[]],
    rooms: roomDrafts,
    legalAccepted:
      p.status === "published" || p.status === "paused",
    isApproximateLocation: Boolean((p as { isApproximateLocation?: unknown }).isApproximateLocation),
  };
  return {
    draft,
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

export function PublishWizardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const handoffToken = searchParams.get("handoff");
  const editPropertyId = searchParams.get("edit");
  const upgrade = searchParams.get("upgrade") === "1";
  const handoffLock = useRef(false);
  const [handoffBanner, setHandoffBanner] = useState<string | null>(null);
  /** Loaded property was published or paused — save sends PATCH (not publish-bundle). */
  const [editingLiveProperty, setEditingLiveProperty] = useState<{
    status: Extract<ListingStatus, "published" | "paused">;
  } | null>(null);
  const apiOn = isListingsApiConfigured();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => defaultDraft());
  const [serverSync, setServerSync] = useState<ServerSync>(() => ({ propertyId: null, roomIds: [] }));
  const [submitInFlight, setSubmitInFlight] = useState<"publish" | "draft" | null>(null);
  const [publishErr, setPublishErr] = useState<string | null>(null);
  const [autosaveNote, setAutosaveNote] = useState<"idle" | "saving" | "saved" | "error">("idle");
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
          setStep(resumeStepForDraft(nextDraft, { upgrade }));
          if (upgrade && mapped.draft.postMode === "room") {
            setHandoffBanner(
              "Borrador cargado como propiedad con múltiples cuartos. Completa la información faltante para agregar cuartos y publicar.",
            );
          } else if (ps === "published" || ps === "paused") {
            setHandoffBanner(
              ps === "paused"
                ? "Anuncio en pausa cargado. Guarda los cambios y usa “Publicar” para volver a activarlo en búsqueda."
                : "Anuncio publicado cargado. Los cambios se aplican al guardar o al publicar de nuevo.",
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
          setStorageReady(true);
          setSearchParams(
            (prev) => {
              const n = new URLSearchParams(prev);
              n.delete("edit");
              n.delete("upgrade");
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
  }, [apiOn, editPropertyId, upgrade, setSearchParams]);

  const resolveLatLngForDraft = useCallback((d: Draft): { lat: number; lng: number } => {
    const anchor = CITY_ANCHOR[d.city];
    if (!d.useCustomMapPin) return { lat: anchor.lat, lng: anchor.lng };
    const lat = Number(String(d.customLat).replace(",", "."));
    const lng = Number(String(d.customLng).replace(",", "."));
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return { lat: anchor.lat, lng: anchor.lng };
  }, []);

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
  }, [draft.city, draft.customLat, draft.customLng, draft.useCustomMapPin, resolveLatLngForDraft]);

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
      const anchor = CITY_ANCHOR[d.city];
      const neighborhood = d.neighborhood.trim() || anchor.neighborhood;
      const { lat, lng } = resolveLatLngForDraft(d);
      const wa = wizardContactDigits(d.contactWhatsApp, d.showWhatsApp);

      for (let attempt = 0; attempt < 2; attempt++) {
        let propertyId = serverSyncRef.current.propertyId;
        let roomIds = [...serverSyncRef.current.roomIds];

        if (!propertyId) {
          const prop = await createDraftProperty({
            title: d.propertyTitle.trim() || "Sin título",
            city: d.city,
            neighborhood,
            lat,
            lng,
            summary: d.propertySummary.trim(),
            contactWhatsApp: wa,
            propertyKind: d.propertyKind,
            bedroomsTotal: d.propertyBedroomsTotal,
            bathrooms: effectiveWizardPropertyBathrooms(d),
            showWhatsApp: d.showWhatsApp,
            imageUrls: d.propertyImageUrls,
            isApproximateLocation: d.isApproximateLocation,
            occupiedByWomenCount: d.occupiedByWomenCount,
            occupiedByMenCount: d.occupiedByMenCount,
          });
          propertyId = prop.id;
          roomIds = d.rooms.map(() => "");
        }

        while (roomIds.length < d.rooms.length) roomIds.push("");
        roomIds = roomIds.slice(0, d.rooms.length);

        for (let i = 0; i < d.rooms.length; i++) {
          const r = d.rooms[i]!;
          const payload = {
            title: r.title.trim() || "Recámara en borrador",
            rentMxn: r.rentMxn,
            roomsAvailable: r.roomsAvailable,
            tags: r.tags,
            roommateGenderPref: r.roommateGenderPref,
            ageMin: r.ageMin,
            ageMax: r.ageMax,
            summary: r.summary.trim(),
            lodgingType: r.lodgingType,
            availableFrom: r.availableFrom.trim(),
            minimalStayMonths: r.minimalStayMonths,
            roomDimension: r.roomDimension,
            depositMxn: r.depositMxn,
            imageUrls: d.roomImageUrls[i] ?? [],
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
            postMode: d.postMode,
            title: d.propertyTitle.trim() || "Sin título",
            summary: d.propertySummary.trim(),
            city: d.city,
            neighborhood,
            lat,
            lng,
            contactWhatsApp: wa,
            propertyKind: d.propertyKind,
            bedroomsTotal: d.propertyBedroomsTotal,
            bathrooms: effectiveWizardPropertyBathrooms(d),
            showWhatsApp: d.showWhatsApp,
            imageUrls: d.propertyImageUrls,
            isApproximateLocation: d.isApproximateLocation,
            occupiedByWomenCount: d.occupiedByWomenCount,
            occupiedByMenCount: d.occupiedByMenCount,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (attempt === 0 && (msg.includes("update_property_http_404") || msg.includes("update_property_http_403"))) {
            // Draft no longer exists on server or publisher cookie changed; recreate once.
            serverSyncRef.current = { propertyId: "", roomIds: [] };
            setServerSync({ propertyId: "", roomIds: [] });
            continue;
          }
          throw e;
        }

        const next: ServerSync = { propertyId, roomIds };
        serverSyncRef.current = next;
        setServerSync(next);
        setAutosaveNote("saved");
        window.setTimeout(() => {
          setAutosaveNote((n) => (n === "saved" ? "idle" : n));
        }, 2000);
        return next;
      }

      setAutosaveNote("error");
      return null;
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

  function updateRoom(i: number, patch: Partial<RoomDraft>) {
    setDraft((d) => ({
      ...d,
      rooms: d.rooms.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    }));
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
    const rid = serverSyncRef.current.roomIds[i];
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
                      return {
                        ...d,
                        postMode: "property",
                        rooms: [defaultRoom()],
                        roomImageUrls: [[]],
                      };
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
                      }));
                    }}
                    showApproximateRadius={draft.isApproximateLocation}
                  />
                </div>
                {draft.isApproximateLocation ? (
                  <p className="mt-2 rounded-lg border border-border bg-surface-elevated p-3 text-xs text-muted">
                    Para proteger tu privacidad, la dirección que aparece arriba está simplificada. Además, el mapa de
                    búsqueda mostrará un pin con una ubicación aleatoria dentro del perímetro mostrado en el mapa.
                  </p>
                ) : null}

                <h3 className="text-sm font-bold text-primary mt-6 mb-2 border-b border-border pb-1">Nivel de privacidad</h3>
                <label className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3 cursor-pointer transition hover:bg-surface-elevated">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-secondary focus:outline-none focus:ring-2 focus:ring-border focus:ring-offset-0"
                    checked={draft.isApproximateLocation}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, isApproximateLocation: e.target.checked }))
                    }
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
              </div>
            </div>
          </form>
        ),
      },
      {
        title: "¿Cómo es tu espacio?",
        body: (
          <form className="space-y-6">
            <div className="rounded-xl border border-border bg-bg-light p-4 px-5 shadow-sm space-y-4">
              <h3 className="text-[15px] font-bold text-primary">
                Datos Generales
              </h3>
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
              <label className="block text-sm font-medium text-body">
                Descripción de la propiedad y áreas comunes
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
                  Mínimo {PROPERTY_SUMMARY_MIN} caracteres (propiedad y zonas comunes) ·{" "}
                  {draft.propertySummary.trim().length} ahora
                </span>
              </label>
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
                    onChange={(n) =>
                      setDraft((d) => ({
                        ...d,
                        propertyBedroomsTotal: n,
                      }))
                    }
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
              <div className="space-y-3">
                <h4 className="text-sm font-semibold tracking-tight text-primary">
                  Besties actuales en la propiedad
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="block text-sm font-medium text-body">
                    <span className="block">
                      Mujeres
                      <span className="text-red-600"> *</span>
                    </span>
                    <WizardNumberStepper
                      value={draft.occupiedByWomenCount ?? 0}
                      min={0}
                      max={PROPERTY_OCCUPANTS_MAX}
                      onChange={(n) =>
                        setDraft((d) => ({
                          ...d,
                          occupiedByWomenCount: n,
                        }))
                      }
                      decrementLabel="Menos mujeres"
                      incrementLabel="Más mujeres"
                    />
                  </div>
                  <div className="block text-sm font-medium text-body">
                    <span className="block">
                      Hombres
                      <span className="text-red-600"> *</span>
                    </span>
                    <WizardNumberStepper
                      value={draft.occupiedByMenCount ?? 0}
                      min={0}
                      max={PROPERTY_OCCUPANTS_MAX}
                      onChange={(n) =>
                        setDraft((d) => ({
                          ...d,
                          occupiedByMenCount: n,
                        }))
                      }
                      decrementLabel="Menos hombres"
                      incrementLabel="Más hombres"
                    />
                  </div>
                </div>
              </div>
            </div>
          </form>
        ),
      },
      {
        title: "Recámaras",
        body: (
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
                            checked={utilitiesBundleSatisfied(room.tags)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setDraft((d) => ({
                                ...d,
                                rooms: d.rooms.map((r, j) => {
                                  if (j !== i) return r;
                                  let tags = r.tags.filter((t) => t !== "servicios-incluidos");
                                  if (checked) {
                                    for (const t of BASIC_UTILITIES_TAGS) {
                                      if (!tags.includes(t)) tags = [...tags, t];
                                    }
                                  } else {
                                    tags = tags.filter((t) => !BASIC_UTILITIES_TAG_SET.has(t));
                                  }
                                  return { ...r, tags };
                                }),
                              }));
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
                        <span className="block">Plazas / espacios</span>
                        <WizardNumberStepper
                          value={Math.min(ROOM_PLAZAS_MAX, Math.max(0, room.roomsAvailable))}
                          min={0}
                          max={ROOM_PLAZAS_MAX}
                          onChange={(n) => updateRoom(i, { roomsAvailable: n })}
                          decrementLabel="Menos plazas"
                          incrementLabel="Más plazas"
                        />
                      </div>
                    ) : (
                      <label className="block text-sm font-medium text-body">
                        Ocupación permitida
                        <span className="text-red-600"> *</span>
                        <select
                          value={
                            room.roomsAvailable >= 2
                              ? "couples_or_individuals"
                              : "individuals_only"
                          }
                          onChange={(e) => {
                            const occ = e.target.value as RoomOccupationAllowed;
                            updateRoom(i, {
                              roomsAvailable: occ === "individuals_only" ? 1 : 2,
                            });
                          }}
                          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                        >
                          <option value="individuals_only">Solo individuos</option>
                          <option value="couples_or_individuals">Parejas o individuos</option>
                        </select>
                      </label>
                    )}
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
                      Prefieren
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
                      <span className="block">Edad mín.</span>
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
                      <span className="block">Edad máx.</span>
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
                    <textarea
                      value={room.summary}
                      onChange={(e) => updateRoom(i, { summary: e.target.value })}
                      rows={3}
                      placeholder={ROOM_SUMMARY_PLACEHOLDER}
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                    />
                  </label>
                  <div className="mt-3 space-y-4">
                    <p className="text-sm font-medium text-body">Etiquetas de la recámara</p>
                    {WIZARD_ROOM_TAG_GROUPS.map((group) => (
                      <div key={group.title}>
                        <p className="text-xs font-semibold tracking-wide text-muted">
                          {group.title}
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
                                onClick={() =>
                                  setDraft((d) => ({
                                    ...d,
                                    rooms: d.rooms.map((r, j) => {
                                      if (j !== i) return r;
                                      const nextActive = !active;
                                      let tags = r.tags.filter((t) => t !== "servicios-incluidos");
                                      if (BASIC_UTILITIES_TAG_SET.has(tag)) {
                                        if (nextActive) {
                                          if (!tags.includes(tag)) tags = [...tags, tag];
                                        } else {
                                          tags = tags.filter((t) => !BASIC_UTILITIES_TAG_SET.has(t));
                                        }
                                        return { ...r, tags };
                                      }
                                      const nextTags = nextActive
                                        ? tags.includes(tag)
                                          ? tags
                                          : [...tags, tag]
                                        : tags.filter((t) => t !== tag);
                                      return { ...r, tags: nextTags };
                                    }),
                                  }))
                                }
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
                    ))}
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addRoom}
              disabled={draft.postMode === "room"}
              className="w-full rounded-xl border border-dashed border-secondary/60 py-2 text-sm font-semibold text-primary hover:bg-secondary/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {draft.postMode === "room"
                ? "Convierte a propiedad para agregar más recámaras"
                : "+ Agregar otra recámara"}
            </button>
          </div>
        ),
      },
      {
        title: "Fotos",
        body: (
          <form className="space-y-6">
            <div className="rounded-xl border border-border bg-bg-light p-4 px-5 shadow-sm space-y-4">
              <h3 className="text-[15px] font-bold text-primary">
                Contacto
              </h3>
              <label className="block text-sm font-medium text-body">
                WhatsApp de contacto (opcional si no lo muestras en el anuncio)
                <input
                  value={draft.contactWhatsApp}
                  onChange={(e) => setDraft((d) => ({ ...d, contactWhatsApp: e.target.value }))}
                  placeholder="Ej. 523312345678"
                  inputMode="tel"
                  disabled={!draft.showWhatsApp}
                  className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                {!apiOn ? (
                  <span className="mt-1 block text-xs text-muted">
                    Sin API configurada, el número solo se guarda en este navegador hasta que conectes el
                    servidor.
                  </span>
                ) : null}
              </label>
              <label className="mt-2 flex cursor-pointer items-start gap-3 text-sm text-body">
                <input
                  type="checkbox"
                  checked={draft.showWhatsApp}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      showWhatsApp: e.target.checked,
                      ...(e.target.checked ? {} : { contactWhatsApp: "" }),
                    }))
                  }
                  className="mt-1 size-4 rounded border-border text-primary"
                />
                <span>Mostrar WhatsApp en el anuncio público (teléfono visible en el listado).</span>
              </label>
              {draft.showWhatsApp ? (
                <p className="text-xs text-muted">10–15 dígitos.</p>
              ) : null}
            </div>
            <div className="rounded-xl border border-border bg-bg-light p-4 px-5 shadow-sm space-y-4">
              <h3 className="text-[15px] font-bold text-primary">
                Galería Principal
              </h3>
              <p className="text-sm text-muted">
                Sube fotos en bloque. Se optimizan para web (hasta 1920px) antes de subir. En “propiedad” después podrás
                etiquetarlas por cuarto/áreas compartidas/fachada.
              </p>
              {draft.postMode === "property" ? (
                <div className="mt-4">
                  <BulkImageUploader
                    title="Fotos a categorizar (propiedad general)"
                    urls={draft.unassignedImageUrls}
                    maxCount={Math.min(120, draft.rooms.length * 20 + 40)}
                    apiOn={apiOn}
                    onChange={(next) => {
                      setDraft((d) => ({ ...d, unassignedImageUrls: next }));
                    }}
                    hint="Luego las etiquetas por cuarto / áreas compartidas / fachada."
                  />
                </div>
              ) : null}
            </div>

            {draft.rooms.map((room, i) => (
              <div key={i} className="rounded-xl border border-border bg-bg-light p-4 px-5 shadow-sm space-y-4">
                <h3 className="text-[15px] font-bold text-primary">
                  {`Galería: Recámara ${i + 1}`}
                </h3>
                <BulkImageUploader
                  title={room.title.trim() || "Sin título"}
                  urls={draft.roomImageUrls[i] ?? []}
                  maxCount={20}
                  apiOn={apiOn}
                  onChange={(next) => {
                    setDraft((d) => ({
                      ...d,
                      roomImageUrls: d.roomImageUrls.map((row, ri) => (ri === i ? next : row)),
                    }));
                  }}
                />
              </div>
            ))}
          </form>
        ),
      },
      ...(draft.postMode === "property"
        ? ([
            {
              title: "Etiquetar fotos",
              body: (
                <form className="space-y-6">
                  <div className="rounded-xl border border-border bg-bg-light p-4 px-5 shadow-sm space-y-4">
                    <h3 className="text-[15px] font-bold text-primary">
                      Distribución de Fotos
                    </h3>
                    <p className="text-sm text-muted">
                      Para una publicación de propiedad, las fotos deben estar etiquetadas antes de publicar. Puedes
                      dejar fotos “Sin categorizar” mientras editas, pero no al momento de publicar.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>
                        Sin categorizar: <strong className="text-body">{draft.unassignedImageUrls.length}</strong>
                      </span>
                      <span aria-hidden>·</span>
                      <span>
                        Propiedad: <strong className="text-body">{draft.propertyImageUrls.length}</strong>
                      </span>
                      <span aria-hidden>·</span>
                      <span>
                        Cuartos:{" "}
                        <strong className="text-body">
                          {draft.roomImageUrls.reduce((a, r) => a + (r?.length ?? 0), 0)}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-bg-light p-4 px-5 shadow-sm space-y-4">
                    <h3 className="text-[15px] font-bold text-primary">
                      Fotos Sin Categorizar
                    </h3>
                    {draft.unassignedImageUrls.length ? (
                      <button
                        type="button"
                        className="rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold text-body hover:bg-surface-elevated mb-2"
                        onClick={() => {
                          setDraft((d) => ({
                            ...d,
                            propertyImageUrls: [...d.propertyImageUrls, ...d.unassignedImageUrls].slice(0, 20),
                            unassignedImageUrls: [],
                          }));
                        }}
                      >
                        Etiquetar todo como “Áreas compartidas”
                      </button>
                    ) : (
                      <p className="text-sm text-muted italic">No hay fotos sin categorizar. ¡Todo listo!</p>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {draft.unassignedImageUrls.map((u) => (
                        <div key={u} className="rounded-xl border border-border bg-surface p-3">
                          <div className="flex items-start gap-3">
                            <img
                              src={apiAbsoluteUrl(u)}
                              alt=""
                              className="h-16 w-16 rounded-lg object-cover ring-1 ring-border"
                              loading="lazy"
                            />
                            <div className="min-w-0 flex-1">
                              <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
                                Asignar a...
                                <select
                                  className="mt-1 w-full rounded-lg border border-border bg-bg-light px-2 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
                                  defaultValue="uncat"
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setDraft((d) => {
                                      const nextUnassigned = d.unassignedImageUrls.filter((x) => x !== u);
                                      if (v === "shared") {
                                        return {
                                          ...d,
                                          unassignedImageUrls: nextUnassigned,
                                          propertyImageUrls: [...d.propertyImageUrls, u].slice(0, 20),
                                        };
                                      }
                                      if (v === "facade") {
                                        const without = d.propertyImageUrls.filter((x) => x !== u);
                                        return {
                                          ...d,
                                          unassignedImageUrls: nextUnassigned,
                                          propertyImageUrls: [u, ...without].slice(0, 20),
                                        };
                                      }
                                      if (v.startsWith("room:")) {
                                        const idx = Number(v.split(":")[1] ?? "1") - 1;
                                        if (!Number.isFinite(idx) || idx < 0 || idx >= d.rooms.length) return d;
                                        return {
                                          ...d,
                                          unassignedImageUrls: nextUnassigned,
                                          roomImageUrls: d.roomImageUrls.map((row, ri) =>
                                            ri === idx ? [...row, u].slice(0, 20) : row,
                                          ),
                                        };
                                      }
                                      return d;
                                    });
                                  }}
                                >
                                  <option value="uncat">Sin categorizar</option>
                                  <option value="shared">Áreas compartidas</option>
                                  <option value="facade">Fachada</option>
                                  {draft.rooms.map((r, idx) => (
                                    <option key={idx} value={`room:${idx + 1}`}>
                                      Recámara {idx + 1}: {r.title.trim() || "Sin título"}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </form>
              ),
            },
          ] as const)
        : []),
      {
        title: "Publicar",
        body: (
          <form className="space-y-6">
            <div className="rounded-xl border border-border bg-bg-light p-4 px-5 shadow-sm space-y-4">
              <h3 className="text-[15px] font-bold text-primary">
                Revisión Final
              </h3>
              <div className="space-y-3 text-sm text-muted">
                <p>
                  Revisa los pasos anteriores: ciudad, precios, fotos y WhatsApp. Cuando todo esté listo, usa la
                  sección <strong className="text-body">Publicación</strong> debajo para marcar la confirmación legal y
                  publicar en vivo o guardar borrador en el servidor.
                </p>
                <p>
                  Con la API activa, los datos se sincronizan solos en segundo plano; &quot;Guardar borrador en
                  servidor&quot; también fuerza una sincronización inmediata.
                </p>
              </div>
            </div>
          </form>
        ),
      },
    ],
    [draft, apiOn, mapAddressShown, mapGeocode, resolveLatLngForDraft],
  );

  const maxStepIndex = Math.max(0, steps.length - 1);
  const safeStep = Math.min(Math.max(0, step), maxStepIndex);
  const current = steps[safeStep]!;
  const isPublishStep = current.title === "Publicar";

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

  function validateRoomsForSubmit(d: Draft): string | null {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    for (const r of d.rooms) {
      if (!r.title.trim() || !r.summary.trim()) {
        return "Cada recámara necesita título y descripción.";
      }
      if (!Number.isFinite(r.rentMxn) || r.rentMxn <= 0) {
        return "En cada recámara indica una renta mayor a 0.";
      }
      if (!Number.isFinite(r.roomsAvailable) || r.roomsAvailable < 1) {
        return "En cada recámara indica al menos 1 plaza o espacio disponible.";
      }
      if (r.ageMin < 18 || r.ageMax < 18 || r.ageMax > 99) {
        return "La edad mínima y máxima debe estar entre 18 y 99 años.";
      }
      if (r.ageMin > r.ageMax) {
        return "En cada recámara la edad mínima no puede ser mayor que la máxima.";
      }
      if (!iso.test(r.availableFrom.trim())) {
        return "En cada recámara indica una fecha “Disponible desde” válida (AAAA-MM-DD).";
      }
      if (!Number.isFinite(r.minimalStayMonths) || r.minimalStayMonths < 1) {
        return "En cada recámara la estancia mínima debe ser de al menos 1 mes.";
      }
      if (r.depositMxn < 0) {
        return "El depósito no puede ser negativo.";
      }
    }
    return null;
  }

  const publishBlockedReason = useMemo(() => {
    const generalErr = propertyGeneralStepInvalidReason(draft);
    if (generalErr) return generalErr;
    if (!Number.isFinite(draft.propertyBedroomsTotal) || draft.propertyBedroomsTotal < 1) {
      return "Indica cuántas recámaras tiene la propiedad (mínimo 1).";
    }
    if (
      showWizardPropertyBathroomsField(draft) &&
      (!Number.isFinite(draft.propertyBathrooms) || draft.propertyBathrooms <= 0)
    ) {
      return "Indica cuántos baños tiene la propiedad (total, mayor a 0).";
    }
    if (draft.showWhatsApp && normalizeWhatsApp(draft.contactWhatsApp).length < 10) {
      return "WhatsApp inválido.";
    }
    if (draft.postMode === "property" && draft.unassignedImageUrls.length > 0) {
      return "Etiqueta tus fotos (Sin categorizar) antes de publicar.";
    }
    if (!draft.legalAccepted) {
      return "Marca la casilla de confirmación legal para publicar.";
    }
    return validateRoomsForSubmit(draft);
  }, [draft]);

  async function submitPublish() {
    setPublishErr(null);
    const anchor = CITY_ANCHOR[draft.city];
    const neighborhood = draft.neighborhood.trim() || anchor.neighborhood;
    const digits = normalizeWhatsApp(draft.contactWhatsApp);
    const generalErr = propertyGeneralStepInvalidReason(draft);
    if (generalErr) {
      setPublishErr(generalErr);
      return;
    }
    if (draft.showWhatsApp && digits.length < 10) {
      setPublishErr("WhatsApp inválido.");
      return;
    }
    if (!Number.isFinite(draft.propertyBedroomsTotal) || draft.propertyBedroomsTotal < 1) {
      setPublishErr("Indica cuántas recámaras tiene la propiedad (mínimo 1).");
      return;
    }
    if (
      showWizardPropertyBathroomsField(draft) &&
      (!Number.isFinite(draft.propertyBathrooms) || draft.propertyBathrooms <= 0)
    ) {
      setPublishErr("Indica cuántos baños tiene la propiedad (total, mayor a 0).");
      return;
    }
    if (!draft.legalAccepted) {
      setPublishErr("Debes aceptar la confirmación legal.");
      return;
    }
    if (draft.postMode === "property" && draft.unassignedImageUrls.length > 0) {
      setPublishErr("Etiqueta tus fotos (Sin categorizar) antes de publicar.");
      return;
    }
    const roomErr = validateRoomsForSubmit(draft);
    if (roomErr) {
      setPublishErr(roomErr);
      return;
    }
    if (me === undefined) {
      setPublishErr("Comprobando tu sesión… intenta de nuevo en un momento.");
      return;
    }
    if (!me) {
      setSubmitInFlight("draft");
      try {
        await flushWizardAutosave();
        navigate("/entrar", {
          replace: true,
          state: {
            registrationNotice:
              "Tu anuncio ya está creado como borrador. Para activarlo y publicarlo, inicia sesión o crea una cuenta.",
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
      const sync = await flushWizardAutosave();
      const { lat, lng } = resolveLatLngForDraft(draft);
      const firstRoomId =
        sync?.roomIds.find((id) => typeof id === "string" && id.length > 0) ?? null;

      if (apiOn && sync?.propertyId && firstRoomId) {
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
          imageUrls: draft.propertyImageUrls,
          isApproximateLocation: draft.isApproximateLocation,
          occupiedByWomenCount: draft.occupiedByWomenCount,
          occupiedByMenCount: draft.occupiedByMenCount,
        };
        if (editingLiveProperty?.status === "paused") {
          propPatch.status = "published";
        } else if (!editingLiveProperty) {
          propPatch.status = "published";
        }
        await updateProperty(sync.propertyId, propPatch);
        setEditingLiveProperty(null);
        setServerSync({ propertyId: null, roomIds: [] });
        navigate(`/anuncio/${firstRoomId}`);
        return;
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
          imageUrls: draft.propertyImageUrls,
          isApproximateLocation: draft.isApproximateLocation,
          occupiedByWomenCount: draft.occupiedByWomenCount,
          occupiedByMenCount: draft.occupiedByMenCount,
        },
        rooms: draft.rooms.map((r, i) => ({
          title: r.title.trim(),
          rentMxn: Math.max(1, r.rentMxn),
          roomsAvailable: Math.max(1, r.roomsAvailable),
          tags: r.tags,
          roommateGenderPref: r.roommateGenderPref,
          ageMin: r.ageMin,
          ageMax: r.ageMax,
          summary: r.summary.trim(),
          lodgingType: r.lodgingType,
          availableFrom: r.availableFrom.trim(),
          minimalStayMonths: r.minimalStayMonths,
          roomDimension: r.roomDimension,
          depositMxn: r.depositMxn,
          imageUrls: draft.roomImageUrls[i] ?? [],
        })),
      });
      const first = res.rooms[0];
      if (!first) {
        setPublishErr("La API no devolvió recámaras.");
        return;
      }
      setServerSync({ propertyId: null, roomIds: [] });
      navigate(`/anuncio/${first.id}`);
    } catch (e) {
      setPublishErr(e instanceof Error ? e.message : "No se pudo publicar.");
    } finally {
      setSubmitInFlight(null);
    }
  }

  async function submitServerDraft() {
    setPublishErr(null);
    const digits = normalizeWhatsApp(draft.contactWhatsApp);
    const generalErr = propertyGeneralStepInvalidReason(draft);
    if (generalErr) {
      setPublishErr(generalErr);
      return;
    }
    if (draft.showWhatsApp && digits.length < 10) {
      setPublishErr("WhatsApp inválido.");
      return;
    }
    if (!Number.isFinite(draft.propertyBedroomsTotal) || draft.propertyBedroomsTotal < 1) {
      setPublishErr("Indica cuántas recámaras tiene la propiedad (mínimo 1).");
      return;
    }
    if (
      showWizardPropertyBathroomsField(draft) &&
      (!Number.isFinite(draft.propertyBathrooms) || draft.propertyBathrooms <= 0)
    ) {
      setPublishErr("Indica cuántos baños tiene la propiedad (total, mayor a 0).");
      return;
    }
    const roomErr = validateRoomsForSubmit(draft);
    if (roomErr) {
      setPublishErr(roomErr);
      return;
    }

    setSubmitInFlight("draft");
    try {
      await flushWizardAutosave();
      navigate("/mis-anuncios", { state: { draftSaved: true } });
    } catch (e) {
      setPublishErr(e instanceof Error ? e.message : "No se pudo guardar el borrador en el servidor.");
    } finally {
      setSubmitInFlight(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight text-primary">Publicar</h1>
      {apiOn && me ? (
        <p className="mt-2 text-xs text-muted" aria-live="polite">
          {autosaveNote === "saving"
            ? "Guardando borrador en el servidor…"
            : autosaveNote === "saved"
              ? "Borrador guardado en el servidor."
              : autosaveNote === "error"
                ? "No se pudo sincronizar con el servidor. Se reintentará al seguir editando."
                : "Los cambios se guardan solos en el servidor unos segundos después de completar renta, plazas, fechas y datos básicos de la propiedad."}
        </p>
      ) : null}

      <div className="mt-8 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Paso {safeStep + 1} de {steps.length}
        </p>
        <h2 className="mt-2 text-lg font-semibold text-body">{current.title}</h2>
        <div className="mt-4">{current.body}</div>
        {publishErr ? (
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
          {!isPublishStep ? (
            <button
              type="button"
              onClick={() => {
                if (safeStep === WIZARD_STEP_PROPERTY_GENERAL) {
                  const err = propertyGeneralStepInvalidReason(draft);
                  if (err) {
                    setPublishErr(err);
                    return;
                  }
                }
                if (safeStep === WIZARD_STEP_FOTOS) {
                  if (
                    draft.showWhatsApp &&
                    normalizeWhatsApp(draft.contactWhatsApp).length < 10
                  ) {
                    setPublishErr("WhatsApp inválido.");
                    return;
                  }
                }
                setPublishErr(null);
                setStep((s) => Math.min(steps.length - 1, s + 1));
              }}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-fg transition hover:brightness-110"
            >
              Siguiente
            </button>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {apiOn ? (
                <button
                  type="button"
                  disabled={submitInFlight !== null}
                  onClick={() => void submitServerDraft()}
                  className="rounded-full border border-secondary/50 bg-secondary/10 px-5 py-2 text-sm font-semibold text-primary transition enabled:hover:bg-secondary/20 disabled:opacity-50"
                >
                  {submitInFlight === "draft" ? "Guardando…" : "Guardar borrador en servidor"}
                </button>
              ) : null}
              {apiOn ? (
                <button
                  type="button"
                  disabled={submitInFlight !== null}
                  onClick={() => void submitPublish()}
                  className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-fg transition enabled:hover:brightness-110 disabled:opacity-50"
                >
                  {submitInFlight === "publish" ? "Publicando…" : "Publicar"}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {isPublishStep ? (
      <section className="mx-auto mt-8 max-w-2xl rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-body">Publicación</h2>
        <p className="mt-1 text-sm text-muted">
          <strong className="font-medium text-body">Publicar en vivo</strong> (anuncio visible en búsqueda) o{" "}
          <strong className="font-medium text-body">guardar borrador</strong> en el servidor. Solo disponible en este
          último paso del asistente.
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-body">
          <input
            type="checkbox"
            checked={draft.legalAccepted}
            onChange={(e) => setDraft((d) => ({ ...d, legalAccepted: e.target.checked }))}
            className="mt-1 size-4 rounded border-border text-primary"
          />
          <span>
            Confirmo que la información es verídica y acepto las responsabilidades legales al publicar en Bestie
            (v1).
          </span>
        </label>
        {publishBlockedReason ? (
          <p className="mt-3 text-xs text-muted">
            Para habilitar &quot;Publicar ahora&quot;: {publishBlockedReason}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={submitInFlight !== null || Boolean(publishBlockedReason) || !apiOn}
            title={
              !apiOn
                ? "Configura VITE_API_URL y ejecuta la API para publicar."
                : publishBlockedReason ?? undefined
            }
            onClick={() => void submitPublish()}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition enabled:hover:brightness-110 disabled:opacity-45"
          >
            {submitInFlight === "publish" ? "Publicando…" : "Publicar ahora"}
          </button>
          {apiOn ? (
            <button
              type="button"
              disabled={submitInFlight !== null}
              onClick={() => void submitServerDraft()}
              className="rounded-full border border-secondary/50 bg-secondary/10 px-5 py-2.5 text-sm font-semibold text-primary transition enabled:hover:bg-secondary/20 disabled:opacity-50"
            >
              {submitInFlight === "draft" ? "Guardando…" : "Guardar borrador en servidor"}
            </button>
          ) : (
            <span className="text-xs text-muted">
              Sin API: el borrador vive en tu navegador; publicar en el catálogo requiere{" "}
              <code className="rounded bg-surface-elevated px-1">VITE_API_URL</code>.
            </span>
          )}
        </div>
      </section>
      ) : null}
    </div>
  );
}

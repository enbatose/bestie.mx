import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CloudCheck, ShieldCheck, Wand2 } from "lucide-react";
import { seedAiPropertyForm, seedAiRoomForm, seedForStep } from "@/lib/adminSeedData";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { usePageSeo } from "@/hooks/usePageSeo";
import { WizardLocationMap } from "@/components/WizardLocationMap";
import { WizardAddressSearch, cityToCode } from "@/components/publish/WizardAddressSearch";
import {
  APPROXIMATE_LOCATION_RADIUS_DEFAULT_M,
  APPROXIMATE_LOCATION_RADIUS_MAX_M,
  APPROXIMATE_LOCATION_RADIUS_MIN_M,
  clampApproximateRadiusMeters,
} from "@/lib/approximateLocationRadius";
import { StreetViewPovEditor } from "@/components/publish/StreetViewPovEditor";
import {
  WizardNumberStepper,
  WizardPairedFieldLabel,
  WIZARD_FIELD_CONTROL_CLASS,
} from "@/components/WizardNumberStepper";
import { BulkImageUploader } from "@/components/BulkImageUploader";
import { FieldCharCount } from "@/components/publish/FieldCharCount";
import { ResizableTextarea } from "@/components/publish/ResizableTextarea";
import { PropertyRoomManager } from "@/components/publish/PropertyRoomManager";
import { PublishWizardReviewStep } from "@/components/publish/PublishWizardReviewStep";
import { PublishWizardActionBar } from "@/components/publish/PublishWizardActionBar";
import {
  deleteDraftRoom,
  fetchPropertyWithRooms,
  isListingsApiConfigured,
  listingsHttpErrorMessage,
  updateProperty,
} from "@/lib/listingsApi";
import { adminPublishUnclaimed, authLinkPublisher, authMe, consumeHandoffToken } from "@/lib/authApi";
import { ListingPhoneCaptureFields } from "@/components/publish/ListingPhoneCaptureFields";
import { normalizeMxNationalDigits } from "@/lib/mxPhone";
import { HidePricingToggle } from "@/components/publish/HidePricingToggle";
import { applyDraftHidePricing, draftHidePricingContactOk, hidePricingContactRequired } from "@/lib/listingPricing";
import { track } from "@/lib/analytics";
import { ensurePublishSessionRecording } from "@/lib/posthog";
import { resolvePublishCreateFlow } from "@/lib/publishCreateFlow";
import { useAppShellOutlet } from "@/layouts/appShellOutletContext";
import { listingPublicPath, propertyMatchesEditParam, propertyPublicPath, publishWizardSuccessPath, roomMatchesEditParam, isPublishPreviewEditorQuery } from "@/lib/listingReference";
import {
  forgetManualRoomCreateChoice,
  isAiRoomCreateFlow,
  type PublishWizardServerSync,
  publishWizardLastStepIndex,
  roomCreateFlowFromHydratedListing,
} from "@/lib/publishWizard/previewSession";
import {
  applyWizardResumeSearchParams,
  hasWizardResumeQuery,
  readWizardPasoIndex,
} from "@/lib/publishWizard/wizardResumeUrl";
import {
  clearWizardResumeSnapshot,
  readWizardResumeSnapshot,
  writeWizardResumeSnapshot,
} from "@/lib/publishWizard/wizardResumeSession";
import {
  clearLiveEditSession,
  consumePhotoPickerIntent,
  readLiveEditSession,
  writeLiveEditSession,
  type LiveEditSession,
} from "@/lib/publishWizard/liveEditSession";
import {
  buildMyListingsHubPath,
  buildMyListingsRestorePath,
  readMyListingsReturn,
  withMyListingsReturn,
} from "@/lib/myListingsReturn";
import { adminSectionPath } from "@/lib/adminSections";
import { PublishWizardReturnLinks } from "@/components/myListings/MyListingsReturnLink";
import { publishWizardNavPatch, readClaimDraftReturnPath } from "@/lib/publishWizardNavState";
import { FacebookMark } from "@/components/FacebookMark";
import { AiRoomCreateStep } from "@/components/publish/AiRoomCreateStep";
import { toComposeImages, hydrateLocalImagesForCompose, type AiLocalImage } from "@/components/publish/AiImageDropZone";
import {
  EMPTY_AI_HINTS,
  sanitizeAiHintsForVariant,
  type PublishAiHintState,
} from "@/components/publish/PublishAiFilterChips";
import { publishAssistedDraftClaim, activateAssistedDraftClaim, fetchAssistedDraftClaim, selfComposeAssistedDraft, type AssistedDraftConflict } from "@/lib/assistedDraftApi";
import { claimInfoToBundle } from "@/lib/assistedDraftClaim";
import {
  clearAssistedDraftClaimSession,
  readAssistedDraftClaimSession,
  writeAssistedDraftClaimSession,
  writeAssistedDraftClaimToken,
} from "@/lib/publishWizard/assistedDraftClaimSession";
import { TagChoiceSection } from "@/components/publish/TagChoiceSection";
import {
  LISTING_TAG_SLUG_SET,
  migrateDraftTagScopes,
  PROPERTY_AMENITY_TAG_SLUGS,
  PROPERTY_PERMITIDO_TAG_SLUGS,
  PROPERTY_SCOPE_TAG_SET,
  PROPERTY_SCOPE_TAG_SLUGS,
  ROOMMATE_GENDER_PREF_FIELD_LABEL_SHORT,
  ROOM_TAG_GROUPS,
  isListingRentMissing,
} from "@/lib/listingTags";
import {
  hydrateDraftImagesFromUrls,
  hydrateRoomModePhotosFromProperty,
  mirrorRoomModePhotosToProperty,
  normalizeDraftImages,
  normalizePersistedDraftImages,
  syncDraftPhotoArrays,
  draftImagesToUrls,
  type DraftImage,
} from "@/lib/publishWizard/draftImages";
import {
  streetCityFromNominatim,
  neighborhoodFromNominatimAddress,
  type NominatimAddress,
} from "@/lib/nominatimAddress";
import {
  CITY_ANCHOR,
  WIZARD_STEP_TITLES,
  draftRoomEditorImages,
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
  publishDraftFromWizard,
  syncAssistedDraftClaimToServer,
  syncDraftToServer,
  PROPERTY_SUMMARY_MIN,
  PROPERTY_SUMMARY_MAX,
  ROOM_SUMMARY_MIN,
  ROOM_SUMMARY_MAX,
} from "@/lib/publishWizard/publishCore";
import {
  firstRoomIndexMissingRent,
  firstRoomIndexWithIssues,
  isRentRequiredPublishError,
  rentRequiredPublishMessage,
  roomPreviewOptionLabel,
} from "@/lib/publishWizard/roomWizardValidation";
import {
  applyPropertyRentRoomCount,
  hydrateRoomOccupantCounts,
  propertyRentRoomCount,
  setRoomOccupancyStatus,
  syncPropertyRoomSlotsToTotal,
} from "@/lib/publishWizard/propertyRoomSlots";
import { ROOM_SINGLE_FLOW_PHOTO_HINT, roomsAvailableFromIdealTags } from "@/lib/publishWizard/wizardTags";
import { newRoomDraftId } from "@/lib/roomDisplay";
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
const PROPERTY_BEDROOMS_MAX = 20;
const PROPERTY_BATHROOMS_MAX = 10;

/** Index in `steps` for post-type selection (not counted in the header stepper). */
const WIZARD_STEP_POST_MODE = 0;
/** First numbered header step — ubicación, shown as paso 1. */
const WIZARD_FIRST_NUMBERED_STEP = WIZARD_STEP_POST_MODE + 1;

function lastWizardStep(d: Pick<Draft, "postMode" | "roomCreateFlow">): number {
  return publishWizardLastStepIndex(d.postMode, d.roomCreateFlow);
}

/** Index in `steps` for “Datos generales” (título, colonia, descripción de la propiedad). */
const WIZARD_STEP_PROPERTY_GENERAL = 2;
/** Index in `steps` for “Recámaras” (disponibilidad, descripción, chips de recámara). */
const WIZARD_STEP_RECAMARAS = 3;

const ROOM_PLAZAS_MAX = 12;
const ROOM_STAY_MAX = 36;

/** Título por defecto del listado en modo un solo cuarto (campo oculto en el paso Recámaras). */
const SINGLE_ROOM_DEFAULT_TITLE = "Recámara 1";

const ROOM_SUMMARY_PLACEHOLDER =
  "Comparte los detalles que harían que alguien quiera vivir aquí. Describe la vista, el tipo de cama, si cuenta con espacio para trabajar y el ambiente general con los roomies.";

const WIZARD_PROPERTY_AMENITY_SLUGS = PROPERTY_AMENITY_TAG_SLUGS;
const WIZARD_PROPERTY_PERMITIDO_SLUGS = PROPERTY_PERMITIDO_TAG_SLUGS;
const WIZARD_STEP3_TAG_SET = PROPERTY_SCOPE_TAG_SET;
const WIZARD_ROOM_TAG_GROUPS = ROOM_TAG_GROUPS;

function formatAutosaveTime(ts: number | null): string | null {
  if (!ts) return null;
  return new Date(ts).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Idle pause before server autosave — long enough that typing/toggles don't flash the chip. */
const WIZARD_AUTOSAVE_DEBOUNCE_MS = 7000;
const WIZARD_AUTOSAVE_RING_MS = 1000;

/** Stable content fingerprint so no-op / post-sync draft writes do not re-hit the API. */
function wizardAutosaveSignature(d: Draft): string {
  return JSON.stringify(d);
}

function WizardAutosaveIndicator({
  lastSavedAt,
  flashKey,
  showRing,
  saving,
  error,
}: {
  lastSavedAt: number | null;
  flashKey: number;
  showRing: boolean;
  saving: boolean;
  error?: string | null;
}) {
  const timeLabel = formatAutosaveTime(lastSavedAt);
  if (!timeLabel && !error) return null;
  const ringOn = saving || showRing;
  return (
    <div className="pointer-events-none fixed right-4 top-[72px] z-50" aria-live="polite">
      <div className="relative inline-flex max-w-[min(100vw-2rem,20rem)] rounded-full">
        {ringOn && !error ? (
          <svg
            key={saving ? "saving" : flashKey}
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 200 32"
            preserveAspectRatio="none"
            aria-hidden
          >
            <rect
              x="1.5"
              y="1.5"
              width="197"
              height="29"
              rx="14.5"
              ry="14.5"
              fill="none"
              stroke="#065f46"
              strokeWidth="2"
              pathLength="1"
              strokeDasharray="0.16 0.84"
              className={
                saving
                  ? "animate-[autosave-ring-travel_1s_linear_infinite]"
                  : "animate-[autosave-ring-travel_1s_ease-in-out_forwards]"
              }
            />
          </svg>
        ) : null}
        <div
          className={`relative z-10 m-[2px] inline-flex min-w-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium shadow-sm ${
            error
              ? "border-error/40 bg-error/10 text-error"
              : "border-secondary/40 bg-secondary/10 text-body"
          }`}
        >
          <CloudCheck className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 break-words">
            {saving ? "Guardando…" : error ? error : `Auto-guardado ${timeLabel}`}
          </span>
        </div>
      </div>
    </div>
  );
}

function syncDraftPhotoFields(d: Draft): Draft {
  const synced = syncDraftPhotoArrays(d);
  return d.postMode === "room" ? mirrorRoomModePhotosToProperty(synced) : synced;
}

function normalizePersistedDraft(d: Draft): Draft {
  const migrated = migrateDraftTagScopes(normalizePersistedDraftImages(d));
  const rooms = (migrated.rooms ?? []).map((room) => normalizeRoomDraft(room));
  const roomImageUrls = [...(migrated.roomImageUrls ?? [])];
  while (roomImageUrls.length < rooms.length) roomImageUrls.push([]);
  const base: Draft = {
    ...migrated,
    roomCreateFlow:
      migrated.roomCreateFlow === "manual" || migrated.roomCreateFlow === "ai"
        ? migrated.roomCreateFlow
        : migrated.useCustomMapPin || Boolean(migrated.propertyTitle?.trim())
          ? "manual"
          : "ai",
    commonAreaPhotos: normalizeDraftImages(migrated.commonAreaPhotos ?? migrated.propertyImageUrls ?? []),
    rooms: rooms.length ? rooms : [defaultRoom()],
    roomImageUrls: roomImageUrls.slice(0, rooms.length || 1),
    hidePricing: Boolean((migrated as { hidePricing?: unknown }).hidePricing),
    approximateRadiusMeters: clampApproximateRadiusMeters(
      (migrated as { approximateRadiusMeters?: unknown }).approximateRadiusMeters,
    ),
  };
  return syncDraftPhotoFields(hydrateRoomModePhotosFromProperty(normalizePropertyRoomSlots(base)));
}

function normalizePropertyRoomSlots(d: Draft): Draft {
  if (d.postMode !== "property") return d;
  return syncPropertyRoomSlotsToTotal(d, defaultRoom);
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

/** Valid-length placeholder until the user enters a real number; publishing rejects all-zero contacts server-side. */
const DRAFT_WA_PLACEHOLDER = "0000000000000";

type ServerSync = {
  propertyId: string | null;
  /** Parallel to `rooms`; empty string = room not created on the server yet. */
  roomIds: string[];
};

/** Skip empty autosave slots (`""`) so `??` does not hide a real published id. */
function firstNonEmptyId(...ids: Array<string | null | undefined>): string | null {
  for (const id of ids) {
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return null;
}

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
  avalRequired: boolean;
  /** Renta incluye servicios (independiente de los chips Wi‑Fi / agua / luz / gas del paso 3). */
  rentIncludesUtilities: boolean;
  /** Room-specific photos (interior); distinct from property common areas. */
  photos: DraftImage[];
};

export type Draft = {
  /** Strategy: 'room' = single-room post; 'property' = property/multi-room post. */
  postMode: "room" | "property";
  /** Create path. `ai` = paste/infográfico then preview; `manual` = full wizard. Live edits ignore this. */
  roomCreateFlow: "ai" | "manual";
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
  /** Hide rent and deposit on public surfaces (property-level). */
  hidePricing: boolean;
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
  /** Privacy perimeter in meters when `isApproximateLocation` is true. */
  approximateRadiusMeters: number;
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
  avalRequired: false,
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
  roomCreateFlow: "ai",
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
  hidePricing: false,
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
  approximateRadiusMeters: APPROXIMATE_LOCATION_RADIUS_DEFAULT_M,
});

/** Prefer AI/extracted listing phone; if empty, fall back to profile for preview/edit. */
function applyProfilePhoneIfMissing(
  draft: Draft,
  profilePhoneE164?: string | null,
): Draft {
  if (String(draft.contactWhatsApp ?? "").trim()) return draft;
  const national = normalizeMxNationalDigits(profilePhoneE164 ?? "");
  if (!national) return draft;
  return {
    ...draft,
    contactWhatsApp: national,
    showWhatsApp: true,
  };
}

function aiImagesFingerprint(images: AiLocalImage[]): string {
  return images
    .map((img) => {
      if (img.url) return `u:${img.url}`;
      if (img.data) return `d:${img.mimeType}:${img.data.length}:${img.data.slice(0, 20)}:${img.data.slice(-20)}`;
      return `p:${img.preview.slice(0, 40)}`;
    })
    .join("|");
}

type AiComposeSnapshot = {
  text: string;
  city: string;
  hintsKey: string;
  infographicsKey: string;
  photosKey: string;
};

function aiHintsFingerprint(hints: PublishAiHintState): string {
  return JSON.stringify({
    lodgingType: hints.lodgingType,
    loft: hints.loft,
    tagsOn: [...hints.tagsOn].sort(),
    gender: hints.gender,
    roomsForRent: hints.roomsForRent,
    roomsOccupied: hints.roomsOccupied,
  });
}

function captureAiComposeSnapshot(opts: {
  text: string;
  city: string;
  hints: PublishAiHintState;
  photos: AiLocalImage[];
  infographics: AiLocalImage[];
}): AiComposeSnapshot {
  return {
    text: opts.text.trim(),
    city: opts.city,
    hintsKey: aiHintsFingerprint(opts.hints),
    infographicsKey: aiImagesFingerprint(opts.infographics),
    photosKey: aiImagesFingerprint(opts.photos),
  };
}

/** True when Gemini-facing inputs changed (text, infográfico, chips, ciudad). */
function aiComposeNeedsRegenerate(prev: AiComposeSnapshot, next: AiComposeSnapshot): boolean {
  return (
    prev.text !== next.text ||
    prev.city !== next.city ||
    prev.hintsKey !== next.hintsKey ||
    prev.infographicsKey !== next.infographicsKey
  );
}

function urlsFromAiLocalImages(photos: AiLocalImage[], infographics: AiLocalImage[]): string[] {
  return [...photos, ...infographics]
    .map((img) => {
      if (img.url && (img.url.startsWith("/api/uploads/") || img.url.startsWith("/admin-seed/"))) {
        return img.url;
      }
      return img.preview || img.url || "";
    })
    .filter(Boolean);
}

function applyAiGalleryUrls(draft: Draft, urls: string[]): Draft {
  const images = hydrateDraftImagesFromUrls(urls);
  if (draft.postMode === "property") {
    return normalizePersistedDraft({
      ...draft,
      commonAreaPhotos: images,
      propertyImageUrls: images,
      unassignedImageUrls: [],
    });
  }
  const rooms = draft.rooms.length > 0 ? draft.rooms : [defaultRoom()];
  return normalizePersistedDraft({
    ...draft,
    rooms: rooms.map((r, i) => (i === 0 ? { ...r, photos: images } : r)),
    roomImageUrls: rooms.map((_, i) => (i === 0 ? images : draft.roomImageUrls[i] ?? [])),
    commonAreaPhotos: images,
    propertyImageUrls: images,
  });
}

/** If compose dropped gallery photos, keep the step-1 images on the preview draft. */
function applyAiLocalGalleryIfMissing(
  draft: Draft,
  photos: AiLocalImage[],
  infographics: AiLocalImage[],
): Draft {
  const existing = [
    ...draftImagesToUrls(draft.rooms[0]?.photos ?? []),
    ...draftImagesToUrls(draft.propertyImageUrls ?? []),
    ...draftImagesToUrls(draft.commonAreaPhotos ?? []),
  ];
  if (existing.some((u) => u.includes("/api/uploads/") || u.includes("/admin-seed/"))) {
    return draft;
  }
  const urls = urlsFromAiLocalImages(photos, infographics);
  if (!urls.length) return draft;
  return applyAiGalleryUrls(draft, urls);
}

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

export function draftFromPropertyBundle(bundle: PropertyWithRooms): { draft: Draft; serverSync: ServerSync } {
  const p = bundle.property;
  const srvRooms = [...bundle.rooms].sort((a, b) => a.sortOrder - b.sortOrder);
  const city = pickCity(p.city);
  const anchor = CITY_ANCHOR[city];
  const usePin =
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    (Boolean(p.isApproximateLocation) ||
      Math.abs(p.lat - anchor.lat) > 0.0002 ||
      Math.abs(p.lng - anchor.lng) > 0.0002);
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
          avalRequired: Boolean(r.avalRequired),
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
    roomCreateFlow: roomCreateFlowFromHydratedListing({
      status: p.status,
      wizardStep: p.wizardStep,
    }),
    postMode: p.postMode === "room" ? "room" : "property",
    city,
    propertyTitle: p.title,
    neighborhood: p.neighborhood,
    contactWhatsApp: (() => {
      const raw = String(p.contactWhatsApp ?? "");
      const digits = raw.replace(/\D/g, "");
      if (!digits || /^0+$/.test(digits)) return "";
      return normalizeMxNationalDigits(raw) ?? digits.slice(-10);
    })(),
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
    hidePricing: Boolean((p as { hidePricing?: unknown }).hidePricing),
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
    approximateRadiusMeters: clampApproximateRadiusMeters(
      (p as { approximateRadiusMeters?: unknown }).approximateRadiusMeters,
    ),
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
  /** Set when navigating from /borrador/:token — uses claim publish flow. */
  assistedDraftToken?: string;
};

function readClaimTokenFromWindow(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("borrador")?.trim() || null;
}

function loadAssistedClaimBoot(): { token: string; session: ReturnType<typeof readAssistedDraftClaimSession> } | null {
  const token = readClaimTokenFromWindow();
  if (!token) return null;
  return { token, session: readAssistedDraftClaimSession(token) };
}

function loadWizardResumeBoot(): {
  draft: Draft;
  serverSync: PublishWizardServerSync;
  step: number;
} | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("borrador")?.trim() || params.get("handoff")?.trim()) return null;
  if (!hasWizardResumeQuery(params)) return null;
  const snap = readWizardResumeSnapshot();
  if (!snap) return null;
  const edit = params.get("edit")?.trim();
  if (edit && snap.serverSync.propertyId && !propertyMatchesEditParam(snap.serverSync.propertyId, edit)) {
    return null;
  }
  const urlStep = readWizardPasoIndex(params);
  return {
    draft: snap.draft,
    serverSync: snap.serverSync,
    step: urlStep ?? snap.step,
  };
}

export function PublishWizardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    ensurePublishSessionRecording();
  }, []);
  const locationMyListingsReturn = useMemo(
    () => readMyListingsReturn(location.state),
    [location.state],
  );
  const locationFromAdminPosts = Boolean(
    location.state &&
      typeof location.state === "object" &&
      (location.state as { fromAdminPosts?: unknown }).fromAdminPosts === true,
  );
  /** Rewriting the URL to drop ?edit/?room clears history state, so remember where we came from. */
  const [myListingsReturn, setMyListingsReturn] = useState(locationMyListingsReturn);
  const [fromAdminPosts, setFromAdminPosts] = useState(locationFromAdminPosts);
  const locationClaimDraftReturnPath = useMemo(
    () => readClaimDraftReturnPath(location.state),
    [location.state],
  );
  const [claimDraftReturnPath, setClaimDraftReturnPath] = useState(locationClaimDraftReturnPath);
  useEffect(() => {
    if (locationMyListingsReturn) setMyListingsReturn(locationMyListingsReturn);
  }, [locationMyListingsReturn]);
  useEffect(() => {
    if (locationFromAdminPosts) setFromAdminPosts(true);
  }, [locationFromAdminPosts]);
  useEffect(() => {
    if (locationClaimDraftReturnPath) setClaimDraftReturnPath(locationClaimDraftReturnPath);
  }, [locationClaimDraftReturnPath]);
  const myListingsRestorePath = useMemo(
    () => (myListingsReturn ? buildMyListingsRestorePath(myListingsReturn) : null),
    [myListingsReturn],
  );
  const adminPostsRestorePath = fromAdminPosts ? adminSectionPath("property") : null;
  const myListingsReturnRef = useRef(myListingsReturn);
  myListingsReturnRef.current = myListingsReturn;
  const fromAdminPostsRef = useRef(fromAdminPosts);
  fromAdminPostsRef.current = fromAdminPosts;
  const claimDraftReturnPathRef = useRef(claimDraftReturnPath);
  claimDraftReturnPathRef.current = claimDraftReturnPath;

  function currentWizardLocationState() {
    return (
      withMyListingsReturn(
        publishWizardNavPatch({
          fromAdminPosts: fromAdminPostsRef.current,
          claimDraftReturnPath: claimDraftReturnPathRef.current,
        }),
        myListingsReturnRef.current,
      ) ?? null
    );
  }
  const { openAuthModal } = useAuthModal();
  const { me } = useAppShellOutlet();
  const [savePhoneToProfile, setSavePhoneToProfile] = useState(false);
  const phonePrefillDoneRef = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const handoffToken = searchParams.get("handoff");
  const editPropertyId = searchParams.get("edit");
  const editListingId = searchParams.get("room");
  const previewEditorIntent = isPublishPreviewEditorQuery(searchParams);
  const [editPostModeLock, setEditPostModeLock] = useState<Draft["postMode"] | null>(null);
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
  /** Property-card Edit omits `room`; room-row Edit includes it. Survives after query params are cleared. */
  const [liveEditScope, setLiveEditScope] = useState<"property" | "room" | null>(null);
  const [liveEditEditingPhotos, setLiveEditEditingPhotos] = useState(false);
  const apiOn = isListingsApiConfigured();
  const [assistedBoot] = useState(loadAssistedClaimBoot);
  const [resumeBoot] = useState(loadWizardResumeBoot);
  const [step, setStep] = useState(() => {
    if (assistedBoot?.session) {
      return lastWizardStep(normalizePersistedDraft(assistedBoot.session.draft));
    }
    if (typeof resumeBoot?.step === "number") return resumeBoot.step;
    if (readClaimTokenFromWindow()) return lastWizardStep({ postMode: "room", roomCreateFlow: "manual" });
    return 0;
  });
  const [expandedPropertyRoomIndex, setExpandedPropertyRoomIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(() =>
    assistedBoot?.session
      ? normalizePersistedDraft(assistedBoot.session.draft)
      : resumeBoot
        ? normalizePersistedDraft(resumeBoot.draft)
        : defaultDraft(),
  );
  const [serverSync, setServerSync] = useState<ServerSync>(
    () => assistedBoot?.session?.serverSync ?? resumeBoot?.serverSync ?? { propertyId: null, roomIds: [] },
  );
  const [previewRoomIndex, setPreviewRoomIndex] = useState(0);
  const [submitInFlight, setSubmitInFlight] = useState<"publish" | "draft" | null>(null);
  /** Stops resume URL sync from overwriting `/publicar/listo` after a successful publish. */
  const leaveWizardForSuccessRef = useRef(false);
  const [assistedDraftToken, setAssistedDraftToken] = useState<string | null>(
    () => assistedBoot?.token ?? null,
  );
  const [unclaimedAdminOutreach, setUnclaimedAdminOutreach] = useState(false);
  const createFlow = resolvePublishCreateFlow(draft.roomCreateFlow, assistedDraftToken);
  const createFlowRef = useRef(createFlow);
  createFlowRef.current = createFlow;
  const [wizardDraftSaveNote, setWizardDraftSaveNote] = useState<"idle" | "saved">("idle");
  const [publishErr, setPublishErr] = useState<string | null>(null);
  const [autosaveNote, setAutosaveNote] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [autosaveErr, setAutosaveErr] = useState<string | null>(null);
  const [lastAutosavedAt, setLastAutosavedAt] = useState<number | null>(null);
  const [autosaveFlashKey, setAutosaveFlashKey] = useState(0);
  const [showAutosaveRing, setShowAutosaveRing] = useState(false);
  /** Avoid writing default/empty draft to localStorage before per-user hydration (or API bootstrap) finishes. */
  const [storageReady, setStorageReady] = useState(() =>
    Boolean(assistedBoot?.session || resumeBoot),
  );
  /** Single reverse-geocode result for the pin; privacy mode derives a shorter label from `address`, same coordinates. */
  const [mapGeocode, setMapGeocode] = useState<{
    displayFull: string;
    address?: NominatimAddress;
    latKey: string;
    lngKey: string;
  } | null>(null);
  /** Zoom level to use when MapViewSync flies to a new position (updated by address search). */
  const [mapZoom, setMapZoom] = useState(CITY_ANCHOR.Guadalajara.zoom);
  /** Monotonic id so stale reverse-geocode responses never commit after a newer drag/coords change. */
  const reverseGeoGenRef = useRef(0);
  /** Tracks autofill from map pin so we can refresh when the pin moves but not overwrite manual edits. */
  const neighborhoodAutofillFromPinRef = useRef<{ latKey: string; value: string } | null>(null);
  /** Last user action that moved the pin: search pick vs map pan. */
  const locationSourceRef = useRef<"search" | "map">("search");
  const [addressFieldText, setAddressFieldText] = useState("");
  /**
   * Paid Street View viewer is created only after a pin move in this visit to the
   * location step (pan or address search). Returning to the step does not remount it.
   */
  const [streetViewViewerReady, setStreetViewViewerReady] = useState(false);
  const [aiSourceText, setAiSourceText] = useState("");
  const [aiHints, setAiHints] = useState<PublishAiHintState>(EMPTY_AI_HINTS);
  const [aiPhotos, setAiPhotos] = useState<AiLocalImage[]>([]);
  const [aiInfographics, setAiInfographics] = useState<AiLocalImage[]>([]);
  const [aiConflicts, setAiConflicts] = useState<AssistedDraftConflict[]>([]);
  const [aiComposeInFlight, setAiComposeInFlight] = useState(false);
  const [aiDidCompose, setAiDidCompose] = useState(false);
  const [aiComposeSnapshot, setAiComposeSnapshot] = useState<AiComposeSnapshot | null>(null);

  usePageSeo({
    title: "Publicar anuncio | Bestie MX",
    description:
      "Publica un cuarto compartido o una propiedad en Bestie MX. Los anuncios públicos se comparten desde /anuncio y /propiedad.",
    canonicalPath: "/publicar",
    noindex: true,
  });

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
    const st = location.state as WizardResumeState | null;
    if (!st?.resumeDraft) return;
    const resumed = normalizePersistedDraft(st.resumeDraft);
    setDraft(resumed);
    markAutosaveBaseline(resumed);
    if (st.resumeServerSync) {
      setServerSync(st.resumeServerSync);
      if (st.resumeServerSync.propertyId) {
        hydratedEditPropertyIdRef.current = st.resumeServerSync.propertyId;
      }
    }
    if (typeof st.resumeStep === "number" && Number.isFinite(st.resumeStep)) {
      setStep(Math.max(0, st.resumeStep));
    }
    if (typeof st.assistedDraftToken === "string" && st.assistedDraftToken) {
      setAssistedDraftToken(st.assistedDraftToken);
      writeAssistedDraftClaimToken(st.assistedDraftToken);
      writeAssistedDraftClaimSession({
        token: st.assistedDraftToken,
        draft: resumed,
        serverSync: st.resumeServerSync ?? { propertyId: null, roomIds: [] },
        step: typeof st.resumeStep === "number" ? st.resumeStep : lastWizardStep(resumed),
      });
    }
    // Signal the auth effect to skip its reset — we already have the correct draft/step.
    resumeStateAppliedRef.current = true;
    const params = new URLSearchParams(location.search);
    if (st.assistedDraftToken) params.set("borrador", st.assistedDraftToken);
    const search = params.toString();
    navigate(`${location.pathname}${search ? `?${search}` : ""}`, {
      replace: true,
      state: currentWizardLocationState(),
    });
  }, [location.pathname, location.search, location.state, fromAdminPosts, claimDraftReturnPath, myListingsReturn, navigate]);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const serverSyncRef = useRef(serverSync);
  serverSyncRef.current = serverSync;
  const assistedDraftTokenRef = useRef(assistedDraftToken);
  assistedDraftTokenRef.current = assistedDraftToken;
  /** Set when location.state resume is applied; prevents the auth effect from resetting step/draft. */
  const resumeStateAppliedRef = useRef(false);
  const meRef = useRef(me);
  meRef.current = me;
  const savePhoneToProfileRef = useRef(savePhoneToProfile);
  savePhoneToProfileRef.current = savePhoneToProfile;

  useEffect(() => {
    if (phonePrefillDoneRef.current) return;
    if (!me?.phoneE164) return;
    if (draft.contactWhatsApp.trim()) {
      phonePrefillDoneRef.current = true;
      return;
    }
    const national = normalizeMxNationalDigits(me.phoneE164);
    if (!national) return;
    phonePrefillDoneRef.current = true;
    setDraft((d) => (d.contactWhatsApp.trim() ? d : { ...d, contactWhatsApp: national }));
  }, [me?.phoneE164, draft.contactWhatsApp]);
  const storageReadyRef = useRef(storageReady);
  storageReadyRef.current = storageReady;
  const prevUserIdRef = useRef<string | null>(undefined);
  const didHydrateLocalForUserRef = useRef<string | null>(null);
  const hydratedEditPropertyIdRef = useRef<string | null>(null);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runAutosaveRef = useRef<() => Promise<ServerSync | null>>(async () => null);
  const autosaveGenerationRef = useRef(0);
  const autosaveRingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSignatureRef = useRef<string | null>(null);

  function resetAutosaveUiState() {
    setAutosaveNote("idle");
    setLastAutosavedAt(null);
    setAutosaveFlashKey(0);
    setShowAutosaveRing(false);
    lastSavedSignatureRef.current = null;
  }

  function playAutosaveRing() {
    setAutosaveFlashKey((k) => k + 1);
    setShowAutosaveRing(true);
    if (autosaveRingTimerRef.current) clearTimeout(autosaveRingTimerRef.current);
    autosaveRingTimerRef.current = window.setTimeout(() => {
      setShowAutosaveRing(false);
      autosaveRingTimerRef.current = null;
    }, WIZARD_AUTOSAVE_RING_MS);
  }

  function markAutosaveBaseline(d: Draft, opts?: { touchUi?: boolean }) {
    lastSavedSignatureRef.current = wizardAutosaveSignature(d);
    if (opts?.touchUi) {
      setLastAutosavedAt(Date.now());
    }
  }

  function rememberClaimSyncedDraft(token: string, syncedDraft: Draft) {
    const nextSync = {
      propertyId: serverSyncRef.current.propertyId,
      roomIds: syncedDraft.rooms.map((room) => room.id),
    };
    serverSyncRef.current = nextSync;
    setServerSync(nextSync);
    writeAssistedDraftClaimSession({
      token,
      draft: syncedDraft,
      serverSync: nextSync,
      step,
    });
  }

  useEffect(() => {
    if (me === undefined) return;
    const claimToken = assistedDraftTokenRef.current || searchParams.get("borrador")?.trim();
    const resumeQuery = hasWizardResumeQuery(searchParams);
    // Assisted-draft / resume-state / in-progress URL: keep the draft instead of resetting.
    if (resumeStateAppliedRef.current || claimToken || resumeQuery) {
      const fromResume = resumeStateAppliedRef.current;
      resumeStateAppliedRef.current = false;
      if (me?.id) didHydrateLocalForUserRef.current = me.id;
      if (claimToken) writeAssistedDraftClaimToken(claimToken);
      if (fromResume || claimToken || resumeQuery) setStorageReady(true);
      return;
    }
    if (!me) {
      prevUserIdRef.current = null;
      didHydrateLocalForUserRef.current = null;
      setStorageReady(true);
      setEditingLiveProperty(null);
      setEditPostModeLock(null);
      setLiveEditEditingPhotos(false);
      clearLiveEditSession();
      clearWizardResumeSnapshot();
      setDraft(defaultDraft());
      setServerSync({ propertyId: null, roomIds: [] });
      setStep(0);
      resetAutosaveUiState();
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
    clearLiveEditSession();
    clearWizardResumeSnapshot();
    setLiveEditEditingPhotos(false);
    setDraft(defaultDraft());
    setServerSync({ propertyId: null, roomIds: [] });
    setStep(0);
    resetAutosaveUiState();
    setStorageReady(true);
  }, [me, editPropertyId, handoffToken, assistedDraftToken, searchParams]);

  const claimHydrateLock = useRef(false);
  const claimTokenParam = searchParams.get("borrador")?.trim() || "";
  useEffect(() => {
    const token = claimTokenParam || assistedDraftToken;
    if (!token) {
      if (!editPropertyId) setUnclaimedAdminOutreach(false);
      return;
    }
    let cancelled = false;
    void fetchAssistedDraftClaim(token)
      .then((info) => {
        if (cancelled) return;
        setUnclaimedAdminOutreach(Boolean(info.unclaimedAdminOutreach));
        if (info.propertyId) {
          setServerSync((s) => (s.propertyId ? s : { ...s, propertyId: info.propertyId }));
        }
      })
      .catch(() => {
        if (!cancelled) setUnclaimedAdminOutreach(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assistedDraftToken, claimTokenParam, editPropertyId]);
  useEffect(() => {
    const token = claimTokenParam || assistedDraftToken;
    if (!token) return;
    setAssistedDraftToken(token);
    writeAssistedDraftClaimToken(token);
    if (claimHydrateLock.current) return;
    if (assistedBoot?.session || resumeStateAppliedRef.current) {
      claimHydrateLock.current = true;
      if (assistedBoot?.session) {
        setStep(lastWizardStep(assistedBoot.session.draft));
      }
      setStorageReady(true);
      return;
    }
    claimHydrateLock.current = true;
    const cached = readAssistedDraftClaimSession(token);
    if (cached) {
      const nextDraft = normalizePersistedDraft(cached.draft);
      const resumeStep = lastWizardStep(nextDraft);
      setDraft(nextDraft);
      setServerSync(cached.serverSync);
      setStep(resumeStep);
      markAutosaveBaseline(nextDraft);
      setStorageReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        try {
          await activateAssistedDraftClaim(token);
        } catch {
          /* already activated */
        }
        const info = await fetchAssistedDraftClaim(token);
        if (cancelled) return;
        const mapped = draftFromPropertyBundle(claimInfoToBundle(info));
        const nextDraft: Draft = applyProfilePhoneIfMissing(
          {
            ...mapped.draft,
            roomCreateFlow: info.source === "self_serve" ? "ai" : "manual",
          },
          meRef.current?.phoneE164,
        );
        const resumeStep = lastWizardStep(nextDraft);
        setDraft(nextDraft);
        setServerSync(mapped.serverSync);
        setStep(resumeStep);
        markAutosaveBaseline(nextDraft);
        writeAssistedDraftClaimSession({
          token,
          draft: nextDraft,
          serverSync: mapped.serverSync,
          step: resumeStep,
        });
        setStorageReady(true);
      } catch {
        if (!cancelled) setStorageReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assistedBoot?.session, assistedDraftToken, claimTokenParam]);

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
            setEditPostModeLock(mapped.draft.postMode);
            markAutosaveBaseline(mapped.draft);
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
    // Camera/gallery can kill the tab after we used to strip ?edit= — restore the edit URL
    // when a fresh photo-picker intent + live-edit snapshot are present.
    if (editPropertyId) return;
    const intent = consumePhotoPickerIntent();
    if (!intent) return;
    const cached = readLiveEditSession();
    if (!cached) return;
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set("edit", cached.propertyId);
        if (cached.roomId) n.set("room", cached.roomId);
        else n.delete("room");
        return n;
      },
      {
        replace: true,
        state: currentWizardLocationState(),
      },
    );
  }, [editPropertyId, setSearchParams]);

  function applyLiveEditSession(cached: LiveEditSession) {
    const nextDraft = normalizePersistedDraft(cached.draft);
    setDraft(nextDraft);
    setServerSync(cached.serverSync);
    serverSyncRef.current = cached.serverSync;
    setEditingLiveProperty({ status: cached.status });
    setEditPostModeLock(cached.draft.postMode);
    // When arriving via the property card edit URL (no &room= param), always use
    // "property" scope even if the cached session recorded "room" from a prior
    // room-row edit of the same property (prevents the room modal from auto-opening
    // and from showing another room's validation errors).
    const effectiveScope =
      !editListingId && nextDraft.postMode === "property" ? "property" : cached.scope;
    setLiveEditScope(effectiveScope);
    setLiveEditReturnListingId(cached.returnListingId);
    setPreviewRoomIndex(
      Math.min(cached.previewRoomIndex, Math.max(0, nextDraft.rooms.length - 1)),
    );
    setLiveEditEditingPhotos(cached.editingPhotos);
    setStep(lastWizardStep(nextDraft));
    markAutosaveBaseline(nextDraft);
    setHandoffBanner(
      cached.status === "paused"
        ? "Anuncio en pausa. Edita por sección y usa “Guardar y republicar” para volver a activarlo en búsqueda."
        : null,
    );
  }

  function persistLiveEditSession(opts?: { editingPhotos?: boolean }) {
    const propertyId = serverSyncRef.current.propertyId ?? editPropertyId;
    if (!editingLiveProperty || !propertyId) return;
    writeLiveEditSession({
      propertyId,
      roomId: editListingId ?? liveEditReturnListingId,
      scope: liveEditScope ?? "room",
      status: editingLiveProperty.status,
      draft: draftRef.current,
      serverSync: serverSyncRef.current,
      previewRoomIndex: previewRoomIndex,
      returnListingId: liveEditReturnListingId,
      editingPhotos: opts?.editingPhotos ?? liveEditEditingPhotos,
      updatedAt: Date.now(),
    });
  }

  useEffect(() => {
    if (!editPropertyId) {
      return;
    }
    if (!apiOn) return;

    if (
      hydratedEditPropertyIdRef.current &&
      propertyMatchesEditParam(hydratedEditPropertyIdRef.current, editPropertyId)
    ) {
      setEditBundleReady(true);
      setStorageReady(true);
      return;
    }

    setEditBundleReady(false);
    let cancelled = false;
    void (async () => {
      try {
        const cached = readLiveEditSession();
        const preferCached =
          Boolean(cached) &&
          propertyMatchesEditParam(cached!.propertyId, editPropertyId) &&
          (cached!.editingPhotos || Date.now() - cached!.updatedAt < 120_000);
        if (preferCached && cached) {
          if (!cancelled) {
            applyLiveEditSession(cached);
            hydratedEditPropertyIdRef.current = cached.propertyId;
            const sessionUser = await authMe();
            if (sessionUser?.id) didHydrateLocalForUserRef.current = sessionUser.id;
          }
          return;
        }

        const bundle = await fetchPropertyWithRooms(editPropertyId);
        if (bundle && !cancelled) {
          const mapped = draftFromPropertyBundle(bundle);
          const ps = bundle.property.status;
          setEditingLiveProperty(
            ps === "published" || ps === "paused" ? { status: ps } : null,
          );
          const nextDraft = mapped.draft;
          setDraft(nextDraft);
          setServerSync(mapped.serverSync);
          hydratedEditPropertyIdRef.current = mapped.serverSync.propertyId;
          setEditPostModeLock(mapped.draft.postMode);
          markAutosaveBaseline(nextDraft);

          const srvRooms = [...bundle.rooms].sort((a, b) => a.sortOrder - b.sortOrder);
          let previewIdx = 0;
          if (editListingId) {
            const found = srvRooms.findIndex((r) => roomMatchesEditParam(r.id, editListingId));
            if (found >= 0) previewIdx = found;
          }
          setPreviewRoomIndex(previewIdx);
          const matchedRoom =
            editListingId ? srvRooms.find((r) => roomMatchesEditParam(r.id, editListingId)) : undefined;
          const returnId =
            matchedRoom?.id ??
            srvRooms[previewIdx]?.id ??
            srvRooms.find((r) => r.status === "published")?.id ??
            srvRooms[0]?.id ??
            null;
          setLiveEditReturnListingId(returnId);
          const scope: "property" | "room" =
            editListingId || nextDraft.postMode !== "property" ? "room" : "property";
          setLiveEditScope(scope);
          setUnclaimedAdminOutreach(Boolean(bundle.property.unclaimedAdminOutreach));
          const urlStep = readWizardPasoIndex(searchParams);
          if (ps === "published" || ps === "paused" || isPublishPreviewEditorQuery(searchParams)) {
            setStep(lastWizardStep(nextDraft));
          } else if (urlStep != null) {
            setStep(urlStep);
          } else if (typeof bundle.property.wizardStep === "number") {
            setStep(bundle.property.wizardStep);
          } else {
            setStep(lastWizardStep(nextDraft));
          }

          if (ps === "published" || ps === "paused") {
            setHandoffBanner(
              ps === "paused"
                ? "Anuncio en pausa. Edita por sección y usa “Guardar y republicar” para volver a activarlo en búsqueda."
                : null,
            );
            writeLiveEditSession({
              propertyId: mapped.serverSync.propertyId ?? editPropertyId,
              roomId: matchedRoom?.id ?? editListingId,
              scope,
              status: ps,
              draft: nextDraft,
              serverSync: mapped.serverSync,
              previewRoomIndex: previewIdx,
              returnListingId: returnId,
              editingPhotos: false,
              updatedAt: Date.now(),
            });
          } else {
            setHandoffBanner(null);
            clearLiveEditSession();
          }
          const session = await authMe();
          if (session?.id) didHydrateLocalForUserRef.current = session.id;
        } else if (!cancelled) {
          setPublishErr("No se pudo abrir este anuncio. Vuelve atrás e intenta de nuevo.");
        }
      } catch (e) {
        if (!cancelled) {
          setEditingLiveProperty(null);
          const raw = e instanceof Error ? e.message : "";
          setPublishErr(
            raw.includes("property_http_400") || raw.includes("invalid_id")
              ? "No se pudo abrir este anuncio. Vuelve atrás e intenta de nuevo."
              : raw || "No se pudo cargar el borrador.",
          );
        }
      } finally {
        if (!cancelled) {
          setEditBundleReady(true);
          setStorageReady(true);
          // Keep ?edit=&room= so Android camera/gallery tab kills remount back into live edit.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiOn, editPropertyId, editListingId, searchParams]);

  useEffect(() => {
    if (!editingLiveProperty) return;
    if (!serverSync.propertyId && !editPropertyId) return;
    persistLiveEditSession();
  }, [
    editingLiveProperty,
    draft,
    serverSync,
    previewRoomIndex,
    liveEditReturnListingId,
    liveEditScope,
    liveEditEditingPhotos,
    editPropertyId,
    editListingId,
  ]);

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
    const { lat, lng } = resolveLatLngForDraft(draft);
    const latKey = lat.toFixed(6);
    const lngKey = lng.toFixed(6);
    const hasValidCustomCoords =
      Number.isFinite(Number(String(draft.customLat).replace(",", "."))) &&
      Number.isFinite(Number(String(draft.customLng).replace(",", ".")));

    if (!hasValidCustomCoords) return null;

    if (!mapGeocode || mapGeocode.latKey !== latKey || mapGeocode.lngKey !== lngKey) return null;

    return streetCityFromNominatim(mapGeocode.address, draft.city);
  }, [
    draft.city,
    draft.useCustomMapPin,
    mapGeocode,
    resolveLatLngForDraft,
    draft.customLat,
    draft.customLng,
  ]);

  useEffect(() => {
    if (!mapAddressShown) return;
    // Keep a search-picker label; fill from reverse-geocode after a pan or when the field is still empty (resume).
    if (locationSourceRef.current === "search" && addressFieldText.trim()) return;
    setAddressFieldText(mapAddressShown);
  }, [mapAddressShown, addressFieldText]);

  runAutosaveRef.current = async (): Promise<ServerSync | null> => {
    if (!isListingsApiConfigured()) return null;
    const claimToken = assistedDraftTokenRef.current;
    if (!claimToken && !storageReadyRef.current) {
      setAutosaveNote("idle");
      return null;
    }
    if (claimToken && !storageReadyRef.current) {
      setAutosaveNote("idle");
      return null;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setAutosaveNote("idle");
      return null;
    }
    const generation = ++autosaveGenerationRef.current;
    const d = draftRef.current;
    if (isFreshDefaultDraft(d) || !wizardHasMinimumFieldsForAutosave(d)) {
      setAutosaveNote("idle");
      return null;
    }

    const beforeSig = wizardAutosaveSignature(d);
    if (beforeSig === lastSavedSignatureRef.current) {
      // Draft fields unchanged — still persist wizard step for the admin report.
      if (serverSyncRef.current.propertyId && typeof step === "number") {
        try {
          await updateProperty(serverSyncRef.current.propertyId, { wizardStep: step });
        } catch {
          /* non-blocking */
        }
      }
      setAutosaveNote("idle");
      return serverSyncRef.current.propertyId ? serverSyncRef.current : null;
    }

    try {
      setAutosaveNote("saving");
      setAutosaveErr(null);
      if (claimToken) {
        const syncedDraft = await syncAssistedDraftClaimToServer(
          claimToken,
          d,
          serverSyncRef.current.roomIds,
        );
        if (generation !== autosaveGenerationRef.current) {
          return serverSyncRef.current;
        }
        const syncedSig = wizardAutosaveSignature(syncedDraft);
        lastSavedSignatureRef.current = syncedSig;
        rememberClaimSyncedDraft(claimToken, syncedDraft);
        if (wizardAutosaveSignature(draftRef.current) === beforeSig && syncedSig !== beforeSig) {
          setDraft(syncedDraft);
        }
        setAutosaveNote("saved");
        setLastAutosavedAt(Date.now());
        playAutosaveRing();
        window.setTimeout(() => {
          setAutosaveNote((n) => (n === "saved" ? "idle" : n));
        }, 2000);
        return serverSyncRef.current.propertyId ? serverSyncRef.current : null;
      }
      const synced = await syncDraftToServer(d, serverSyncRef.current, meRef.current?.phoneE164, {
        wizardStep: step,
      });
      if (generation !== autosaveGenerationRef.current) {
        return synced.serverSync;
      }
      const syncedSig = wizardAutosaveSignature(synced.draft);
      lastSavedSignatureRef.current = syncedSig;
      serverSyncRef.current = synced.serverSync;
      setServerSync(synced.serverSync);
      if (synced.serverSync.propertyId) {
        hydratedEditPropertyIdRef.current = synced.serverSync.propertyId;
      }

      // Avoid clobbering concurrent edits; only apply server-normalized draft when still in sync.
      if (wizardAutosaveSignature(draftRef.current) === beforeSig && syncedSig !== beforeSig) {
        setDraft(synced.draft);
      }

      setAutosaveNote("saved");
      setLastAutosavedAt(Date.now());
      playAutosaveRing();
      window.setTimeout(() => {
        setAutosaveNote((n) => (n === "saved" ? "idle" : n));
      }, 2000);
      return synced.serverSync;
    } catch (e) {
      if (generation === autosaveGenerationRef.current) {
        setAutosaveNote("error");
        setAutosaveErr(listingsHttpErrorMessage(e));
      }
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
    if (isFreshDefaultDraft(draftRef.current)) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    const delay = assistedDraftTokenRef.current ? 400 : WIZARD_AUTOSAVE_DEBOUNCE_MS;
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      void runAutosaveRef.current();
    }, delay);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [draft, apiOn, me?.id, storageReady, step, assistedDraftToken]);

  useEffect(() => {
    if (leaveWizardForSuccessRef.current) return;
    const token = assistedDraftToken;
    if (!token || !storageReady) return;
    if (isFreshDefaultDraft(draft)) return;
    writeAssistedDraftClaimSession({
      token,
      draft,
      serverSync,
      step,
    });
  }, [assistedDraftToken, draft, serverSync, step, storageReady]);

  useEffect(() => {
    if (leaveWizardForSuccessRef.current) return;
    if (!storageReady) return;
    if (
      isFreshDefaultDraft(draft) &&
      step === 0 &&
      !serverSync.propertyId &&
      !assistedDraftToken
    ) {
      return;
    }
    writeWizardResumeSnapshot({
      draft,
      serverSync,
      step,
      updatedAt: Date.now(),
    });
  }, [assistedDraftToken, draft, serverSync, step, storageReady]);

  const wizardHasProgress =
    !isFreshDefaultDraft(draft) ||
    step > 0 ||
    Boolean(serverSync.propertyId) ||
    Boolean(assistedDraftToken);
  const claimAwaitingPayload = Boolean(assistedDraftToken) && isFreshDefaultDraft(draft);

  useEffect(() => {
    if (leaveWizardForSuccessRef.current) return;
    if (window.location.pathname !== "/publicar") return;
    if (!storageReady || !wizardHasProgress) return;
    if (claimAwaitingPayload) return;
    setSearchParams(
      (prev) => {
        const next = applyWizardResumeSearchParams(prev, {
          propertyId:
            assistedDraftToken || (draft.roomCreateFlow === "ai" && !editingLiveProperty && !editPropertyId)
              ? null
              : serverSync.propertyId,
          clearEdit: draft.roomCreateFlow === "ai" && !editingLiveProperty && !assistedDraftToken && !editPropertyId,
          stepIndex: step,
          roomId: editingLiveProperty || previewEditorIntent || editPropertyId
            ? (editListingId || liveEditReturnListingId)
            : undefined,
          assistedDraftToken,
          previewEditor:
            previewEditorIntent || Boolean(editingLiveProperty) || fromAdminPosts,
        });
        return next.toString() === prev.toString() ? prev : next;
      },
      {
        replace: true,
        state: currentWizardLocationState(),
      },
    );
  }, [
    assistedDraftToken,
    claimAwaitingPayload,
    draft.roomCreateFlow,
    editListingId,
    editPropertyId,
    editingLiveProperty,
    fromAdminPosts,
    claimDraftReturnPath,
    liveEditReturnListingId,
    previewEditorIntent,
    serverSync.propertyId,
    setSearchParams,
    step,
    storageReady,
    wizardHasProgress,
  ]);

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

  const aiRoomFlow = isAiRoomCreateFlow(draft, {
    liveEdit: Boolean(editingLiveProperty) || previewEditorIntent,
  });

  const steps = useMemo(
    () => {
      const typeStep = {
        title: "¿Qué tipo de espacio deseas publicar?",
        body: (
          <form className="space-y-6">
            <div className="rounded-xl border border-border bg-bg-light p-4 px-5 shadow-sm space-y-4">
              <h3 className="text-[15px] font-bold text-primary">Tipo de espacio</h3>
              <div className={`grid gap-3 ${editPostModeLock === "room" ? "" : "sm:grid-cols-2"}`}>
                <button
                  type="button"
                  onClick={() => {
                    track("publish_mode_selected", { mode: "room", create_flow: "ai" });
                    setDraft((d) => ({
                      ...d,
                      postMode: "room",
                      roomCreateFlow: "ai",
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
                    }));
                  }}
                  className={`min-h-24 w-full rounded-2xl border-2 px-4 py-5 text-left transition ${
                    draft.postMode === "room"
                      ? "border-secondary bg-secondary/10 ring-2 ring-secondary/40"
                      : "border-border bg-surface hover:bg-surface-elevated"
                  }`}
                >
                  <div className="text-base font-bold text-primary">Un cuarto o Loft</div>
                  <p className="mt-2 text-xs text-muted">
                    Publica un cuarto o Loft de forma rápida y sencilla. Ideal para la búsqueda ocasional de un roomie.
                  </p>
                  <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-body">
                    <FacebookMark className="mt-0.5 size-3.5 shrink-0" />
                    <span>Mejor opción para crear un post desde tu publicación de Facebook.</span>
                  </p>
                </button>
                {editPostModeLock !== "room" ? (
                <button
                  type="button"
                  onClick={() => {
                    track("publish_mode_selected", { mode: "property", create_flow: "ai" });
                    setAiHints((h) => sanitizeAiHintsForVariant(h, "property"));
                    setDraft((d) => {
                      if (d.postMode === "property") return forgetManualRoomCreateChoice(d);
                      return applyPropertyRentRoomCount(
                        syncPropertyRoomSlotsToTotal(
                          {
                            ...d,
                            postMode: "property",
                            roomCreateFlow: "ai",
                            rooms: [defaultRoom()],
                            roomImageUrls: [[]],
                          },
                          defaultRoom,
                        ),
                        1,
                        defaultRoom,
                      );
                    });
                  }}
                  className={`min-h-24 w-full rounded-2xl border-2 px-4 py-5 text-left transition ${
                    draft.postMode === "property"
                      ? "border-secondary bg-secondary/10 ring-2 ring-secondary/40"
                      : "border-border bg-surface hover:bg-surface-elevated"
                  }`}
                >
                  <div className="text-base font-bold text-primary">Propiedad con múltiples cuartos</div>
                  <p className="mt-2 text-xs text-muted">
                    Publica varios cuartos dentro de una misma propiedad. Ideal para viviendas con muchos roomies o alta rotación.
                  </p>
                </button>
                ) : null}
              </div>
            </div>
          </form>
        ),
      };
      if (aiRoomFlow) {
        return [
          typeStep,
          {
            title: WIZARD_STEP_TITLES.AI_INPUT,
            body: (
              <AiRoomCreateStep
                city={draft.city}
                onCityChange={(city) => setDraft((d) => ({ ...d, city: city as Draft["city"] }))}
                text={aiSourceText}
                onTextChange={setAiSourceText}
                hints={aiHints}
                onHintsChange={setAiHints}
                photos={aiPhotos}
                onPhotosChange={setAiPhotos}
                infographics={aiInfographics}
                onInfographicsChange={setAiInfographics}
                variant={draft.postMode === "property" ? "property" : "room"}
                onFillManually={() => {
                  track("publish_manual_flow_selected", { from: "ai_step", mode: draft.postMode });
                  setDraft((d) => ({ ...d, roomCreateFlow: "manual" }));
                }}
              />
            ),
          },
          {
            title: WIZARD_STEP_TITLES.REVIEW,
            body: null,
          },
        ];
      }
      return [
        typeStep,
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
                  Indica dónde se ubica tu espacio.
                </p>

                {/* Address search — optional; also filled from reverse-geocode after the pin moves */}
                <div className="mt-3">
                  <WizardAddressSearch
                    cityCode={cityToCode(draft.city)}
                    syncAddress={addressFieldText}
                    onQueryChange={(query) => {
                      if (query.trim()) {
                        locationSourceRef.current = "search";
                        setAddressFieldText(query);
                      } else {
                        locationSourceRef.current = "map";
                        setAddressFieldText("");
                      }
                    }}
                    onSelect={({ lat, lng, zoom, neighborhood, label }) => {
                      locationSourceRef.current = "search";
                      setStreetViewViewerReady(true);
                      setAddressFieldText(label);
                      setMapZoom(zoom);
                      setDraft((d) => {
                        const cur = d.neighborhood.trim();
                        const auto = neighborhoodAutofillFromPinRef.current;
                        const canAutoFill = cur === "" || (auto !== null && cur === auto.value);
                        return {
                          ...d,
                          useCustomMapPin: true,
                          customLat: lat.toFixed(7),
                          customLng: lng.toFixed(7),
                          streetViewPov: undefined,
                          ...(canAutoFill && neighborhood ? { neighborhood } : {}),
                        };
                      });
                    }}
                  />
                </div>

                <p className="mt-2 text-xs text-muted">
                  {draft.isApproximateLocation
                    ? "Mueve el mapa para colocar el área de privacidad. La dirección se completa al mover el mapa."
                    : "Escribe tu dirección o mueve el mapa. La dirección se completa sola al colocar el pin."}
                </p>

                {/* Map with crosshair (industry-standard mobile UX) */}
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
                    showAddressFooter={false}
                    onPositionChange={(lat, lng) => {
                      locationSourceRef.current = "map";
                      setStreetViewViewerReady(true);
                      setDraft((d) => ({
                        ...d,
                        useCustomMapPin: true,
                        customLat: lat.toFixed(7),
                        customLng: lng.toFixed(7),
                        streetViewPov: undefined,
                      }));
                    }}
                    showApproximateRadius={draft.isApproximateLocation}
                    approximateRadiusMeters={draft.approximateRadiusMeters}
                    radiusEditable={draft.isApproximateLocation}
                    interactionMode="crosshair"
                    zoom={mapZoom}
                  />
                </div>

                <h3 className="mt-4 text-sm font-bold text-primary border-b border-border pb-1">
                  Nivel de privacidad
                </h3>
                <label className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3 cursor-pointer transition hover:bg-surface-elevated">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-secondary focus:outline-none focus:ring-2 focus:ring-border focus:ring-offset-0"
                    checked={draft.isApproximateLocation}
                    onChange={(e) => {
                      const hideExact = e.target.checked;
                      setDraft((d) => ({
                        ...d,
                        isApproximateLocation: hideExact,
                        approximateRadiusMeters: hideExact
                          ? clampApproximateRadiusMeters(d.approximateRadiusMeters)
                          : d.approximateRadiusMeters,
                        ...(hideExact ? { streetViewPov: undefined } : {}),
                      }));
                    }}
                  />
                  <div>
                    <span className="block text-sm font-semibold text-primary">
                      Ocultar dirección exacta en el anuncio
                    </span>
                    <span className="block text-xs text-muted">
                      Para proteger tu dirección exacta, el marcador público aparecerá en un punto aleatorio
                      dentro del perímetro que elijas en el mapa (entre 100 y 1&nbsp;000 m).
                    </span>
                  </div>
                </label>

                {draft.isApproximateLocation ? (
                  <div className="space-y-3 transition-opacity duration-200">
                    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <label htmlFor="privacy-radius-slider" className="text-xs font-semibold text-body">
                          Radio de privacidad
                        </label>
                        <span className="text-xs font-medium tabular-nums text-primary">
                          {draft.approximateRadiusMeters} m
                        </span>
                      </div>
                      <input
                        id="privacy-radius-slider"
                        type="range"
                        min={APPROXIMATE_LOCATION_RADIUS_MIN_M}
                        max={APPROXIMATE_LOCATION_RADIUS_MAX_M}
                        step={10}
                        value={draft.approximateRadiusMeters}
                        onChange={(e) => {
                          setDraft((d) => ({
                            ...d,
                            approximateRadiusMeters: clampApproximateRadiusMeters(Number(e.target.value)),
                          }));
                        }}
                        className="mt-2 h-2 w-full cursor-pointer accent-secondary"
                        aria-valuemin={APPROXIMATE_LOCATION_RADIUS_MIN_M}
                        aria-valuemax={APPROXIMATE_LOCATION_RADIUS_MAX_M}
                        aria-valuenow={draft.approximateRadiusMeters}
                        aria-label="Radio de privacidad en metros"
                      />
                      <div className="mt-1 flex justify-between text-[10px] text-muted">
                        <span>{APPROXIMATE_LOCATION_RADIUS_MIN_M} m</span>
                        <span>{APPROXIMATE_LOCATION_RADIUS_MAX_M} m</span>
                      </div>
                    </div>
                    <p className="rounded-lg border border-border bg-surface-elevated p-3 text-xs text-muted">
                      El mapa de búsqueda mostrará un pin con una ubicación aleatoria dentro del perímetro de{" "}
                      {draft.approximateRadiusMeters} m. Mueve el mapa para ubicar el área y usa el control de radio
                      para ajustar el tamaño del perímetro.
                    </p>
                  </div>
                ) : null}

                {!draft.isApproximateLocation && draft.useCustomMapPin ? (() => {
                  const { lat, lng } = resolveLatLngForDraft(draft);
                  if (!streetViewViewerReady) {
                    return (
                      <p className="mt-8 text-sm text-muted">
                        Mueve el pin o busca una dirección para abrir la vista de calle.
                      </p>
                    );
                  }
                  return (
                    <div className="transition-opacity duration-200">
                      <h3 className="mt-8 mb-3 text-lg font-semibold text-body">
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
                      <p className="mt-2 text-sm text-body">
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
                  Título, ubicación y descripción general de la propiedad. Las recámaras se configuran en el paso 3.
                </p>
              ) : null}
              <label className="block text-sm font-medium text-body">
                Título del anuncio
                <span className="text-error"> *</span>
                <input
                  value={draft.propertyTitle}
                  onChange={(e) => setDraft((d) => ({ ...d, propertyTitle: e.target.value }))}
                  maxLength={PROPERTY_TITLE_MAX}
                  placeholder="Ej. Casa compartida Chapalita / Depa zona Minerva"
                  className={WIZARD_FIELD_CONTROL_CLASS}
                />
                <FieldCharCount
                  current={draft.propertyTitle.trim().length}
                  min={PROPERTY_TITLE_MIN}
                  max={PROPERTY_TITLE_MAX}
                  warnBelowMin
                  size="xxs"
                  className="mt-1"
                />
              </label>
              <ListingPhoneCaptureFields
                contactWhatsApp={draft.contactWhatsApp}
                showWhatsApp={draft.showWhatsApp}
                onContactChange={(national) =>
                  setDraft((d) => ({ ...d, contactWhatsApp: national }))
                }
                onShowChange={(show) => setDraft((d) => ({ ...d, showWhatsApp: show }))}
                profilePhoneE164={me?.phoneE164}
                saveToProfile={savePhoneToProfile}
                onSaveToProfileChange={setSavePhoneToProfile}
                embedded
              />
              <label className="block text-sm font-medium text-body">
                Colonia o zona
                <span className="text-error"> *</span>
                <input
                  value={draft.neighborhood}
                  onChange={(e) => setDraft((d) => ({ ...d, neighborhood: e.target.value }))}
                  maxLength={PROPERTY_NEIGHBORHOOD_MAX}
                  placeholder="Ej. Chapultepec, Versalles…"
                  className={WIZARD_FIELD_CONTROL_CLASS}
                />
              </label>
              {draft.postMode === "property" ? (
                <>
                  <label className="block text-sm font-medium text-body">
                    El ambiente y las áreas comunes
                    <span className="text-error"> *</span>
                    <ResizableTextarea
                      value={draft.propertySummary}
                      onChange={(e) => setDraft((d) => ({ ...d, propertySummary: e.target.value }))}
                      rows={6}
                      maxLength={PROPERTY_SUMMARY_MAX}
                      placeholder={DEFAULT_PROPERTY_SUMMARY}
                      containerClassName="mt-2"
                      className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
                    />
                    <p className="mt-1 text-xs text-muted">
                      Solo convivencia y zonas compartidas (cada recámara se describe en el paso 3).
                    </p>
                    <FieldCharCount
                      current={draft.propertySummary.trim().length}
                      min={PROPERTY_SUMMARY_MIN}
                      max={PROPERTY_SUMMARY_MAX}
                      warnBelowMin
                      className="mt-1"
                    />
                  </label>

                  <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                    <div className="mb-4 border-l-4 border-primary/40 bg-primary/5 p-4 text-sm leading-snug text-body">
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
                <span className="text-error"> *</span>
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
                  className={WIZARD_FIELD_CONTROL_CLASS}
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
                className={`grid items-start gap-4 ${showWizardPropertyBathroomsField(draft) ? "sm:grid-cols-2" : ""}`}
              >
                <div className="block text-sm font-medium text-body">
                  <WizardPairedFieldLabel>
                    ¿Cuántas recámaras tiene la propiedad?
                    <span className="text-error"> *</span>
                  </WizardPairedFieldLabel>
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
                  <span className="mt-1 block text-xs font-normal text-muted">
                    Incluye recámaras habitadas + disponibles
                  </span>
                </div>
                {showWizardPropertyBathroomsField(draft) ? (
                  <div className="block text-sm font-medium text-body">
                    <WizardPairedFieldLabel>
                      {draft.propertyKind === "loft" ? "Baños" : "Baños (total)"}
                      <span className="text-error"> *</span>
                    </WizardPairedFieldLabel>
                    <WizardNumberStepper
                      editableCenter
                      step={0.5}
                      value={Math.min(
                        PROPERTY_BATHROOMS_MAX,
                        Math.max(0, draft.propertyBathrooms),
                      )}
                      min={0}
                      max={PROPERTY_BATHROOMS_MAX}
                      onChange={(n) =>
                        setDraft((d) => ({
                          ...d,
                          propertyBathrooms: n,
                        }))
                      }
                      decrementLabel="Menos baños"
                      incrementLabel="Más baños"
                    />
                  </div>
                ) : null}
              </div>
              ) : null}
              <div className="mt-4 space-y-4 border-t border-border pt-4">
                <TagChoiceSection
                  title="La propiedad cuenta con:"
                  tags={WIZARD_PROPERTY_AMENITY_SLUGS}
                  selected={draft.propertyTags}
                  onToggle={(tag) => setDraft((d) => togglePropertyTag(d, tag))}
                />
                <TagChoiceSection
                  title="Se permite:"
                  tags={WIZARD_PROPERTY_PERMITIDO_SLUGS}
                  selected={draft.propertyTags}
                  onToggle={(tag) => setDraft((d) => togglePropertyTag(d, tag))}
                />
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
              preferOccupiedFirst={false}
              onRentRoomCountChange={setPropertyRentRoomCount}
              onOccupancyStatusChange={(roomIndex, status) =>
                setDraft((d) => setRoomOccupancyStatus(d, roomIndex, status))
              }
              onUpdateRoom={updateRoom}
              onRoomPhotosChange={(roomIndex, photos) =>
                setDraft((d) =>
                  syncDraftPhotoFields({
                    ...d,
                    rooms: d.rooms.map((room, i) => (i === roomIndex ? { ...room, photos } : room)),
                    roomImageUrls: d.roomImageUrls.map((row, i) => (i === roomIndex ? photos : row)),
                  }),
                )
              }
              onToggleTag={(roomIndex, tag, active) =>
                setDraft((d) => toggleRoomTag(d, roomIndex, tag, active))
              }
              onHidePricingChange={(hide) =>
                setDraft((d) =>
                  applyDraftHidePricing(d, hide, { hasChat: !unclaimedAdminOutreach, requireContact: false }),
                )
              }
              hasChat={!unclaimedAdminOutreach}
              requireContact={false}
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
                      className="text-xs font-semibold text-error hover:underline"
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
                      <span className="text-error"> *</span>
                      <input
                        value={room.title}
                        onChange={(e) => updateRoom(i, { title: e.target.value })}
                        placeholder={roomTitlePlaceholder(room)}
                        className={WIZARD_FIELD_CONTROL_CLASS}
                      />
                    </label>
                  ) : null}
                  <div className="mt-3 grid items-start gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-body">
                      {draft.postMode === "room" ? "Tipo de recámara" : "Tipo de espacio"}
                      <span className="text-error"> *</span>
                      <select
                        value={
                          draft.postMode === "room" && room.lodgingType === "whole_home"
                            ? "private_room"
                            : room.lodgingType
                        }
                        onChange={(e) =>
                          updateRoom(i, { lodgingType: e.target.value as LodgingType })
                        }
                        className={WIZARD_FIELD_CONTROL_CLASS}
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
                      <span className="text-error"> *</span>
                      <select
                        value={room.roomDimension}
                        onChange={(e) =>
                          updateRoom(i, { roomDimension: e.target.value as RoomDimension })
                        }
                        className={WIZARD_FIELD_CONTROL_CLASS}
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
                    <div className="sm:col-span-2">
                      <HidePricingToggle
                        hidePricing={Boolean(draft.hidePricing)}
                        contactOk={draftHidePricingContactOk(draft, {
                          hasChat: !unclaimedAdminOutreach,
                          requireContact: false,
                        })}
                        onChange={(hide) =>
                          setDraft((d) =>
                            applyDraftHidePricing(d, hide, {
                              hasChat: !unclaimedAdminOutreach,
                              requireContact: false,
                            }),
                          )
                        }
                      />
                    </div>
                    <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-body">
                          Renta (MXN / mes)
                          {draft.hidePricing ? (
                            <span className="font-normal text-muted"> (opcional)</span>
                          ) : (
                            <span className="text-error"> *</span>
                          )}
                          <input
                            type="number"
                            min={0}
                            step={100}
                            value={room.rentMxn === 0 ? "" : room.rentMxn}
                            onChange={(e) =>
                              updateRoom(i, { rentMxn: Math.max(0, Number(e.target.value) || 0) })
                            }
                            className={WIZARD_FIELD_CONTROL_CLASS}
                          />
                        </label>
                      </div>
                      <label className="block text-sm font-medium text-body">
                        Depósito (MXN)
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={room.depositMxn === 0 ? "" : room.depositMxn}
                          onChange={(e) =>
                            updateRoom(i, { depositMxn: Math.max(0, Number(e.target.value) || 0) })
                          }
                          placeholder="0"
                          className={WIZARD_FIELD_CONTROL_CLASS}
                        />
                      </label>
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-elevated/50 px-3 py-2.5 text-body">
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
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-elevated/50 px-3 py-2.5 text-body">
                        <input
                          type="checkbox"
                          checked={room.avalRequired}
                          onChange={(e) => updateRoom(i, { avalRequired: e.target.checked })}
                          className="mt-0.5 size-4 shrink-0 rounded border-border text-primary"
                        />
                        <span>
                          <span className="block text-sm font-medium text-body">Se requiere aval</span>
                          <span className="mt-0.5 block text-xs text-muted leading-snug">
                            Activa esta opción si para rentar esta recámara es obligatorio presentar aval.
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-border bg-surface p-4 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-primary">
                    Disponibilidad
                  </h3>
                  <div className="grid items-start gap-3 sm:grid-cols-3">
                    {draft.postMode === "property" ? (
                      <div className="block text-sm font-medium text-body">
                        <WizardPairedFieldLabel>
                          Plazas / espacios
                          <span className="text-error"> *</span>
                        </WizardPairedFieldLabel>
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
                      <WizardPairedFieldLabel>
                        Disponible desde
                        <span className="text-error"> *</span>
                      </WizardPairedFieldLabel>
                      <input
                        type="date"
                        value={room.availableFrom}
                        onChange={(e) => updateRoom(i, { availableFrom: e.target.value })}
                        className={WIZARD_FIELD_CONTROL_CLASS}
                      />
                    </label>
                    <div className="block text-sm font-medium text-body">
                      <WizardPairedFieldLabel>
                        Estancia mín. (meses)
                        <span className="text-error"> *</span>
                      </WizardPairedFieldLabel>
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
                  <div className="grid items-start gap-3 sm:grid-cols-3">
                    <label className="block text-sm font-medium text-body">
                      <WizardPairedFieldLabel>
                        {ROOMMATE_GENDER_PREF_FIELD_LABEL_SHORT}
                        <span className="text-error"> *</span>
                      </WizardPairedFieldLabel>
                      <select
                        value={room.roommateGenderPref}
                        onChange={(e) =>
                          updateRoom(i, {
                            roommateGenderPref: e.target.value as RoommateGenderPref,
                          })
                        }
                        className={WIZARD_FIELD_CONTROL_CLASS}
                      >
                        <option value="any">Sin preferencia</option>
                        <option value="female">Mujeres</option>
                        <option value="male">Hombres</option>
                      </select>
                    </label>
                    <div className="block text-sm font-medium text-body">
                      <WizardPairedFieldLabel>
                        Edad mín.
                        <span className="text-error"> *</span>
                      </WizardPairedFieldLabel>
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
                      <WizardPairedFieldLabel>
                        Edad máx.
                        <span className="text-error"> *</span>
                      </WizardPairedFieldLabel>
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
                    <span className="text-error"> *</span>
                    <ResizableTextarea
                      value={room.summary}
                      onChange={(e) => updateRoom(i, { summary: e.target.value })}
                      rows={6}
                      maxLength={ROOM_SUMMARY_MAX}
                      placeholder={ROOM_SUMMARY_PLACEHOLDER}
                      containerClassName="mt-1"
                      className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                    />
                    <FieldCharCount
                      current={room.summary.trim().length}
                      min={ROOM_SUMMARY_MIN}
                      max={ROOM_SUMMARY_MAX}
                      warnBelowMin
                      className="mt-1"
                    />
                  </label>
                  <div className="mt-3 space-y-4">
                    {WIZARD_ROOM_TAG_GROUPS.map((group) => (
                      <TagChoiceSection
                        key={group.title}
                        title={group.title}
                        tags={group.tags}
                        selected={room.tags}
                        onToggle={(tag, active) => setDraft((d) => toggleRoomTag(d, i, tag, active))}
                      />
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
                        images={draftRoomEditorImages(draft, i)}
                        maxCount={20}
                        apiOn={apiOn}
                        hint={ROOM_SINGLE_FLOW_PHOTO_HINT}
                        onImagesChange={(next) => {
                          setDraft((d) =>
                            syncDraftPhotoFields({
                              ...d,
                              rooms: d.rooms.map((r, ri) => (ri === i ? { ...r, photos: next } : r)),
                              roomImageUrls: d.roomImageUrls.map((row, ri) =>
                                ri === i ? next : row,
                              ),
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
    ];
    },
    [draft, apiOn, mapAddressShown, mapGeocode, addressFieldText, mapZoom, streetViewViewerReady, expandedPropertyRoomIndex, submitInFlight, editPropertyId, editingLiveProperty, editPostModeLock, me, aiRoomFlow, aiSourceText, aiHints, aiPhotos, aiInfographics],
  );

  const maxStepIndex = Math.max(0, steps.length - 1);
  const safeStep = Math.min(Math.max(0, step), maxStepIndex);
  const current = steps[safeStep]!;

  useEffect(() => {
    if (safeStep !== WIZARD_STEP_POST_MODE) return;
    if (editingLiveProperty || editPropertyId) return;
    setDraft((d) => forgetManualRoomCreateChoice(d));
  }, [safeStep, editingLiveProperty, editPropertyId]);

  const isPublishStep = current.title === "Revisar y publicar";
  const showWizardProgress = safeStep >= WIZARD_FIRST_NUMBERED_STEP;
  const progressSteps = steps.slice(WIZARD_FIRST_NUMBERED_STEP);
  const showListingPreviewEditor =
    Boolean(editPropertyId) &&
    editBundleReady &&
    Boolean(serverSync.propertyId) &&
    (Boolean(editingLiveProperty) || previewEditorIntent || fromAdminPosts);

  useEffect(() => {
    if (safeStep !== WIZARD_FIRST_NUMBERED_STEP) {
      setStreetViewViewerReady(false);
    }
  }, [safeStep]);

  const autofillStep = useCallback(
    (stepIndex: number) => {
      if (aiRoomFlow && stepIndex === 1) {
        const seed = draft.postMode === "property" ? seedAiPropertyForm() : seedAiRoomForm();
        setAiSourceText(seed.text);
        setAiHints(seed.hints);
        setAiPhotos(seed.photos);
        setAiInfographics(seed.infographics);
        setPublishErr(null);
        setDraft((d) => (d.city === "Guadalajara" ? d : { ...d, city: "Guadalajara" }));
        return;
      }
      setDraft((d) => normalizePersistedDraft({ ...d, ...seedForStep(stepIndex, d) }));
    },
    [aiRoomFlow, draft.postMode],
  );

  /** Figma/dev: deep-link wizard step and mode (e.g. `/publicar?publishMode=room&publishStep=2`). */
  const publishModeParam = searchParams.get("publishMode");

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
      if (publishModeParam === "property") {
        if (editPostModeLock === "room") return d;
        if (d.postMode === "property") return d;
        return {
          ...d,
          postMode: "property",
          rooms: [defaultRoom()],
          roomImageUrls: [[]],
        };
      }
      return d;
    });
  }, [publishModeParam, editPostModeLock]);

  useEffect(() => {
    if (draft.postMode !== "property") return;
    setAiHints((h) => sanitizeAiHintsForVariant(h, "property"));
  }, [draft.postMode]);

  useEffect(() => {
    if (previewEditorIntent || editingLiveProperty) return;
    const n = readWizardPasoIndex(searchParams);
    if (n == null) return;
    setStep(Math.min(n, maxStepIndex));
  }, [searchParams, maxStepIndex, previewEditorIntent, editingLiveProperty]);

  useLayoutEffect(() => {
    if (step !== safeStep) {
      setStep(safeStep);
    }
  }, [step, safeStep]);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [step]);

  const hidePricingHasChat = !(Boolean(me?.isAdmin) && unclaimedAdminOutreach);
  const publishBlockedReason = useMemo(
    () => getPublishBlockedReason(draft, { hasChat: hidePricingHasChat }),
    [draft, hidePricingHasChat],
  );

  const currentAiComposeSnapshot = useMemo(
    () =>
      captureAiComposeSnapshot({
        text: aiSourceText,
        city: draft.city,
        hints: sanitizeAiHintsForVariant(aiHints, draft.postMode === "property" ? "property" : "room"),
        photos: aiPhotos,
        infographics: aiInfographics,
      }),
    [aiSourceText, draft.city, draft.postMode, aiHints, aiPhotos, aiInfographics],
  );
  const aiWillRecompose = Boolean(
    aiDidCompose &&
      aiComposeSnapshot &&
      aiComposeNeedsRegenerate(aiComposeSnapshot, currentAiComposeSnapshot),
  );

  async function submitAiCompose() {
    if (me === undefined) return;
    if (!me) {
      openAuthModal(window.location.pathname + window.location.search);
      setPublishErr("Inicia sesión para armar el anuncio con IA. Después de entrar, el post queda a tu nombre.");
      return;
    }
    if (!aiSourceText.trim() && aiInfographics.length === 0) {
      setPublishErr(
        "Pega el texto de tu publicación o agrega un infográfico, poster o mapa. También puedes llenar los datos a mano.",
      );
      return;
    }
    if (aiDidCompose && aiComposeSnapshot && !aiComposeNeedsRegenerate(aiComposeSnapshot, currentAiComposeSnapshot)) {
      if (aiComposeSnapshot.photosKey !== currentAiComposeSnapshot.photosKey) {
        const nextDraft = applyAiGalleryUrls(
          draftRef.current,
          urlsFromAiLocalImages(aiPhotos, aiInfographics),
        );
        draftRef.current = nextDraft;
        setDraft(nextDraft);
        setAiComposeSnapshot(currentAiComposeSnapshot);
      }
      setPublishErr(null);
      setStep(lastWizardStep(draftRef.current));
      return;
    }
    setAiComposeInFlight(true);
    setPublishErr(null);
    try {
      const galleryForCompose = await hydrateLocalImagesForCompose(aiPhotos);
      const infographicsForCompose = await hydrateLocalImagesForCompose(aiInfographics);
      const composeHints = sanitizeAiHintsForVariant(
        aiHints,
        draft.postMode === "property" ? "property" : "room",
      );
      const result = await selfComposeAssistedDraft({
        text: aiSourceText.trim() || undefined,
        city: draft.city,
        postMode: draft.postMode,
        hints: {
          lodgingType: composeHints.lodgingType,
          loft: composeHints.loft,
          tagsOn: composeHints.tagsOn,
          gender: composeHints.gender,
          roomsForRent: draft.postMode === "property" ? composeHints.roomsForRent : undefined,
          roomsOccupied: draft.postMode === "property" ? composeHints.roomsOccupied : undefined,
        },
        photos: toComposeImages(galleryForCompose),
        infographicPhotos: toComposeImages(infographicsForCompose),
        existingToken: assistedDraftTokenRef.current || undefined,
      });
      try {
        await activateAssistedDraftClaim(result.token);
      } catch {
        /* already activated */
      }
      const info = await fetchAssistedDraftClaim(result.token);
      const mapped = draftFromPropertyBundle(claimInfoToBundle(info));
      const nextDraft: Draft = applyProfilePhoneIfMissing(
        applyAiLocalGalleryIfMissing(
          { ...mapped.draft, roomCreateFlow: "ai", city: draft.city },
          galleryForCompose,
          infographicsForCompose,
        ),
        meRef.current?.phoneE164,
      );
      const resumeStep = lastWizardStep(nextDraft);
      setAssistedDraftToken(result.token);
      writeAssistedDraftClaimToken(result.token);
      draftRef.current = nextDraft;
      setDraft(nextDraft);
      setServerSync(mapped.serverSync);
      setAiConflicts(result.conflicts);
      setAiDidCompose(true);
      setAiComposeSnapshot(currentAiComposeSnapshot);
      writeAssistedDraftClaimSession({
        token: result.token,
        draft: nextDraft,
        serverSync: mapped.serverSync,
        step: resumeStep,
      });
      try {
        sessionStorage.setItem(`bestie-ai-conflicts:${result.token}`, JSON.stringify(result.conflicts));
      } catch {
        /* quota */
      }
      markAutosaveBaseline(nextDraft);
      setStep(resumeStep);
      track("publish_ai_compose_ok", { conflict_count: result.conflicts.length, mode: draft.postMode, create_flow: "ai" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setPublishErr(
        msg === "rate_limited"
          ? "Demasiados intentos. Espera un momento y vuelve a intentar."
          : "No pudimos armar el anuncio. Reintenta o llena los datos a mano.",
      );
      track("publish_ai_compose_fail", { error: msg, mode: draft.postMode, create_flow: "ai" });
    } finally {
      setAiComposeInFlight(false);
    }
  }

  async function submitAdminOutreachWithEvidence(file: File, note?: string) {
    setPublishErr(null);
    const blocked = getPublishBlockedReason(draftRef.current, { hasChat: false });
    if (blocked) {
      setPublishErr(blocked);
      return;
    }
    const claimToken = assistedDraftTokenRef.current;
    setSubmitInFlight("publish");
    try {
      if (apiOn && claimToken) {
        const syncedDraft = await syncAssistedDraftClaimToServer(
          claimToken,
          draftRef.current,
          serverSyncRef.current.roomIds,
        );
        setDraft(syncedDraft);
        markAutosaveBaseline(syncedDraft, { touchUi: true });
        rememberClaimSyncedDraft(claimToken, syncedDraft);
      } else if (apiOn) {
        const synced = await syncDraftToServer(
          draftRef.current,
          serverSyncRef.current,
          meRef.current?.phoneE164,
          { wizardStep: step },
        );
        serverSyncRef.current = synced.serverSync;
        setServerSync(synced.serverSync);
        setDraft(synced.draft);
        markAutosaveBaseline(synced.draft, { touchUi: true });
      }
      const propertyId = serverSyncRef.current.propertyId;
      if (!propertyId) {
        setPublishErr("No encontramos el anuncio para publicar con evidencia.");
        setSubmitInFlight(null);
        return;
      }
      const published = await adminPublishUnclaimed(propertyId, file, note);
      if (claimToken) clearAssistedDraftClaimSession(claimToken);
      leaveWizardForSuccessRef.current = true;
      autosaveGenerationRef.current += 1;
      if (fromAdminPostsRef.current) {
        navigate(adminSectionPath("property"), { replace: true, flushSync: true });
        return;
      }
      const claimedRoomId = firstNonEmptyId(...serverSyncRef.current.roomIds);
      const claimedTitle =
        (draftRef.current.postMode === "property"
          ? draftRef.current.propertyTitle
          : draftRef.current.rooms[0]?.title
        )?.trim() || "Anuncio publicado";
      navigate(
        publishWizardSuccessPath({
          scope:
            draftRef.current.postMode === "property" || !claimedRoomId
              ? "property"
              : "room",
          propertyId: published.propertyId,
          roomId: claimedRoomId,
        }),
        {
          replace: true,
          flushSync: true,
          state: withMyListingsReturn(
            {
              publishedTitle: claimedTitle,
              ...(fromAdminPostsRef.current ? { fromAdminPosts: true } : {}),
            },
            myListingsReturnRef.current,
          ),
        },
      );
    } catch (e) {
      setPublishErr(listingsHttpErrorMessage(e, "No se pudo publicar."));
      setSubmitInFlight(null);
    }
  }

  async function submitPublish() {
    setPublishErr(null);

    // ── Assisted-draft claim flow ─────────────────────────────────────────
    if (assistedDraftTokenRef.current) {
      const claimToken = assistedDraftTokenRef.current;
      if (me === undefined) {
        setPublishErr("Comprobando tu sesión… intenta de nuevo en un momento.");
        return;
      }
      const blocked = getPublishBlockedReason(draftRef.current, { hasChat: hidePricingHasChat });
      if (blocked) {
        setPublishErr(blocked);
        return;
      }
      if (!me) {
        // Persist edits with the claim token so refresh / sign-in keep renta and other fields.
        setSubmitInFlight("draft");
        try {
          if (apiOn) {
            const syncedDraft = await syncAssistedDraftClaimToServer(
              claimToken,
              draftRef.current,
              serverSyncRef.current.roomIds,
            );
            setDraft(syncedDraft);
            markAutosaveBaseline(syncedDraft, { touchUi: true });
            rememberClaimSyncedDraft(claimToken, syncedDraft);
          }
        } catch {
          setPublishErr("No se pudieron guardar los cambios. Revisa tu conexión e intenta de nuevo.");
          setSubmitInFlight(null);
          return;
        }
        setSubmitInFlight(null);
        openAuthModal(`/borrador/${claimToken}?publish=1`);
        return;
      }
      if (me?.isAdmin && unclaimedAdminOutreach) {
        setPublishErr(
          "Adjunta una captura de consentimiento para publicar este anuncio de crecimiento.",
        );
        return;
      }
      // Authed: sync, then publish via claim endpoint
      setSubmitInFlight("publish");
      try {
        if (apiOn) {
          const syncedDraft = await syncAssistedDraftClaimToServer(
            claimToken,
            draftRef.current,
            serverSyncRef.current.roomIds,
          );
          setDraft(syncedDraft);
          markAutosaveBaseline(syncedDraft, { touchUi: true });
          rememberClaimSyncedDraft(claimToken, syncedDraft);
        }
        const claimed = await publishAssistedDraftClaim(claimToken);
        clearAssistedDraftClaimSession(claimToken);
        leaveWizardForSuccessRef.current = true;
        autosaveGenerationRef.current += 1;
        const claimedRoomId = firstNonEmptyId(...serverSyncRef.current.roomIds);
        const claimedTitle =
          (draftRef.current.postMode === "property"
            ? draftRef.current.propertyTitle
            : draftRef.current.rooms[0]?.title
          )?.trim() || "Anuncio publicado";
        navigate(
          publishWizardSuccessPath({
            scope:
              draftRef.current.postMode === "property" || !claimedRoomId
                ? "property"
                : "room",
            propertyId: claimed.propertyId,
            roomId: claimedRoomId,
          }),
          {
            replace: true,
            flushSync: true,
            state: withMyListingsReturn({ publishedTitle: claimedTitle }, myListingsReturnRef.current),
          },
        );
      } catch (e) {
        const msg = listingsHttpErrorMessage(e, "No se pudo publicar.");
        setPublishErr(
          isRentRequiredPublishError(msg)
            ? firstRoomIndexMissingRent(draftRef.current) >= 0
              ? rentRequiredPublishMessage(draftRef.current.postMode)
              : "No se pudieron guardar los precios de las recámaras. Intenta publicar de nuevo."
            : msg,
        );
        setSubmitInFlight(null);
      }
      return;
    }

    // When saving a single room of an already-published property, skip the cross-room
    // validation so that incomplete sibling rooms don't block saving this room's edits.
    const skipRoomValidation = Boolean(editingLiveProperty) && liveEditScope === "room";
    const blocked = getPublishBlockedReason(draftRef.current, {
      skipRoomValidation,
      hasChat: hidePricingHasChat,
    });
    if (blocked) {
      setPublishErr(blocked);
      track("publish_failed", { mode: draftRef.current.postMode,
        reason: "blocked_validation", create_flow: createFlowRef.current });
      return;
    }
    if (me === undefined) {
      setPublishErr("Comprobando tu sesión… intenta de nuevo en un momento.");
      return;
    }
    if (!me) {
      track("publish_auth_required", { intent: "publish",
        mode: draftRef.current.postMode, create_flow: createFlowRef.current });
      setSubmitInFlight("draft");
      try {
        let resumeDraft = draftRef.current;
        if (apiOn) {
          const synced = await syncDraftToServer(
            draftRef.current,
            serverSyncRef.current,
            meRef.current?.phoneE164,
            { wizardStep: step },
          );
          serverSyncRef.current = synced.serverSync;
          setServerSync(synced.serverSync);
          setDraft(synced.draft);
          markAutosaveBaseline(synced.draft, { touchUi: true });
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
        track("publish_failed", { mode: draftRef.current.postMode,
          reason: "guest_draft_save", create_flow: createFlowRef.current });
      } finally {
        setSubmitInFlight(null);
      }
      return;
    }

    if (me?.isAdmin && unclaimedAdminOutreach) {
      setPublishErr(
        "Adjunta una captura de consentimiento para publicar este anuncio de crecimiento.",
      );
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
        wizardStep: step,
        skipRoomValidation: Boolean(editingLiveProperty) && liveEditScope === "room",
      });
      if (result.kind === "published") {
        track("publish_succeeded", { mode: draftRef.current.postMode,
          editing_live: Boolean(editingLiveProperty), create_flow: createFlowRef.current });
        const roomIdx = Math.min(
          previewRoomIndex,
          Math.max(0, draftRef.current.rooms.length - 1),
        );
        const returnId = firstNonEmptyId(
          serverSyncRef.current.roomIds[roomIdx],
          liveEditReturnListingId,
          result.roomId,
        );
        const sharePath =
          draftRef.current.postMode === "property" && serverSyncRef.current.propertyId
            ? propertyPublicPath(serverSyncRef.current.propertyId)
            : returnId
              ? listingPublicPath(returnId)
              : "/mis-anuncios";

        if (editingLiveProperty && myListingsRestorePath) {
          clearLiveEditSession();
          navigate(myListingsRestorePath, {
            replace: true,
            state: {
              listingUpdated: true,
              listingUpdatedPath: sharePath,
              listingRepublished: editingLiveProperty.status === "paused",
            },
          });
          return;
        }

        if (fromAdminPostsRef.current) {
          clearLiveEditSession();
          clearWizardResumeSnapshot();
          navigate(adminSectionPath("property"), { replace: true, flushSync: true });
          return;
        }

        if (editingLiveProperty?.status === "published") {
          clearLiveEditSession();
          navigate(sharePath, {
            replace: true,
            state: withMyListingsReturn({ listingUpdated: true }, myListingsReturn),
          });
          return;
        }

        leaveWizardForSuccessRef.current = true;
        autosaveGenerationRef.current += 1;
        clearLiveEditSession();
        clearWizardResumeSnapshot();
        const successPropertyId = serverSyncRef.current.propertyId;
        const shareScope =
          draftRef.current.postMode === "property" && successPropertyId
            ? "property"
            : returnId
              ? "room"
              : "property";
        const publishedTitle =
          (draftRef.current.postMode === "property"
            ? draftRef.current.propertyTitle
            : draftRef.current.rooms[0]?.title
          )?.trim() || "Anuncio publicado";
        navigate(
          publishWizardSuccessPath({
            scope: shareScope,
            propertyId: successPropertyId,
            roomId: returnId,
          }),
          {
            replace: true,
            flushSync: true,
            state: withMyListingsReturn({ publishedTitle }, myListingsReturnRef.current),
          },
        );
        return;
      }
      if (result.kind === "error") {
        setDraft(result.draft);
        setPublishErr(result.message);
        track("publish_failed", { mode: draftRef.current.postMode,
          reason: result.message.slice(0, 120), create_flow: createFlowRef.current });
      }
    } catch (e) {
      setPublishErr(listingsHttpErrorMessage(e, "No se pudo publicar."));
      track("publish_failed", { mode: draftRef.current.postMode,
        reason: e instanceof Error ? e.message.slice(0, 120) : "unknown", create_flow: createFlowRef.current });
    } finally {
      if (!leaveWizardForSuccessRef.current) {
        setSubmitInFlight(null);
      }
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
      const claimToken = assistedDraftTokenRef.current;
      if (claimToken) {
        const syncedDraft = await syncAssistedDraftClaimToServer(
          claimToken,
          draftRef.current,
          serverSyncRef.current.roomIds,
        );
        setDraft(syncedDraft);
        markAutosaveBaseline(syncedDraft, { touchUi: true });
        rememberClaimSyncedDraft(claimToken, syncedDraft);

        if (!me) {
          track("publish_auth_required", { intent: "draft",
            mode: draftRef.current.postMode, create_flow: createFlowRef.current });
          navigate("/entrar", {
            replace: true,
            state: {
              registrationNotice:
                "Tu anuncio ya está guardado como borrador. Inicia sesión o crea una cuenta para publicarlo y recibirlo en Mis anuncios.",
              resumeDraft: syncedDraft,
              resumeServerSync: serverSyncRef.current,
              resumeStep: step,
              assistedDraftToken: claimToken,
            },
          });
          return;
        }

        track("publish_draft_saved", { mode: draftRef.current.postMode,
          finish: Boolean(opts?.finish), create_flow: createFlowRef.current });
        setWizardDraftSaveNote("saved");
        window.setTimeout(() => {
          setWizardDraftSaveNote((n) => (n === "saved" ? "idle" : n));
        }, 2500);
        return;
      }

      let resumeDraft = draftRef.current;
      const synced = await syncDraftToServer(
        draftRef.current,
        serverSyncRef.current,
        meRef.current?.phoneE164,
        { wizardStep: step },
      );
      serverSyncRef.current = synced.serverSync;
      setServerSync(synced.serverSync);
      setDraft(synced.draft);
      markAutosaveBaseline(synced.draft, { touchUi: true });
      resumeDraft = synced.draft;

      if (!me) {
        track("publish_auth_required", { intent: "draft",
          mode: draftRef.current.postMode, create_flow: createFlowRef.current });
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

      track("publish_draft_saved", { mode: draftRef.current.postMode,
        finish: Boolean(opts?.finish), create_flow: createFlowRef.current });

      if (opts?.finish) {
        navigate(
          buildMyListingsHubPath({
            tab: "draft",
            focusPropertyId: synced.serverSync.propertyId,
          }),
          { state: { draftSaved: true } },
        );
        return;
      }

      setWizardDraftSaveNote("saved");
      window.setTimeout(() => {
        setWizardDraftSaveNote((n) => (n === "saved" ? "idle" : n));
      }, 2500);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      setPublishErr(
        raw.includes("invalid_id") || raw.includes("patch_room_http")
          ? "No se pudo guardar el borrador. Recarga la página e intenta de nuevo."
          : raw || "No se pudo guardar el borrador en el servidor.",
      );
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

  if (showListingPreviewEditor) {
    const reviewRoomIndex = Math.min(previewRoomIndex, Math.max(0, draft.rooms.length - 1));
    const returnListingId =
      liveEditReturnListingId ?? serverSync.roomIds[reviewRoomIndex] ?? null;
    const autosaveTimeLabel = formatAutosaveTime(lastAutosavedAt);
    return (
      <div className="mx-auto w-full min-w-0 max-w-3xl overflow-x-clip px-4 py-8 sm:px-6 sm:py-10">
        {apiOn && (autosaveTimeLabel || autosaveNote === "error") ? (
          <WizardAutosaveIndicator
            lastSavedAt={lastAutosavedAt}
            flashKey={autosaveFlashKey}
            showRing={showAutosaveRing}
            saving={autosaveNote === "saving"}
            error={autosaveNote === "error" ? autosaveErr : null}
          />
        ) : null}
        <PublishWizardReturnLinks
          myListingsRestorePath={myListingsRestorePath}
          adminPostsRestorePath={adminPostsRestorePath}
          claimDraftReturnPath={claimDraftReturnPath}
        />
        <h1 className="text-2xl font-bold tracking-tight text-primary">
          {draft.postMode === "room"
            ? "Editar anuncio"
            : liveEditScope === "property"
              ? "Editar propiedad"
              : liveEditScope === "room"
                ? `Editar recámara ${reviewRoomIndex + 1}`
                : "Editar anuncio"}
        </h1>
        {draft.postMode === "room" && draft.propertyTitle.trim() ? (
          <p className="mt-2 text-base font-semibold text-body">{draft.propertyTitle.trim()}</p>
        ) : liveEditScope === "room" && draft.rooms[reviewRoomIndex] ? (
          <p className="mt-2 text-base font-semibold text-body">
            {roomPreviewOptionLabel(draft.rooms[reviewRoomIndex]!, reviewRoomIndex)}
            {draft.propertyTitle.trim() ? (
              <span className="font-normal text-muted"> · {draft.propertyTitle.trim()}</span>
            ) : null}
          </p>
        ) : liveEditScope === "property" && draft.propertyTitle.trim() ? (
          <p className="mt-2 text-base font-semibold text-body">{draft.propertyTitle.trim()}</p>
        ) : null}
        {handoffBanner ? (
          <p className="mt-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-fg">
            {handoffBanner}
          </p>
        ) : null}

        <div className="mt-6">
          <PublishWizardReviewStep
            draft={draft}
            roomIndex={reviewRoomIndex}
            onRoomIndexChange={setPreviewRoomIndex}
            onDraftChange={(updater) => {
              setDraft((d) => {
                const next = syncDraftPhotoFields(updater(d));
                draftRef.current = next;
                return next;
              });
              void flushWizardAutosave();
            }}
            onCommitAndPublish={(updater) => {
              const next = syncDraftPhotoFields(updater(draftRef.current));
              draftRef.current = next;
              setDraft(next);
              void flushWizardAutosave();
              void submitPublish();
            }}
            apiOn={apiOn}
            profilePhoneE164={me?.phoneE164}
            savePhoneToProfile={savePhoneToProfile}
            onSavePhoneToProfileChange={setSavePhoneToProfile}
            publishBlockedReason={publishBlockedReason}
            actionErr={publishErr}
            submitInFlight={submitInFlight}
            onSaveDraft={() => void submitServerDraft()}
            onPublish={() => void submitPublish()}
            initialEditingPhotos={liveEditEditingPhotos}
            onEditingPhotosChange={setLiveEditEditingPhotos}
            onPhotoPickerOpen={() => persistLiveEditSession({ editingPhotos: true })}
            adminOutreachEvidence={
              me?.isAdmin && unclaimedAdminOutreach
                ? { onPublish: (file, note) => void submitAdminOutreachWithEvidence(file, note) }
                : null
            }
            hasChat={!unclaimedAdminOutreach}
            requireContact={hidePricingContactRequired(editingLiveProperty?.status)}
            liveEdit={{
              status: editingLiveProperty?.status ?? "draft",
              returnListingId,
              myListingsRestorePath,
              myListingsReturnState: myListingsReturn
                ? { myListingsReturn }
                : undefined,
              adminPostsRestorePath,
              claimDraftReturnPath,
              scope: liveEditScope ?? "room",
            }}
          />
        </div>
      </div>
    );
  }

  const autosaveTimeLabel = formatAutosaveTime(lastAutosavedAt);
  const wizardShellMaxWidth = isPublishStep ? "max-w-3xl" : "max-w-2xl";

  function goWizardStepBack() {
    setPublishErr(null);
    void flushWizardAutosave();
    track("publish_step_back", {
      step_index: safeStep,
      step_title: current.title,
      mode: draft.postMode,
      create_flow: createFlowRef.current,
    });
    const next = Math.max(0, safeStep - 1);
    if (next === WIZARD_STEP_POST_MODE && !editingLiveProperty && !editPropertyId) {
      setDraft((d) => forgetManualRoomCreateChoice(d));
    }
    setStep(next);
  }

  return (
    <div className={`mx-auto w-full min-w-0 overflow-x-clip px-3 py-4 sm:px-6 sm:py-10 ${wizardShellMaxWidth}`}>
      {apiOn && (autosaveTimeLabel || autosaveNote === "error") ? (
        <WizardAutosaveIndicator
          lastSavedAt={lastAutosavedAt}
          flashKey={autosaveFlashKey}
          showRing={showAutosaveRing}
          saving={autosaveNote === "saving"}
          error={autosaveNote === "error" ? autosaveErr : null}
        />
      ) : null}
      <PublishWizardReturnLinks
        myListingsRestorePath={myListingsRestorePath}
        adminPostsRestorePath={adminPostsRestorePath}
        claimDraftReturnPath={claimDraftReturnPath}
      />
      <h1 className="text-2xl font-bold tracking-tight text-primary">Publicar</h1>

      {safeStep === WIZARD_STEP_POST_MODE && me === null ? (
        <div
          role="status"
          className="mt-8 rounded-xl border border-secondary/40 bg-secondary/10 p-4 shadow-sm"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 flex-1 gap-3">
              <ShieldCheck
                className="mt-0.5 size-6 shrink-0 text-primary"
                strokeWidth={2}
                aria-hidden
              />
              <p className="text-sm font-medium leading-relaxed text-body">
                Guarda tu progreso. Inicia sesión o crea una cuenta para que tu anuncio se guarde automáticamente si
                tu sesión expira.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openAuthModal("/publicar")}
              className="inline-flex w-full shrink-0 items-center justify-center rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-body shadow-sm transition hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 focus-visible:ring-offset-2 sm:w-auto"
            >
              Iniciar sesión
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 min-w-0 overflow-x-clip rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6">
        <div className="relative">
          {/* Progress omits post-type selection; numbered steps start at ubicación. */}
          <div className="flex flex-col items-center">
            {showWizardProgress ? (
              <nav aria-label="Progreso del anuncio" className="flex w-full max-w-lg items-start">
                {progressSteps.map((s, progressIdx) => {
                  const i = progressIdx + WIZARD_FIRST_NUMBERED_STEP;
                  const isPast = i < safeStep;
                  const isCurrent = i === safeStep;
                  const shortLabel = (() => {
                    const t = s.title;
                    if (/cuéntanos/i.test(t)) return "Datos";
                    if (/ubica/i.test(t)) return "Ubicación";
                    if (/cómo.*espacio/i.test(t)) return "Descripción";
                    if (/recámara|recamara/i.test(t)) return "Recámaras";
                    if (/foto/i.test(t)) return "Fotos";
                    if (/revisar|publicar/i.test(t)) return "Verificar";
                    return t.split(/\s+/).slice(0, 2).join(" ");
                  })();
                  return (
                    <div key={i} className="flex min-w-0 flex-1 items-start">
                      <div className="flex min-w-0 w-full flex-col items-center">
                        <button
                          type="button"
                          disabled={!isPast}
                          onClick={
                            isPast
                              ? () => {
                                  setPublishErr(null);
                                  setStep(i);
                                }
                              : undefined
                          }
                          title={isPast ? `Volver a "${s.title}"` : s.title}
                          aria-current={isCurrent ? "step" : undefined}
                          className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold leading-none transition sm:size-6 ${
                            isCurrent
                              ? "bg-primary text-primary-fg ring-2 ring-primary/30 ring-offset-1"
                              : isPast
                                ? "cursor-pointer bg-primary/20 text-primary hover:bg-primary/40"
                                : "cursor-default bg-muted/20 text-muted"
                          }`}
                        >
                          {progressIdx + 1}
                        </button>
                        <span
                          className={`mt-1 w-full truncate px-0.5 text-center text-[10px] font-medium leading-tight sm:text-[9px] ${
                            isCurrent
                              ? "text-primary"
                              : isPast
                                ? "text-primary/60"
                                : "text-muted/50"
                          }`}
                        >
                          {shortLabel}
                        </span>
                      </div>
                      {progressIdx < progressSteps.length - 1 ? (
                        <div
                          className={`mt-3 h-px w-1.5 shrink-0 sm:w-3 ${
                            i < safeStep ? "bg-primary/30" : "bg-muted/20"
                          }`}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </nav>
            ) : null}
            <h2
              className={`${showWizardProgress ? "mt-3 " : ""}text-center text-lg font-semibold text-body`}
            >
              {current.title}
            </h2>
          </div>

          {/* Admin autofill — below the title on phones; pin to the progress row on larger screens. */}
          {me?.isAdmin ? (
            <div
              className={`mt-3 flex justify-end ${
                showWizardProgress ? "sm:absolute sm:right-0 sm:top-0 sm:mt-0" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => autofillStep(safeStep)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-warning/50 bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning-fg shadow-sm transition hover:bg-warning/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-warning/50 focus-visible:ring-offset-1"
                title="Solo visible para administradores"
              >
                <Wand2 className="size-3.5" aria-hidden />
                Autopoblar
              </button>
            </div>
          ) : null}
        </div>
        <div className="mt-4 min-w-0 space-y-4">
          {isPublishStep ? (
            <PublishWizardReviewStep
              draft={draft}
              roomIndex={Math.min(previewRoomIndex, Math.max(0, draft.rooms.length - 1))}
              onRoomIndexChange={setPreviewRoomIndex}
              isAssistedDraft={Boolean(assistedDraftToken)}
              isSelfServeAssistedDraft={Boolean(assistedDraftToken) && draft.roomCreateFlow === "ai"}
              adminOutreachEvidence={
                me?.isAdmin && unclaimedAdminOutreach
                  ? { onPublish: (file, note) => void submitAdminOutreachWithEvidence(file, note) }
                  : null
              }
              hasChat={!unclaimedAdminOutreach}
              requireContact={false}
              fieldConflicts={aiConflicts}
              onDraftChange={(updater) => {
              setDraft((d) => {
                const next = syncDraftPhotoFields(updater(d));
                draftRef.current = next;
                return next;
              });
              void flushWizardAutosave();
            }}
              apiOn={apiOn}
              profilePhoneE164={me?.phoneE164}
              savePhoneToProfile={savePhoneToProfile}
              onSavePhoneToProfileChange={setSavePhoneToProfile}
              publishBlockedReason={publishBlockedReason}
              actionErr={publishErr}
              submitInFlight={submitInFlight}
              onSaveDraft={() => void submitServerDraft()}
              onPublish={() => void submitPublish()}
              draftSaved={wizardDraftSaveNote === "saved"}
              showStepBack={step > 0}
              onStepBack={goWizardStepBack}
            />
          ) : (
            current.body
          )}
        </div>
        {publishErr && !isPublishStep ? (
          <p className="mt-4 text-sm text-error" role="alert">
            {publishErr}
          </p>
        ) : null}
        {current.title === WIZARD_STEP_TITLES.AI_INPUT && aiWillRecompose ? (
          <p className="mt-3 text-xs text-muted">Se volverá a armar el anuncio con lo que hay ahora.</p>
        ) : null}

        {!isPublishStep ? (
          <PublishWizardActionBar className={step > 0 ? "sm:justify-between" : "sm:justify-end"}>
            {step > 0 ? (
              <button
                type="button"
                onClick={goWizardStepBack}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-body transition hover:bg-surface-elevated sm:w-auto"
              >
                Atrás
              </button>
            ) : null}
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => {
                  if (current.title === WIZARD_STEP_TITLES.AI_INPUT) {
                    void submitAiCompose();
                    return;
                  }
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
                  void flushWizardAutosave();
                  track("publish_step_completed", {
                    step_index: safeStep,
                    step_title: current.title,
                    mode: draft.postMode,
                    create_flow: createFlowRef.current,
                  });
                  setStep((s) => Math.min(steps.length - 1, s + 1));
                }}
                disabled={submitInFlight !== null || aiComposeInFlight}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-50 sm:w-auto"
              >
                {current.title === WIZARD_STEP_TITLES.AI_INPUT
                  ? aiComposeInFlight
                    ? "Armando tu anuncio…"
                    : "Continuar"
                  : "Siguiente"}
              </button>
            </div>
          </PublishWizardActionBar>
        ) : null}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Bath, Camera, CarFront } from "lucide-react";
import { HighHeelIcon, MustacheIcon, GenderMixedIcon, quickAttributeGenderIconClass } from "@/components/icons/GenderFilterIcons";
import { BulkImageUploader } from "@/components/BulkImageUploader";
import { RoomOnOffToggle } from "@/components/myListings/listingCardChrome";
import { ListingPhotoGallery } from "@/components/listing/ListingPhotoGallery";
import {
  ListingPropertySummaryGrid,
  ListingRoomDetailsGrid,
} from "@/components/listing/ListingPropertySummaryGrid";
import { ListingHeaderBadges, ListingHeroPrice, publicListingHeaderTitle } from "@/components/listing/PublicListingHeader";
import { FieldCharCount } from "@/components/publish/FieldCharCount";
import { MissingRentCallout } from "@/components/publish/MissingRentCallout";
import { ResizableTextarea } from "@/components/publish/ResizableTextarea";
import { useDebouncedCommit } from "@/components/publish/useDebouncedCommit";
import { ListingTagChips } from "@/components/listing/ListingTagChips";
import { PreviewPropertyLocationMap } from "@/components/publish/PreviewPropertyLocationMap";
import { EditableRoomModal } from "@/components/publish/EditableRoomModal";
import { RoomTitlePencilEditor } from "@/components/publish/RoomTitlePencilEditor";
import {
  cloneRoomDraft,
  createPreviewDefaultRoom,
  InlineFieldEditor,
  PreviewPencilEditButton,
  PreviewSection,
  ROOM_PLAZAS_MAX,
  ROOM_STAY_MAX,
  ScopeTagsBlock,
} from "@/components/publish/editablePreviewShared";
import {
  WizardNumberStepper,
  WizardPairedFieldLabel,
  WIZARD_FIELD_CONTROL_CLASS,
} from "@/components/WizardNumberStepper";
import { apiAbsoluteUrl } from "@/lib/mediaUrl";
import { formatMxPhoneDisplay, normalizeMxNationalDigits, phoneDigitsForStorage } from "@/lib/mxPhone";
import { PhoneNumberField } from "@/components/phone/PhoneNumberField";
import {
  roomDimensionWizardLabel,
} from "@/lib/listingKeyLabels";
import {
  PROPERTY_SUMMARY_MAX,
  PROPERTY_SUMMARY_MIN,
  PROPERTY_TITLE_MAX,
  PROPERTY_TITLE_MIN,
  ROOM_SUMMARY_MAX,
  ROOM_SUMMARY_MIN,
  CITY_ANCHOR,
  draftRoomImageUrls,
  draftRoomEditorImages,
} from "@/lib/publishWizard/publishCore";
import { draftToListingPreview } from "@/lib/publishWizard/draftPreview";
import { clampApproximateRadiusMeters } from "@/lib/approximateLocationRadius";
import {
  derivedPropertyOccupantCounts,
  setRoomOccupancyStatus,
  syncPropertyRoomSlotsToTotal,
} from "@/lib/publishWizard/propertyRoomSlots";
import { isRoomAvailableForRent, occupancyStatusLabel, occupiedRoomOccupantSummary, propertyRoomPencilTitle, propertyRoomSlotTitle } from "@/lib/roomDisplay";
import { streetViewPovCacheKey } from "@/lib/streetView";
import {
  PROPERTY_TAG_GROUPS,
  ROOM_TAG_GROUPS,
  ROOMMATE_GENDER_PREF_FIELD_LABEL_SHORT,
  filterPropertyScopeTags,
  filterRoomScopeTags,
  formatRoomAvailableFrom,
  isListingRentMissing,
  listingHeroPriceLabel,
  listingTagsNotSelected,
  sortRoomScopeTags,
} from "@/lib/listingTags";
import {
  collectRoomFieldIssueDetails,
  collectRoomFieldIssues,
  firstRoomIndexMissingRent,
  firstRoomIndexWithIssues,
  firstStandaloneRoomFixSection,
  isStandaloneRoomPost,
  PUBLISH_PREVIEW_HEADER_ID,
  PUBLISH_PREVIEW_PROPERTY_SUMMARY_FIELD_ID,
  PUBLISH_PREVIEW_RENT_INPUT_ID,
  PUBLISH_PREVIEW_ROOM_DESCRIPTION_FIELD_ID,
  PUBLISH_PREVIEW_ROOM_DESCRIPTION_ID,
  PUBLISH_PREVIEW_ROOM_DETAILS_ID,
  PUBLISH_ROOM_MODAL_AGE_MAX_ID,
  PUBLISH_ROOM_MODAL_AGE_MIN_ID,
  PUBLISH_ROOM_MODAL_AVAILABLE_FROM_ID,
  PUBLISH_ROOM_MODAL_DEPOSIT_INPUT_ID,
  PUBLISH_ROOM_MODAL_DIMENSION_ID,
  PUBLISH_ROOM_MODAL_GENDER_ID,
  PUBLISH_ROOM_MODAL_LODGING_ID,
  PUBLISH_ROOM_MODAL_STAY_ID,
  roomIssueFocusElementId,
  roomPreviewOptionLabel,
  standaloneRoomFixAnchorId,
} from "@/lib/publishWizard/roomWizardValidation";
import {
  assignDraftPhoto,
  canonicalDraftPhotoUrl,
  draftImagesToUrls,
  parsePhotoAssignDest,
  preferDraftImages,
  setRoomPhotosExclusive,
  syncDraftPhotoArrays,
  type PhotoAssignDest,
} from "@/lib/publishWizard/draftImages";
import {
  ROOM_SINGLE_FLOW_PHOTO_HINT,
  roomsAvailableFromIdealTags,
} from "@/lib/publishWizard/wizardTags";
import type { Draft, RoomDraft } from "@/pages/PublishWizardPage";
import type { ListingTag, LodgingType, PropertyKind, RoomDimension, RoommateGenderPref } from "@/types/listing";
import type { LiveEditScope } from "@/components/publish/PublishWizardReviewStep";

const PROPERTY_BEDROOMS_MAX = 20;
const PROPERTY_BATHROOMS_MAX = 10;
const PROPERTY_OCCUPANTS_MAX = 50;

const PROPERTY_SUMMARY_PLACEHOLDER =
  "Describe cómo es la convivencia, la sala, la cocina, y las reglas generales de la casa.";
const ROOM_SUMMARY_PLACEHOLDER =
  "Describe el tamaño, la iluminación, si tiene clóset, y qué incluye.";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

type Props = {
  draft: Draft;
  roomIndex: number;
  apiOn?: boolean;
  variant?: "preview" | "live-edit";
  /** Live-edit from Mis Anuncios: property card vs room row. Null keeps full wizard preview. */
  editScope?: LiveEditScope | null;
  profilePhoneE164?: string | null;
  onDraftChange: (updater: (d: Draft) => Draft) => void;
  onRoomIndexChange?: (index: number) => void;
  /** Commit the current draft updater then publish/save live listing. */
  onCommitAndPublish?: (updater: (d: Draft) => Draft) => void;
  onPublish?: () => void;
  publishAfterRoomFix?: boolean;
  onPublishAfterRoomFixChange?: (next: boolean) => void;
  jumpToRoomIndex?: number | null;
  /** Optional issue id to focus after opening the jumped room. */
  jumpToRoomIssueId?: string | null;
  onJumpToRoomHandled?: () => void;
  onRoomModalDismiss?: () => void;
  confirmLabel?: string;
  submitInFlight?: "publish" | "draft" | null;
  publishBlockedReason?: string | null;
  actionErr?: string | null;
  /** Re-open photo editor after camera/gallery remount (live edit). */
  initialEditingPhotos?: boolean;
  /** Notify parent when the inline photo editor opens/closes (persist across remounts). */
  onEditingPhotosChange?: (editing: boolean) => void;
  /** Flush live-edit snapshot before OS camera/gallery may kill the tab. */
  onPhotoPickerOpen?: () => void;
  /** Show unselected tags dimmed so the user can see what the AI skipped (AI draft + preview only). */
  isAssistedDraft?: boolean;
  /** Persist listing phone to profile on publish/save (review step + live edit). */
  savePhoneToProfile?: boolean;
  onSavePhoneToProfileChange?: (next: boolean) => void;
};

function propertyRentRangeLabel(rooms: readonly RoomDraft[]): string | null {
  const rents = rooms
    .filter((room) => isRoomAvailableForRent(room))
    .map((room) => room.rentMxn)
    .filter((rent) => rent > 0);
  if (!rents.length) return null;
  const minRent = Math.min(...rents);
  const maxRent = Math.max(...rents);
  if (minRent === maxRent) return listingHeroPriceLabel(minRent);
  return `${money.format(minRent)} – ${money.format(maxRent)} / mes`;
}

function listPropertyPhotosForAssign(draft: Draft): Array<{ url: string; dest: PhotoAssignDest }> {
  const seen = new Set<string>();
  const out: Array<{ url: string; dest: PhotoAssignDest }> = [];
  const push = (url: string, dest: PhotoAssignDest) => {
    const key = canonicalDraftPhotoUrl(url);
    if (!url || seen.has(key)) return;
    seen.add(key);
    out.push({ url, dest });
  };
  for (const img of draft.unassignedImageUrls) push(img.url, "uncat");
  for (const img of preferDraftImages(draft.commonAreaPhotos, draft.propertyImageUrls)) {
    push(img.url, img.isCover ? "facade" : "shared");
  }
  draft.rooms.forEach((room, idx) => {
    for (const img of preferDraftImages(room.photos, draft.roomImageUrls[idx])) {
      push(img.url, `room:${idx + 1}`);
    }
  });
  return out;
}

function RoomPreviewCard({
  room,
  index,
  draft,
  onEdit,
  onRename,
  onAvailabilityChange,
}: {
  room: RoomDraft;
  index: number;
  draft: Draft;
  onEdit: () => void;
  onRename: (name: string) => void;
  onAvailabilityChange: (nextAvailable: boolean) => void;
}) {
  const available = isRoomAvailableForRent(room);
  const fallbackTitle = propertyRoomSlotTitle(index + 1);
  const name = propertyRoomPencilTitle(room, index + 1);
  const coverUrl =
    draftImagesToUrls(preferDraftImages(room.photos, draft.roomImageUrls[index]))[0] ??
    draftRoomImageUrls(draft, index)[0] ??
    null;
  const issues = collectRoomFieldIssues(draft, room, index);
  const rentMissing = available && isListingRentMissing(room.rentMxn);
  const occupantSummary = available ? null : occupiedRoomOccupantSummary(room);

  // Gender pref quick-attribute
  const genderPref = room.roommateGenderPref;
  const GenderIcon = genderPref === "female" ? HighHeelIcon : genderPref === "male" ? MustacheIcon : GenderMixedIcon;
  const genderIconId = genderPref === "female" ? "gender-female" : genderPref === "male" ? "gender-male" : "gender-mixed";
  const genderTooltip = genderPref === "female" ? "Solo Mujeres" : genderPref === "male" ? "Solo Hombres" : "Sin preferencia";
  const hasPrivateBath = room.tags.includes("baño-privado");
  const hasParking = room.tags.includes("estacionamiento");

  const tooltipClass =
    "pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-body shadow-md group-hover/icon:block";

  const editAriaLabel =
    issues.length || rentMissing ? `Completar ${fallbackTitle}` : `Editar ${fallbackTitle}`;

  return (
    <article className="relative rounded-xl border border-border bg-bg-light p-4">
      <PreviewPencilEditButton
        onClick={onEdit}
        ariaLabel={editAriaLabel}
        className="absolute right-3 top-3 z-10"
      />
      <div className="flex gap-3 pr-10">
        <div className="min-w-0 flex-1">
          {/* Room name + occupancy — stacked so the toggle stays tappable on phones */}
          <div className="flex flex-col gap-2">
            <RoomTitlePencilEditor
              value={name}
              fallbackTitle={fallbackTitle}
              onCommit={onRename}
            />
            <span className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  available ? "bg-secondary/15 text-primary" : "bg-bg-light text-muted ring-1 ring-border"
                }`}
              >
                {occupancyStatusLabel(available ? "available" : "occupied")}
              </span>
              <RoomOnOffToggle available={available} onChange={onAvailabilityChange} />
            </span>
          </div>

          {available ? (
            <>
              {rentMissing ? (
                <button
                  type="button"
                  onClick={onEdit}
                  className="mt-1 text-left text-sm font-semibold text-error underline decoration-2 underline-offset-2"
                >
                  Falta el precio de renta
                </button>
              ) : (
                <p className="mt-1 text-sm text-muted">
                  {money.format(room.rentMxn)} / mes · {roomDimensionWizardLabel(room.roomDimension)}
                </p>
              )}

              {/* Attribute row: text pill for date, icon pills for toggleable features */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border bg-surface px-2 py-1 text-xs font-medium text-body">
                  Disponible {formatRoomAvailableFrom(room.availableFrom ?? "")}
                </span>
                {/* Gender preference — always shown as icon */}
                <span className="group/icon relative inline-flex" title={genderTooltip}>
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-surface text-primary ring-1 ring-border">
                    <GenderIcon className={quickAttributeGenderIconClass(genderIconId, true)} aria-hidden />
                  </span>
                  <span className={tooltipClass}>{genderTooltip}</span>
                </span>
                {/* Private bathroom — only when enabled */}
                {hasPrivateBath ? (
                  <span className="group/icon relative inline-flex" title="Baño privado">
                    <span className="inline-flex size-8 items-center justify-center rounded-full bg-surface text-primary ring-1 ring-border">
                      <Bath className="size-[15px]" aria-hidden />
                    </span>
                    <span className={tooltipClass}>Baño privado</span>
                  </span>
                ) : null}
                {/* Private parking — only when enabled */}
                {hasParking ? (
                  <span className="group/icon relative inline-flex" title="Cochera incluida">
                    <span className="inline-flex size-8 items-center justify-center rounded-full bg-surface text-primary ring-1 ring-border">
                      <CarFront className="size-[15px]" aria-hidden />
                    </span>
                    <span className={tooltipClass}>Cochera incluida</span>
                  </span>
                ) : null}
              </div>
            </>
          ) : occupantSummary ? (
            <p className="mt-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
              {occupantSummary}
            </p>
          ) : null}
          {issues.length ? (
            <p className="mt-2 text-xs font-semibold text-warning-fg">Incompleta</p>
          ) : null}
        </div>

        {/* Cover photo — self-start prevents flex-stretch distortion; portrait ratio */}
        <div className="relative aspect-[4/5] w-20 shrink-0 self-start overflow-hidden rounded-xl bg-surface ring-1 ring-border sm:w-24">
          {coverUrl ? (
            <img
              src={apiAbsoluteUrl(coverUrl)}
              alt={`Foto de ${name}`}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-bg-light">
              <Camera className="size-6 text-muted" strokeWidth={1.75} aria-hidden />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

type PropertyFactsDraft = {
  propertyKind: PropertyKind;
  propertyBedroomsTotal: number;
  propertyBathrooms: number;
  occupiedByWomenCount: number;
  occupiedByMenCount: number;
};

function propertyFactsFromDraft(d: Draft): PropertyFactsDraft {
  const occupants =
    d.postMode === "property"
      ? derivedPropertyOccupantCounts(d)
      : {
          occupiedByWomenCount: d.occupiedByWomenCount ?? 0,
          occupiedByMenCount: d.occupiedByMenCount ?? 0,
        };
  const bathrooms =
    typeof d.propertyBathrooms === "number" && Number.isFinite(d.propertyBathrooms) && d.propertyBathrooms >= 0
      ? d.propertyBathrooms
      : 1;
  return {
    propertyKind: d.propertyKind,
    propertyBedroomsTotal: d.propertyKind === "loft" ? 1 : d.propertyBedroomsTotal,
    propertyBathrooms: bathrooms,
    occupiedByWomenCount: occupants.occupiedByWomenCount,
    occupiedByMenCount: occupants.occupiedByMenCount,
  };
}


export function EditableListingPreview({
  draft,
  roomIndex,
  apiOn = false,
  variant = "preview",
  editScope = null,
  profilePhoneE164,
  onDraftChange,
  onRoomIndexChange,
  onCommitAndPublish,
  onPublish,
  publishAfterRoomFix = false,
  onPublishAfterRoomFixChange,
  jumpToRoomIndex = null,
  jumpToRoomIssueId = null,
  onJumpToRoomHandled,
  onRoomModalDismiss,
  confirmLabel,
  submitInFlight = null,
  publishBlockedReason = null,
  actionErr = null,
  initialEditingPhotos = false,
  onEditingPhotosChange,
  onPhotoPickerOpen,
  isAssistedDraft: _isAssistedDraft = false,
  savePhoneToProfile = false,
  onSavePhoneToProfileChange,
}: Props) {
  const listing = useMemo(
    () => draftToListingPreview(draft, roomIndex, profilePhoneE164),
    [
      draft,
      roomIndex,
      profilePhoneE164,
      streetViewPovCacheKey(draft.streetViewPov),
      draft.isApproximateLocation,
      draft.approximateRadiusMeters,
      draft.useCustomMapPin,
      draft.customLat,
      draft.customLng,
    ],
  );
  const room = draft.rooms[roomIndex];
  const isPropertyScope = editScope === "property";
  const isRoomScope = editScope === "room";
  const isPropertyPreview = draft.postMode === "property" && !isRoomScope;
  const isRoomOfProperty = isRoomScope && draft.postMode === "property";
  /** Property review uses the rooms grid + modal; single-room posts keep inline room blocks. */
  const showPropertyBlocks = !isRoomScope;
  const showRoomBlocks = draft.postMode === "room";
  const canEditLocation = !isRoomOfProperty;
  const headerUsesPropertyFields = isPropertyPreview || isPropertyScope;

  const [editingHeader, setEditingHeader] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [editingPhotos, setEditingPhotos] = useState(initialEditingPhotos && !isPropertyPreview && !isRoomOfProperty);
  const [editingRoomDetails, setEditingRoomDetails] = useState(false);
  const [editingPropertyFacts, setEditingPropertyFacts] = useState(false);
  const [editingRoomModalIndex, setEditingRoomModalIndex] = useState<number | null>(() => {
    if (isRoomOfProperty) return roomIndex;
    if (isPropertyPreview && initialEditingPhotos) return roomIndex;
    return null;
  });
  const [roomModalFocusIssueId, setRoomModalFocusIssueId] = useState<string | null>(null);

  const setPhotosEditing = (next: boolean) => {
    setEditingPhotos(next);
    onEditingPhotosChange?.(next);
  };

  const [headerDraft, setHeaderDraft] = useState({
    neighborhood: draft.neighborhood,
    propertyTitle: draft.propertyTitle,
    rentMxn: room?.rentMxn ?? 0,
    depositMxn: room?.depositMxn ?? 0,
    city: draft.city,
  });
  const [phoneDraft, setPhoneDraft] = useState({
    contactWhatsApp: draft.contactWhatsApp,
    showWhatsApp: draft.showWhatsApp,
  });
  const [propertySummaryDraft, setPropertySummaryDraft] = useState(draft.propertySummary);
  const [roomSummaryDraft, setRoomSummaryDraft] = useState(room?.summary ?? "");
  const [roomDetailsDraft, setRoomDetailsDraft] = useState<RoomDraft | null>(null);
  const [propertyFactsDraft, setPropertyFactsDraft] = useState<PropertyFactsDraft>(() =>
    propertyFactsFromDraft(draft),
  );

  useEffect(() => {
    if (jumpToRoomIndex == null) return;
    if (jumpToRoomIndex < 0 || jumpToRoomIndex >= draft.rooms.length) {
      onJumpToRoomHandled?.();
      return;
    }
    const targetRoom = draft.rooms[jumpToRoomIndex]!;
    onRoomIndexChange?.(jumpToRoomIndex);

    // Single-room posts edit inline on the preview — no recámara modal.
    if (isStandaloneRoomPost(draft)) {
      const preferred =
        (jumpToRoomIssueId
          ? collectRoomFieldIssueDetails(draft, targetRoom).find((i) => i.id === jumpToRoomIssueId)
          : undefined) ?? collectRoomFieldIssueDetails(draft, targetRoom)[0];
      const section = preferred?.section ?? firstStandaloneRoomFixSection(draft, targetRoom);
      if (section === "header") {
        setHeaderDraft({
          neighborhood: draft.neighborhood,
          propertyTitle: draft.propertyTitle,
          rentMxn: targetRoom.rentMxn,
          depositMxn: targetRoom.depositMxn,
          city: draft.city,
        });
        setEditingHeader(true);
      } else if (section === "details") {
        setRoomDetailsDraft(cloneRoomDraft(targetRoom));
        setEditingRoomDetails(true);
      } else if (section === "description" || section === "tags") {
        setRoomSummaryDraft(targetRoom.summary);
      }
      onJumpToRoomHandled?.();
      const anchorId = standaloneRoomFixAnchorId(section);
      const focusId = preferred ? roomIssueFocusElementId(preferred) : null;
      window.setTimeout(() => {
        document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "center" });
        const el = focusId ? document.getElementById(focusId) : null;
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        if (el instanceof HTMLElement) el.focus();
      }, 80);
      return;
    }

    setRoomModalFocusIssueId(jumpToRoomIssueId);
    setEditingRoomModalIndex(jumpToRoomIndex);
    onJumpToRoomHandled?.();
    // draft is read from the click render; jumpToRoomIndex is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpToRoomIndex, jumpToRoomIssueId, draft.rooms.length, onJumpToRoomHandled, onRoomIndexChange]);

  const galleryUrls = useMemo(() => {
    if (isPropertyPreview || isPropertyScope) {
      return draftImagesToUrls(preferDraftImages(draft.commonAreaPhotos, draft.propertyImageUrls));
    }
    return draftImagesToUrls(draftRoomEditorImages(draft, roomIndex));
  }, [
    isPropertyPreview,
    isPropertyScope,
    draft,
    roomIndex,
  ]);

  const photosForAssign =
    showPropertyBlocks && draft.postMode === "property" ? listPropertyPhotosForAssign(draft) : [];

  const mapCenter = useMemo(
    (): [number, number] => [CITY_ANCHOR[draft.city].lat, CITY_ANCHOR[draft.city].lng],
    [draft.city],
  );

  const saveMapCoordinates = (lat: number, lng: number) => {
    onDraftChange((d) => ({
      ...d,
      useCustomMapPin: true,
      customLat: lat.toFixed(7),
      customLng: lng.toFixed(7),
      streetViewPov: undefined,
    }));
  };

  useEffect(() => {
    setPropertySummaryDraft(draft.propertySummary);
  }, [draft.propertySummary]);

  useEffect(() => {
    setRoomSummaryDraft(room?.summary ?? "");
  }, [room?.summary, roomIndex]);

  const flushPropertySummary = useDebouncedCommit(propertySummaryDraft, (next) => {
    onDraftChange((d) => (d.propertySummary === next ? d : { ...d, propertySummary: next }));
  });

  const flushRoomSummary = useDebouncedCommit(roomSummaryDraft, (next) => {
    onDraftChange((d) => {
      const current = d.rooms[roomIndex];
      if (!current || current.summary === next) return d;
      return {
        ...d,
        rooms: d.rooms.map((r, i) => (i === roomIndex ? { ...r, summary: next } : r)),
      };
    });
  });

  if (!room) {
    return <p className="text-sm text-muted">No hay recámara seleccionada.</p>;
  }

  const propertyTagsActive = filterPropertyScopeTags(draft.propertyTags);
  const roomTagsActive = sortRoomScopeTags(filterRoomScopeTags(room.tags));
  const unselectedPropertyTags = listingTagsNotSelected(
    PROPERTY_TAG_GROUPS.flatMap((g) => g.tags),
    propertyTagsActive,
  );
  const unselectedRoomTags = listingTagsNotSelected(
    ROOM_TAG_GROUPS.flatMap((g) => g.tags),
    roomTagsActive,
  );

  const openHeaderEdit = () => {
    setHeaderDraft({
      neighborhood: draft.neighborhood,
      propertyTitle: draft.propertyTitle,
      rentMxn: room.rentMxn,
      depositMxn: room.depositMxn,
      city: draft.city,
    });
    setEditingHeader(true);
  };

  const openPhoneEdit = () => {
    setPhoneDraft({
      contactWhatsApp: draft.contactWhatsApp,
      showWhatsApp: draft.showWhatsApp,
    });
    setEditingPhone(true);
  };

  const savePhone = () => {
    onDraftChange((d) => ({
      ...d,
      contactWhatsApp: phoneDraft.contactWhatsApp,
      showWhatsApp: phoneDraft.showWhatsApp,
    }));
    setEditingPhone(false);
  };

  const saveHeader = () => {
    const nextPropertyTitle = headerDraft.propertyTitle.slice(0, PROPERTY_TITLE_MAX);
    if (headerUsesPropertyFields) {
      onDraftChange((d) => ({
        ...d,
        neighborhood: headerDraft.neighborhood,
        propertyTitle: nextPropertyTitle,
        city: headerDraft.city,
      }));
      setEditingHeader(false);
      return;
    }
    onDraftChange((d) => ({
      ...d,
      // Single-room posts use Datos Generales → Título del anuncio (propertyTitle).
      propertyTitle: d.postMode === "room" ? nextPropertyTitle : d.propertyTitle,
      city: isRoomOfProperty ? d.city : headerDraft.city,
      // The colonia belongs to the property, so a room-scoped edit leaves it untouched.
      neighborhood: isRoomOfProperty ? d.neighborhood : headerDraft.neighborhood,
      rooms: d.rooms.map((r, i) =>
        i === roomIndex
          ? {
              ...r,
              title:
                d.postMode === "room"
                  ? nextPropertyTitle.trim() || r.title
                  : r.title,
              rentMxn: Math.max(0, headerDraft.rentMxn),
              depositMxn: Math.max(0, headerDraft.depositMxn),
            }
          : r,
      ),
    }));
    setEditingHeader(false);
  };

  const togglePropertyTag = (tag: ListingTag, currentlyActive: boolean) => {
    onDraftChange((d) => {
      const next = currentlyActive
        ? d.propertyTags.filter((t) => t !== tag)
        : [...d.propertyTags, tag];
      return { ...d, propertyTags: filterPropertyScopeTags(next) };
    });
  };

  const toggleRoomTag = (tag: ListingTag, currentlyActive: boolean) => {
    onDraftChange((d) => ({
      ...d,
      rooms: d.rooms.map((r, i) => {
        if (i !== roomIndex) return r;
        const next = currentlyActive ? r.tags.filter((t) => t !== tag) : [...r.tags, tag];
        const tags = filterRoomScopeTags(next);
        return {
          ...r,
          tags,
          roomsAvailable: d.postMode === "room" ? roomsAvailableFromIdealTags(tags) : r.roomsAvailable,
        };
      }),
    }));
  };

  const openRoomDetailsEdit = () => {
    setRoomDetailsDraft(cloneRoomDraft(room));
    setEditingRoomDetails(true);
  };

  const saveRoomDetails = () => {
    if (!roomDetailsDraft) return;
    onDraftChange((d) => ({
      ...d,
      rooms: d.rooms.map((r, i) =>
        i === roomIndex
          ? {
              ...roomDetailsDraft,
              tags: filterRoomScopeTags(roomDetailsDraft.tags),
              roomsAvailable:
                d.postMode === "room"
                  ? roomsAvailableFromIdealTags(roomDetailsDraft.tags)
                  : roomDetailsDraft.roomsAvailable,
            }
          : r,
      ),
    }));
    setEditingRoomDetails(false);
    setRoomDetailsDraft(null);
  };

  const openPropertyFactsEdit = () => {
    setPropertyFactsDraft(propertyFactsFromDraft(draft));
    setEditingPropertyFacts(true);
  };

  const savePropertyFacts = () => {
    const nextKind = propertyFactsDraft.propertyKind;
    const nextBedrooms =
      nextKind === "loft"
        ? 1
        : Math.min(
            PROPERTY_BEDROOMS_MAX,
            Math.max(1, Math.floor(propertyFactsDraft.propertyBedroomsTotal) || 1),
          );
    const nextWomen = Math.min(
      PROPERTY_OCCUPANTS_MAX,
      Math.max(0, Math.floor(propertyFactsDraft.occupiedByWomenCount) || 0),
    );
    const nextMen = Math.min(
      PROPERTY_OCCUPANTS_MAX,
      Math.max(0, Math.floor(propertyFactsDraft.occupiedByMenCount) || 0),
    );
    const nextBathrooms = Math.min(
      PROPERTY_BATHROOMS_MAX,
      Math.max(0, Math.round((Number(propertyFactsDraft.propertyBathrooms) || 0) * 2) / 2),
    );
    onDraftChange((d) => {
      let next: Draft = {
        ...d,
        propertyKind: nextKind,
        propertyBedroomsTotal: nextBedrooms,
        propertyBathrooms: nextBathrooms,
      };
      if (next.postMode === "room") {
        next = {
          ...next,
          occupiedByWomenCount: nextWomen,
          occupiedByMenCount: nextMen,
        };
      } else {
        next = syncPropertyRoomSlotsToTotal(next, () => createPreviewDefaultRoom(d));
      }
      return next;
    });
    setEditingPropertyFacts(false);
  };

  const detailsRoom = roomDetailsDraft ?? room;
  const neighborhoodLabel = draft.neighborhood.trim() || listing.neighborhood;
  const occupantCounts =
    draft.postMode === "property"
      ? derivedPropertyOccupantCounts(draft)
      : {
          occupiedByWomenCount: draft.occupiedByWomenCount ?? 0,
          occupiedByMenCount: draft.occupiedByMenCount ?? 0,
        };

  // Título del anuncio (propertyTitle) for both post modes. Room title is an
  // internal default ("Recámara 1") on single-room posts and must not masquerade
  // as a user-authored heading — synthesize from kind + colonia instead.
  const savedHeaderTitle = draft.propertyTitle.trim();
  const previewHeaderTitle =
    savedHeaderTitle ||
    publicListingHeaderTitle({
      postMode: draft.postMode,
      neighborhood: neighborhoodLabel,
      lodgingType: room.lodgingType,
      propertyKind: draft.propertyKind,
    });
  const rentMissing = showRoomBlocks && isListingRentMissing(room.rentMxn);
  const propertyRentMissing =
    isPropertyPreview &&
    draft.rooms.some((r) => isRoomAvailableForRent(r) && isListingRentMissing(r.rentMxn));
  const propertyPriceLabel = isPropertyPreview ? propertyRentRangeLabel(draft.rooms) : null;
  const firstAvailableRoom =
    draft.rooms.find((r) => isRoomAvailableForRent(r)) ?? room;
  const canSavePhoneToProfile = Boolean(onSavePhoneToProfileChange);

  const openRoomModal = (index: number) => {
    onRoomIndexChange?.(index);
    setRoomModalFocusIssueId(null);
    setEditingRoomModalIndex(index);
  };

  const commitRoomAt = (index: number, updated: RoomDraft) => {
    onDraftChange((d) =>
      setRoomPhotosExclusive(
        {
          ...d,
          rooms: d.rooms.map((r, i) => (i === index ? updated : r)),
        },
        index,
        updated.photos ?? [],
      ),
    );
  };

  const renameRoomAt = (index: number, name: string) => {
    const fallback = propertyRoomSlotTitle(index + 1);
    const trimmed = name.trim();
    onDraftChange((d) => ({
      ...d,
      rooms: d.rooms.map((room, i) =>
        i === index ? { ...room, customName: trimmed, title: trimmed || fallback } : room,
      ),
    }));
  };

  const roomModal =
    editingRoomModalIndex !== null && draft.rooms[editingRoomModalIndex] ? (
      <EditableRoomModal
        key={`${draft.rooms[editingRoomModalIndex]?.id ?? editingRoomModalIndex}-${roomModalFocusIssueId ?? "open"}`}
        room={draft.rooms[editingRoomModalIndex]}
        roomIndex={editingRoomModalIndex}
        draft={draft}
        apiOn={apiOn}
        confirmLabel={
          isRoomOfProperty || publishAfterRoomFix
            ? (confirmLabel ?? "Guardar cambios")
            : "Guardar recámara"
        }
        submitInFlight={isRoomOfProperty || publishAfterRoomFix ? submitInFlight : null}
        publishBlockedReason={
          // Only pass non-room blockers (location, photos, general) to the room modal.
          // Room-level issues are handled inside the modal by RoomLocalIssuesCallout;
          // the global publishBlockedReason concatenates ALL rooms' issues and would
          // misleadingly show another room's errors inside the wrong room's modal.
          isRoomOfProperty && !publishBlockedReason?.startsWith("Paso · Recámaras:")
            ? publishBlockedReason
            : null
        }
        actionErr={isRoomOfProperty ? actionErr : null}
        initialEditingPhotos={initialEditingPhotos && editingRoomModalIndex === roomIndex}
        initialFocusIssueId={roomModalFocusIssueId}
        onSave={(updated) => {
          const localIssues = collectRoomFieldIssueDetails(draft, updated);
          if (localIssues.length) return;

          const applyRoom = (d: Draft): Draft =>
            setRoomPhotosExclusive(
              {
                ...d,
                rooms: d.rooms.map((r, i) => (i === editingRoomModalIndex ? updated : r)),
              },
              editingRoomModalIndex,
              updated.photos ?? [],
            );

          if (isRoomOfProperty && onCommitAndPublish) {
            onCommitAndPublish(applyRoom);
            return;
          }

          const nextDraft = applyRoom(draft);
          commitRoomAt(editingRoomModalIndex, updated);

          if (publishAfterRoomFix) {
            const nextIncomplete = firstRoomIndexWithIssues(nextDraft);
            if (nextIncomplete >= 0) {
              setRoomModalFocusIssueId(null);
              setEditingRoomModalIndex(nextIncomplete);
              onRoomIndexChange?.(nextIncomplete);
              return;
            }
            setEditingRoomModalIndex(null);
            setRoomModalFocusIssueId(null);
            onPublishAfterRoomFixChange?.(false);
            onPublish?.();
            return;
          }

          setEditingRoomModalIndex(null);
          setRoomModalFocusIssueId(null);
        }}
        onClose={() => {
          setEditingRoomModalIndex(null);
          setRoomModalFocusIssueId(null);
          onPublishAfterRoomFixChange?.(false);
          if (isRoomOfProperty) onRoomModalDismiss?.();
        }}
        onPhotoPickerOpen={onPhotoPickerOpen}
      />
    ) : null;

  if (isRoomOfProperty) {
    return roomModal ?? <p className="text-sm text-muted">No hay recámara seleccionada.</p>;
  }

  return (
    <div className="min-w-0 space-y-6">
      <header
        id={PUBLISH_PREVIEW_HEADER_ID}
        className={`min-w-0 max-w-full overflow-hidden scroll-mt-24 rounded-2xl border border-dashed p-4 sm:p-5 ${
          rentMissing || propertyRentMissing ? "border-error/60 bg-error/5" : "border-secondary/50 bg-secondary/5"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
              variant === "live-edit"
                ? "bg-primary/10 text-primary"
                : "bg-warning/15 text-warning-fg"
            }`}
          >
            {variant === "live-edit"
              ? isPropertyScope
                ? "Editando propiedad"
                : isRoomOfProperty
                  ? `Editando · Recámara ${roomIndex + 1}`
                  : "Editando anuncio"
              : "Vista previa · Borrador"}
          </span>
          {!editingHeader ? (
            <PreviewPencilEditButton onClick={openHeaderEdit} ariaLabel="Editar encabezado" />
          ) : null}
        </div>

        {editingHeader ? (
          <InlineFieldEditor
            label={
              headerUsesPropertyFields
                ? "Título y colonia"
                : draft.postMode === "room"
                  ? "Título, ubicación y precio"
                  : "Ubicación y precio"
            }
            onSave={saveHeader}
            onCancel={() => setEditingHeader(false)}
          >
            {headerUsesPropertyFields ? (
              <label className="block text-sm font-medium text-body">
                Título de la propiedad
                <input
                  value={headerDraft.propertyTitle}
                  maxLength={PROPERTY_TITLE_MAX}
                  onChange={(e) =>
                    setHeaderDraft((h) => ({ ...h, propertyTitle: e.target.value }))
                  }
                  className={WIZARD_FIELD_CONTROL_CLASS}
                />
                <FieldCharCount
                  current={headerDraft.propertyTitle.trim().length}
                  min={PROPERTY_TITLE_MIN}
                  max={PROPERTY_TITLE_MAX}
                  warnBelowMin
                  className="mt-1"
                />
              </label>
            ) : (
              <label className="block text-sm font-medium text-body">
                Título del anuncio
                <span className="text-error"> *</span>
                <input
                  value={headerDraft.propertyTitle}
                  maxLength={PROPERTY_TITLE_MAX}
                  placeholder="Ej. Casa compartida Chapalita / Depa zona Minerva"
                  onChange={(e) =>
                    setHeaderDraft((h) => ({ ...h, propertyTitle: e.target.value }))
                  }
                  className={WIZARD_FIELD_CONTROL_CLASS}
                />
                <FieldCharCount
                  current={headerDraft.propertyTitle.trim().length}
                  min={PROPERTY_TITLE_MIN}
                  max={PROPERTY_TITLE_MAX}
                  warnBelowMin
                  className="mt-1"
                />
              </label>
            )}
            {!isRoomOfProperty ? (
              <>
              <label className="mt-2 block text-sm font-medium text-body">
                Colonia o zona
                <input
                  value={headerDraft.neighborhood}
                  onChange={(e) => setHeaderDraft((h) => ({ ...h, neighborhood: e.target.value }))}
                  className={WIZARD_FIELD_CONTROL_CLASS}
                />
              </label>
              <label className="mt-2 block text-sm font-medium text-body">
                Ciudad
                <select
                  value={headerDraft.city}
                  onChange={(e) =>
                    setHeaderDraft((h) => ({
                      ...h,
                      city: e.target.value as Draft["city"],
                    }))
                  }
                  className={WIZARD_FIELD_CONTROL_CLASS}
                >
                  {(Object.keys(CITY_ANCHOR) as Array<keyof typeof CITY_ANCHOR>).map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </label>
              </>
            ) : null}
            {!headerUsesPropertyFields ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="block text-sm font-medium text-body">
                  Renta (MXN / mes)
                  <span className="text-error"> *</span>
                  <input
                    id={PUBLISH_PREVIEW_RENT_INPUT_ID}
                    type="number"
                    min={0}
                    step={100}
                    value={headerDraft.rentMxn === 0 ? "" : headerDraft.rentMxn}
                    onChange={(e) =>
                      setHeaderDraft((h) => ({
                        ...h,
                        rentMxn: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className={`mt-1 w-full rounded-lg bg-surface px-3 py-2 text-base sm:text-sm ${
                      isListingRentMissing(headerDraft.rentMxn)
                        ? "border border-error ring-1 ring-error/40"
                        : "border border-border"
                    }`}
                  />
                </label>
                <label className="block text-sm font-medium text-body">
                  Depósito (MXN)
                  <input
                    id={PUBLISH_ROOM_MODAL_DEPOSIT_INPUT_ID}
                    type="number"
                    min={0}
                    step={100}
                    value={headerDraft.depositMxn === 0 ? "" : headerDraft.depositMxn}
                    onChange={(e) =>
                      setHeaderDraft((h) => ({
                        ...h,
                        depositMxn: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className={WIZARD_FIELD_CONTROL_CLASS}
                  />
                </label>
              </div>
            ) : null}
          </InlineFieldEditor>
        ) : (
          <>
            <p className="mt-3 text-sm text-muted">
              {listing.neighborhood} · {listing.city}
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-primary sm:text-3xl">
              {previewHeaderTitle}
            </h1>
            {!isPropertyPreview && draft.postMode === "property" && listing.title.trim() ? (
              <p className="mt-1 text-sm text-muted">Recámara: {listing.title}</p>
            ) : null}
            {isPropertyPreview ? (
              propertyRentMissing ? (
                <div className="mt-3">
                  <MissingRentCallout
                    onEdit={() => {
                      const idx = firstRoomIndexMissingRent(draft);
                      if (idx >= 0) openRoomModal(idx);
                    }}
                  />
                </div>
              ) : propertyPriceLabel ? (
                <p className="mt-2 text-2xl font-bold text-body">{propertyPriceLabel}</p>
              ) : null
            ) : !headerUsesPropertyFields ? (
              rentMissing ? (
                <div className="mt-3">
                  <MissingRentCallout onEdit={editingHeader ? undefined : openHeaderEdit} />
                </div>
              ) : (
                <ListingHeroPrice rentMxn={listing.rentMxn} />
              )
            ) : null}
            <ListingHeaderBadges
              postMode={draft.postMode}
              roommateGenderPref={firstAvailableRoom.roommateGenderPref}
              availableFrom={isPropertyPreview || isPropertyScope ? undefined : room.availableFrom}
              occupiedByMenCount={occupantCounts.occupiedByMenCount}
              occupiedByWomenCount={occupantCounts.occupiedByWomenCount}
              propertyBedroomsTotal={draft.propertyBedroomsTotal}
              propertyBathrooms={draft.propertyBathrooms}
              propertyKind={draft.propertyKind}
              tags={draft.propertyTags}
            />
            {!isPropertyPreview && !isPropertyScope && (listing.depositMxn ?? 0) > 0 ? (
              <p className="mt-2 text-sm text-muted">Depósito · {money.format(listing.depositMxn ?? 0)}</p>
            ) : null}
            <div className="relative mt-3 min-w-0 max-w-full">
              {editingPhone ? (
                <div className="min-w-0 max-w-full space-y-2.5 rounded-xl bg-surface p-3 ring-1 ring-primary/30">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Teléfono / móvil
                  </p>
                  {/* phone input — no label, no whatsapp hint; title above is enough */}
                  <PhoneNumberField
                    id="preview-contact-phone"
                    value={normalizeMxNationalDigits(phoneDraft.contactWhatsApp) ?? phoneDraft.contactWhatsApp.replace(/\D/g, "").slice(0, 10)}
                    onChange={(national) => {
                      const hadDigits = Boolean(phoneDigitsForStorage(normalizeMxNationalDigits(phoneDraft.contactWhatsApp) ?? phoneDraft.contactWhatsApp.replace(/\D/g, "").slice(0, 10)));
                      const nextDigits = phoneDigitsForStorage(normalizeMxNationalDigits(national) ?? national.replace(/\D/g, "").slice(0, 10));
                      setPhoneDraft((p) => ({
                        ...p,
                        contactWhatsApp: national,
                        showWhatsApp: nextDigits && !hadDigits ? true : p.showWhatsApp,
                      }));
                    }}
                    showLabel={false}
                    showWhatsAppHint={false}
                    className="min-w-0"
                  />
                  {/* show-in-post toggle */}
                  <label className="grid cursor-pointer grid-cols-[1.125rem_minmax(0,1fr)] items-center gap-x-3 py-0.5 text-sm text-body">
                    <input
                      type="checkbox"
                      className="size-[1.125rem] rounded border-border accent-primary"
                      checked={phoneDraft.showWhatsApp}
                      disabled={!phoneDigitsForStorage(normalizeMxNationalDigits(phoneDraft.contactWhatsApp) ?? phoneDraft.contactWhatsApp.replace(/\D/g, "").slice(0, 10))}
                      onChange={(e) => setPhoneDraft((p) => ({ ...p, showWhatsApp: e.target.checked }))}
                    />
                    <span className="min-w-0 break-words leading-snug">Mostrar en la publicación</span>
                  </label>
                  {/* save-to-profile — only when there is no profile phone */}
                  {canSavePhoneToProfile && phoneDigitsForStorage(normalizeMxNationalDigits(phoneDraft.contactWhatsApp) ?? "") && !profilePhoneE164 ? (
                    <label className="grid cursor-pointer grid-cols-[1.125rem_minmax(0,1fr)] items-center gap-x-3 py-0.5 text-sm text-body">
                      <input
                        type="checkbox"
                        className="size-[1.125rem] rounded border-border accent-primary"
                        checked={savePhoneToProfile}
                        onChange={(e) => onSavePhoneToProfileChange?.(e.target.checked)}
                      />
                      <span className="min-w-0 break-words leading-snug">Guardar como teléfono de perfil</span>
                    </label>
                  ) : null}
                  {/* replace-profile — only when post number differs */}
                  {canSavePhoneToProfile && phoneDigitsForStorage(normalizeMxNationalDigits(phoneDraft.contactWhatsApp) ?? "") && profilePhoneE164 &&
                    phoneDigitsForStorage(normalizeMxNationalDigits(phoneDraft.contactWhatsApp) ?? "") !== phoneDigitsForStorage(profilePhoneE164) ? (
                    <label className="grid cursor-pointer grid-cols-[1.125rem_minmax(0,1fr)] items-start gap-x-3 py-0.5 text-sm text-body">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-[1.125rem] rounded border-border accent-primary"
                        checked={savePhoneToProfile}
                        onChange={(e) => onSavePhoneToProfileChange?.(e.target.checked)}
                      />
                      <span className="min-w-0 break-words leading-snug">
                        Reemplazar teléfono de perfil
                        <span className="mt-0.5 block text-xs text-muted">
                          Actual: {formatMxPhoneDisplay(profilePhoneE164)}
                        </span>
                      </span>
                    </label>
                  ) : null}
                  {/* actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={savePhone}
                      className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-fg"
                    >
                      Listo
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPhone(false)}
                      className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-body"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-xl border border-border/80 bg-surface/80 px-3 py-2.5 sm:px-3.5 sm:py-3">
                  <PreviewPencilEditButton
                    onClick={openPhoneEdit}
                    ariaLabel={
                      phoneDigitsForStorage(draft.contactWhatsApp)
                        ? "Editar teléfono"
                        : "Agregar teléfono"
                    }
                    className="absolute right-2 top-2 z-10 sm:right-2.5 sm:top-2.5"
                  />
                  <div className="min-w-0 pr-10">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Teléfono / móvil
                    </p>
                    {phoneDigitsForStorage(draft.contactWhatsApp) && draft.showWhatsApp ? (
                      <p className="mt-0.5 break-all font-mono text-base tabular-nums text-body sm:text-sm">
                        {formatMxPhoneDisplay(draft.contactWhatsApp)}
                      </p>
                    ) : phoneDigitsForStorage(draft.contactWhatsApp) && !draft.showWhatsApp ? (
                      <p className="mt-0.5 text-sm text-muted">
                        Guardado · oculto
                        <span className="hidden sm:inline"> ({formatMxPhoneDisplay(draft.contactWhatsApp)})</span>
                      </p>
                    ) : (
                      <p className="mt-0.5 text-sm text-muted">Sin teléfono · opcional</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </header>

      <PreviewSection title="Fotos" onEdit={() => setPhotosEditing(true)} editLabel="Editar fotos">
        {editingPhotos ? (
          <InlineFieldEditor
            label="Galería de fotos"
            onSave={() => setPhotosEditing(false)}
            onCancel={() => setPhotosEditing(false)}
            saveLabel="Listo"
          >
            {showPropertyBlocks && draft.postMode === "property" && photosForAssign.length > 0 ? (
              <div className="mb-4 rounded-lg border border-border bg-bg-light p-3 text-sm">
                <p className="font-medium text-body">Mover fotos a cada recámara</p>
                <p className="mt-1 text-xs text-muted">
                  Las fotos del dump quedan en áreas compartidas. Elige una recámara, o ábrela y
                  tócalas en «Usar fotos cargadas en esta habitación».
                </p>
                {draft.unassignedImageUrls.length > 0 ? (
                  <p className="mt-2 text-sm font-medium text-warning-fg">
                    {draft.unassignedImageUrls.length} foto(s) sin categorizar — asígnalas antes de publicar.
                  </p>
                ) : null}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {photosForAssign.map((photo) => (
                    <div key={photo.url} className="flex items-start gap-3 rounded-lg border border-border bg-surface p-2">
                      <img
                        src={apiAbsoluteUrl(photo.url)}
                        alt=""
                        className="h-14 w-14 rounded-lg object-cover ring-1 ring-border"
                        loading="lazy"
                      />
                      <label className="min-w-0 flex-1 text-xs font-semibold text-muted">
                        Asignar a…
                        <select
                          className="mt-1 min-h-11 w-full rounded-lg border border-border bg-bg-light px-2 py-1.5 text-base text-body sm:text-sm"
                          value={photo.dest}
                          onChange={(e) => {
                            const dest = parsePhotoAssignDest(e.target.value);
                            if (!dest || dest === photo.dest) return;
                            onDraftChange((d) => assignDraftPhoto(d, photo.url, dest));
                          }}
                        >
                          <option value="uncat">Sin categorizar</option>
                          <option value="shared">Áreas compartidas</option>
                          <option value="facade">Fachada</option>
                          {draft.rooms.map((r, idx) => (
                            <option key={r.id || idx} value={`room:${idx + 1}`}>
                              {roomPreviewOptionLabel(r, idx)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {showPropertyBlocks && draft.postMode === "property" ? (
              <BulkImageUploader
                title="Áreas compartidas / fachada"
                images={preferDraftImages(draft.commonAreaPhotos, draft.propertyImageUrls)}
                maxCount={20}
                apiOn={apiOn}
                onPickerOpen={onPhotoPickerOpen}
                onImagesChange={(next) =>
                  onDraftChange((d) =>
                    syncDraftPhotoArrays({
                      ...d,
                      commonAreaPhotos: next,
                      propertyImageUrls: next,
                    }),
                  )
                }
              />
            ) : null}
            {showRoomBlocks ? (
              <BulkImageUploader
                title={draft.postMode === "room" ? "Fotos de tu espacio" : `Recámara ${roomIndex + 1}`}
                images={draftRoomEditorImages(draft, roomIndex)}
                maxCount={20}
                apiOn={apiOn}
                hint={draft.postMode === "room" ? ROOM_SINGLE_FLOW_PHOTO_HINT : undefined}
                onPickerOpen={onPhotoPickerOpen}
                onImagesChange={(next) =>
                  onDraftChange((d) =>
                    syncDraftPhotoArrays({
                      ...d,
                      rooms: d.rooms.map((r, ri) => (ri === roomIndex ? { ...r, photos: next } : r)),
                      roomImageUrls: d.roomImageUrls.map((row, ri) =>
                        ri === roomIndex ? next : row,
                      ),
                    }),
                  )
                }
              />
            ) : null}
            {showPropertyBlocks && draft.postMode === "property" ? (
              <BulkImageUploader
                title="Fotos a categorizar"
                images={draft.unassignedImageUrls}
                maxCount={Math.min(120, draft.rooms.length * 20 + 40)}
                apiOn={apiOn}
                hint="Sube aquí y luego asígnalas arriba o en el paso de etiquetado."
                onPickerOpen={onPhotoPickerOpen}
                onImagesChange={(next) =>
                  onDraftChange((d) => syncDraftPhotoArrays({ ...d, unassignedImageUrls: next }))
                }
              />
            ) : null}
          </InlineFieldEditor>
        ) : galleryUrls.length ? (
          <ListingPhotoGallery urls={galleryUrls} />
        ) : (
          <p className="text-sm text-muted">
            Aún no hay fotos. Usa el ícono de lápiz en Fotos para agregarlas.
          </p>
        )}
      </PreviewSection>

      {showPropertyBlocks && draft.postMode === "property" ? (
        <PreviewSection title="Sobre la propiedad">
          <ResizableTextarea
            id={PUBLISH_PREVIEW_PROPERTY_SUMMARY_FIELD_ID}
            value={propertySummaryDraft}
            onChange={(e) => setPropertySummaryDraft(e.target.value)}
            onBlur={flushPropertySummary}
            rows={6}
            maxLength={PROPERTY_SUMMARY_MAX}
            placeholder={PROPERTY_SUMMARY_PLACEHOLDER}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base sm:text-sm"
          />
          <FieldCharCount
            current={propertySummaryDraft.trim().length}
            min={PROPERTY_SUMMARY_MIN}
            max={PROPERTY_SUMMARY_MAX}
            warnBelowMin
            className="mt-1"
          />
        </PreviewSection>
      ) : null}

      {showRoomBlocks ? (
      <PreviewSection
        id={PUBLISH_PREVIEW_ROOM_DESCRIPTION_ID}
        className="scroll-mt-24"
        title="Descripción de la recámara"
      >
        <ResizableTextarea
          id={PUBLISH_PREVIEW_ROOM_DESCRIPTION_FIELD_ID}
          value={roomSummaryDraft}
          onChange={(e) => setRoomSummaryDraft(e.target.value)}
          onBlur={flushRoomSummary}
          rows={6}
          maxLength={ROOM_SUMMARY_MAX}
          placeholder={ROOM_SUMMARY_PLACEHOLDER}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base sm:text-sm"
        />
        <FieldCharCount
          current={roomSummaryDraft.trim().length}
          min={ROOM_SUMMARY_MIN}
          max={ROOM_SUMMARY_MAX}
          warnBelowMin
          className="mt-1"
        />
        <ScopeTagsBlock
          heading="Etiquetas de la recámara"
          tags={roomTagsActive}
          unselectedTags={unselectedRoomTags}
          onToggle={toggleRoomTag}
        />
      </PreviewSection>
      ) : null}

      {showPropertyBlocks ? (
        <PreviewSection title="Amenidades de la propiedad">
          <ListingTagChips
            tags={propertyTagsActive}
            unselectedTags={unselectedPropertyTags}
            onToggle={togglePropertyTag}
          />
        </PreviewSection>
      ) : null}

      {showPropertyBlocks ? (
        <PreviewSection
          title="Resumen de la propiedad"
          onEdit={editingPropertyFacts ? undefined : openPropertyFactsEdit}
          editLabel="Editar resumen"
        >
          {editingPropertyFacts ? (
            <InlineFieldEditor
              label="Tipo de vivienda, recámaras y quién vive aquí"
              onSave={savePropertyFacts}
              onCancel={() => setEditingPropertyFacts(false)}
            >
              <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
                <label className="block text-sm font-medium text-body">
                  Tipo de vivienda
                  <select
                    value={propertyFactsDraft.propertyKind}
                    onChange={(e) => {
                      const kind = e.target.value as PropertyKind;
                      setPropertyFactsDraft((f) => ({
                        ...f,
                        propertyKind: kind,
                        propertyBedroomsTotal: kind === "loft" ? 1 : f.propertyBedroomsTotal,
                      }));
                    }}
                    className={WIZARD_FIELD_CONTROL_CLASS}
                  >
                    <option value="house">Casa</option>
                    <option value="apartment">Departamento</option>
                    <option value="loft">Loft</option>
                  </select>
                </label>
                <div className="block text-sm font-medium text-body">
                  <span className="block">Recámaras en la propiedad</span>
                  {propertyFactsDraft.propertyKind !== "loft" ? (
                    <span className="mb-1 block text-xs font-normal text-muted">
                      (habitadas + disponibles)
                    </span>
                  ) : null}
                  <WizardNumberStepper
                    compact
                    value={
                      propertyFactsDraft.propertyKind === "loft"
                        ? 1
                        : Math.min(
                            PROPERTY_BEDROOMS_MAX,
                            Math.max(1, propertyFactsDraft.propertyBedroomsTotal),
                          )
                    }
                    min={1}
                    max={PROPERTY_BEDROOMS_MAX}
                    disabled={propertyFactsDraft.propertyKind === "loft"}
                    onChange={(n) =>
                      setPropertyFactsDraft((f) => ({ ...f, propertyBedroomsTotal: n }))
                    }
                    decrementLabel="Menos recámaras"
                    incrementLabel="Más recámaras"
                  />
                  {propertyFactsDraft.propertyKind === "loft" ? (
                    <span className="mt-1 block text-xs text-muted">
                      Un loft cuenta como 1 recámara.
                    </span>
                  ) : null}
                </div>
                {draft.postMode === "room" ? (
                  <div className="block text-sm font-medium text-body">
                    <span className="block">{propertyFactsDraft.propertyKind === "loft" ? "Baños" : "Baños (total)"}</span>
                    <WizardNumberStepper
                      compact
                      editableCenter
                      step={0.5}
                      value={Math.min(
                        PROPERTY_BATHROOMS_MAX,
                        Math.max(0, propertyFactsDraft.propertyBathrooms),
                      )}
                      min={0}
                      max={PROPERTY_BATHROOMS_MAX}
                      onChange={(n) =>
                        setPropertyFactsDraft((f) => ({ ...f, propertyBathrooms: n }))
                      }
                      decrementLabel="Menos baños"
                      incrementLabel="Más baños"
                    />
                  </div>
                ) : null}
                {draft.postMode === "room" ? (
                  <>
                    <div className="block text-sm font-medium text-body">
                      <span className="block">Besties actuales · mujeres</span>
                      <span className="block text-xs font-normal text-muted">
                        Personas que viven actualmente en la propiedad
                      </span>
                      <WizardNumberStepper
                        compact
                        value={Math.min(
                          PROPERTY_OCCUPANTS_MAX,
                          Math.max(0, propertyFactsDraft.occupiedByWomenCount),
                        )}
                        min={0}
                        max={PROPERTY_OCCUPANTS_MAX}
                        onChange={(n) =>
                          setPropertyFactsDraft((f) => ({ ...f, occupiedByWomenCount: n }))
                        }
                        decrementLabel="Menos mujeres"
                        incrementLabel="Más mujeres"
                      />
                    </div>
                    <div className="block text-sm font-medium text-body">
                      <span className="block">Besties actuales · hombres</span>
                      <span className="block text-xs font-normal text-muted">
                        Personas que viven actualmente en la propiedad
                      </span>
                      <WizardNumberStepper
                        compact
                        value={Math.min(
                          PROPERTY_OCCUPANTS_MAX,
                          Math.max(0, propertyFactsDraft.occupiedByMenCount),
                        )}
                        min={0}
                        max={PROPERTY_OCCUPANTS_MAX}
                        onChange={(n) =>
                          setPropertyFactsDraft((f) => ({ ...f, occupiedByMenCount: n }))
                        }
                        decrementLabel="Menos hombres"
                        incrementLabel="Más hombres"
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted sm:col-span-2">
                    Besties actuales se calculan a partir de las recámaras ocupadas.
                  </p>
                )}
              </div>
            </InlineFieldEditor>
          ) : (
            <ListingPropertySummaryGrid
              propertyKind={draft.propertyKind}
              propertyBedroomsTotal={draft.propertyBedroomsTotal}
              propertyBathrooms={
                draft.postMode === "room" ? draft.propertyBathrooms : undefined
              }
              occupiedByWomenCount={occupantCounts.occupiedByWomenCount}
              occupiedByMenCount={occupantCounts.occupiedByMenCount}
              showEmptyOccupants
            />
          )}
        </PreviewSection>
      ) : null}

      {showRoomBlocks ? (
        <PreviewSection
          id={PUBLISH_PREVIEW_ROOM_DETAILS_ID}
          className="scroll-mt-24"
          title="Detalles de la recámara"
          onEdit={openRoomDetailsEdit}
          editLabel="Editar detalles"
        >
        {editingRoomDetails && roomDetailsDraft ? (
          <InlineFieldEditor
            label="Tipo, disponibilidad y perfil buscado"
            onSave={saveRoomDetails}
            onCancel={() => {
              setEditingRoomDetails(false);
              setRoomDetailsDraft(null);
            }}
          >
            <div className="grid items-start gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-body">
                <WizardPairedFieldLabel>
                  {draft.postMode === "room" ? "Tipo de recámara" : "Tipo de espacio"}
                </WizardPairedFieldLabel>
                <select
                  id={PUBLISH_ROOM_MODAL_LODGING_ID}
                  value={
                    draft.postMode === "room" && detailsRoom.lodgingType === "whole_home"
                      ? "private_room"
                      : detailsRoom.lodgingType
                  }
                  onChange={(e) =>
                    setRoomDetailsDraft((r) =>
                      r ? { ...r, lodgingType: e.target.value as LodgingType } : r,
                    )
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
                <WizardPairedFieldLabel>Tamaño de la recámara</WizardPairedFieldLabel>
                <select
                  id={PUBLISH_ROOM_MODAL_DIMENSION_ID}
                  value={detailsRoom.roomDimension}
                  onChange={(e) =>
                    setRoomDetailsDraft((r) =>
                      r ? { ...r, roomDimension: e.target.value as RoomDimension } : r,
                    )
                  }
                  className={WIZARD_FIELD_CONTROL_CLASS}
                >
                  <option value="small">Individual (Cabe cama individual + buró)</option>
                  <option value="medium">Matrimonial (Cabe cama matrimonial + escritorio)</option>
                  <option value="large">Grande (Cabe cama Queen/King + área de estar)</option>
                </select>
              </label>
              {draft.postMode === "property" ? (
                <div className="block text-sm font-medium text-body">
                  <WizardPairedFieldLabel>Plazas / espacios</WizardPairedFieldLabel>
                  <WizardNumberStepper
                    compact
                    value={Math.min(ROOM_PLAZAS_MAX, Math.max(0, detailsRoom.roomsAvailable))}
                    min={0}
                    max={ROOM_PLAZAS_MAX}
                    onChange={(n) =>
                      setRoomDetailsDraft((r) => (r ? { ...r, roomsAvailable: n } : r))
                    }
                    decrementLabel="Menos plazas"
                    incrementLabel="Más plazas"
                  />
                </div>
              ) : null}
              <label className="block text-sm font-medium text-body">
                <WizardPairedFieldLabel>Disponible desde</WizardPairedFieldLabel>
                <input
                  id={PUBLISH_ROOM_MODAL_AVAILABLE_FROM_ID}
                  type="date"
                  value={detailsRoom.availableFrom}
                  onChange={(e) =>
                    setRoomDetailsDraft((r) => (r ? { ...r, availableFrom: e.target.value } : r))
                  }
                  className={WIZARD_FIELD_CONTROL_CLASS}
                />
              </label>
              <div id={PUBLISH_ROOM_MODAL_STAY_ID} className="block text-sm font-medium text-body">
                <WizardPairedFieldLabel>Estancia mín. (meses)</WizardPairedFieldLabel>
                <WizardNumberStepper
                  editableCenter
                  maxInputDigits={2}
                  value={Math.min(ROOM_STAY_MAX, Math.max(0, detailsRoom.minimalStayMonths))}
                  min={0}
                  max={ROOM_STAY_MAX}
                  onChange={(n) =>
                    setRoomDetailsDraft((r) => (r ? { ...r, minimalStayMonths: n } : r))
                  }
                  decrementLabel="Menos meses"
                  incrementLabel="Más meses"
                />
              </div>
              <label className="block text-sm font-medium text-body">
                <WizardPairedFieldLabel>{ROOMMATE_GENDER_PREF_FIELD_LABEL_SHORT}</WizardPairedFieldLabel>
                <select
                  id={PUBLISH_ROOM_MODAL_GENDER_ID}
                  value={detailsRoom.roommateGenderPref}
                  onChange={(e) =>
                    setRoomDetailsDraft((r) =>
                      r ? { ...r, roommateGenderPref: e.target.value as RoommateGenderPref } : r,
                    )
                  }
                  className={WIZARD_FIELD_CONTROL_CLASS}
                >
                  <option value="any">Sin preferencia</option>
                  <option value="female">Mujeres</option>
                  <option value="male">Hombres</option>
                </select>
              </label>
              <div id={PUBLISH_ROOM_MODAL_AGE_MIN_ID} className="block text-sm font-medium text-body">
                <WizardPairedFieldLabel>Edad mín.</WizardPairedFieldLabel>
                <WizardNumberStepper
                  editableCenter
                  maxInputDigits={2}
                  value={Math.min(99, Math.max(18, detailsRoom.ageMin))}
                  min={18}
                  max={99}
                  onChange={(n) =>
                    setRoomDetailsDraft((r) =>
                      r ? { ...r, ageMin: n, ageMax: r.ageMax < n ? n : r.ageMax } : r,
                    )
                  }
                  decrementLabel="Menor edad mínima"
                  incrementLabel="Mayor edad mínima"
                />
              </div>
              <div id={PUBLISH_ROOM_MODAL_AGE_MAX_ID} className="block text-sm font-medium text-body">
                <WizardPairedFieldLabel>Edad máx.</WizardPairedFieldLabel>
                <WizardNumberStepper
                  editableCenter
                  maxInputDigits={2}
                  value={Math.min(99, Math.max(18, detailsRoom.ageMax))}
                  min={18}
                  max={99}
                  onChange={(n) =>
                    setRoomDetailsDraft((r) =>
                      r ? { ...r, ageMax: n, ageMin: r.ageMin > n ? n : r.ageMin } : r,
                    )
                  }
                  decrementLabel="Menor edad máxima"
                  incrementLabel="Mayor edad máxima"
                />
              </div>
              {draft.postMode === "room" ? (
                <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-elevated/50 px-3 py-2.5 text-body">
                    <input
                      type="checkbox"
                      checked={detailsRoom.rentIncludesUtilities}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setRoomDetailsDraft((r) => (r ? { ...r, rentIncludesUtilities: checked } : r));
                      }}
                      className="mt-0.5 size-4 shrink-0 rounded border-border text-primary"
                    />
                    <span>
                      <span className="block text-sm font-medium text-body">Servicios básicos incluidos</span>
                      <span className="mt-0.5 block text-xs text-muted leading-snug">
                        Activa esta opción si el precio de renta ya cubre luz, agua, gas e internet (Wi-Fi).
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-elevated/50 px-3 py-2.5 text-body">
                    <input
                      type="checkbox"
                      checked={detailsRoom.avalRequired}
                      onChange={(e) =>
                        setRoomDetailsDraft((r) => (r ? { ...r, avalRequired: e.target.checked } : r))
                      }
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
              ) : null}
            </div>
          </InlineFieldEditor>
        ) : (
          <ListingRoomDetailsGrid
            room={detailsRoom}
            postMode={draft.postMode}
            roomCount={draft.rooms.length}
            propertyTags={draft.propertyTags}
          />
        )}
      </PreviewSection>
      ) : null}

      {isPropertyPreview ? (
        <PreviewSection title="Recámaras" subtitle="Toca una recámara para editarla.">
          <div className="space-y-6">
            {draft.rooms.some((r) => !isRoomAvailableForRent(r)) ? (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Cuartos ocupados
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {draft.rooms.map((r, idx) =>
                    !isRoomAvailableForRent(r) ? (
                      <RoomPreviewCard
                        key={r.id || idx}
                        room={r}
                        index={idx}
                        draft={draft}
                        onEdit={() => openRoomModal(idx)}
                        onRename={(name) => renameRoomAt(idx, name)}
                        onAvailabilityChange={(nextAvailable) =>
                          onDraftChange((d) =>
                            setRoomOccupancyStatus(d, idx, nextAvailable ? "available" : "occupied"),
                          )
                        }
                      />
                    ) : null,
                  )}
                </div>
              </div>
            ) : null}
            {draft.rooms.some((r) => isRoomAvailableForRent(r)) ? (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Cuartos disponibles
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {draft.rooms.map((r, idx) =>
                    isRoomAvailableForRent(r) ? (
                      <RoomPreviewCard
                        key={r.id || idx}
                        room={r}
                        index={idx}
                        draft={draft}
                        onEdit={() => openRoomModal(idx)}
                        onRename={(name) => renameRoomAt(idx, name)}
                        onAvailabilityChange={(nextAvailable) =>
                          onDraftChange((d) =>
                            setRoomOccupancyStatus(d, idx, nextAvailable ? "available" : "occupied"),
                          )
                        }
                      />
                    ) : null,
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </PreviewSection>
      ) : null}

      <PreviewSection title="Ubicación">
        {isRoomOfProperty ? (
          <p className="mb-3 text-sm text-muted">
            La ubicación y el Street View pertenecen a la propiedad. Edítalos desde Mis anuncios con{" "}
            <strong className="font-medium text-body">Editar</strong> en la tarjeta de la propiedad.
          </p>
        ) : null}
        <PreviewPropertyLocationMap
          listing={listing}
          mapCenter={mapCenter}
          isApproximateLocation={draft.isApproximateLocation}
          useCustomMapPin={draft.useCustomMapPin}
          streetViewPov={draft.streetViewPov}
          canEdit={canEditLocation}
          onSaveCoordinates={saveMapCoordinates}
          onStreetViewPovChange={(pov) =>
            onDraftChange((d) => ({ ...d, streetViewPov: pov }))
          }
          onToggleStreetView={(enabled) =>
            onDraftChange((d) => ({
              ...d,
              useCustomMapPin: enabled,
              streetViewPov: enabled ? d.streetViewPov : undefined,
            }))
          }
          onSwitchToPrecise={() =>
            onDraftChange((d) => ({
              ...d,
              isApproximateLocation: false,
              useCustomMapPin: true,
            }))
          }
          onPrivacyChange={({ isApproximateLocation, approximateRadiusMeters }) =>
            onDraftChange((d) => ({
              ...d,
              isApproximateLocation,
              approximateRadiusMeters: isApproximateLocation
                ? clampApproximateRadiusMeters(approximateRadiusMeters)
                : d.approximateRadiusMeters,
              useCustomMapPin: true,
              ...(isApproximateLocation ? { streetViewPov: undefined } : {}),
            }))
          }
        />
      </PreviewSection>
      {roomModal}
    </div>
  );
}

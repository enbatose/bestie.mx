import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { BulkImageUploader } from "@/components/BulkImageUploader";
import { ListingPhotoGallery } from "@/components/listing/ListingPhotoGallery";
import {
  ListingPropertySummaryGrid,
  ListingRoomDetailsGrid,
} from "@/components/listing/ListingPropertySummaryGrid";
import { ListingSection } from "@/components/listing/ListingSection";
import { ListingTagChips, listingTagLabel } from "@/components/listing/ListingTagChips";
import { ListingHeaderBadges, ListingHeroPrice, publicListingHeaderTitle } from "@/components/listing/PublicListingHeader";
import { FieldCharCount } from "@/components/publish/FieldCharCount";
import { MissingRentCallout } from "@/components/publish/MissingRentCallout";
import { ResizableTextarea } from "@/components/publish/ResizableTextarea";
import { PreviewPropertyLocationMap } from "@/components/publish/PreviewPropertyLocationMap";
import { TagChoiceSection } from "@/components/publish/TagChoiceSection";
import {
  WizardNumberStepper,
  WizardPairedFieldLabel,
  WIZARD_FIELD_CONTROL_CLASS,
} from "@/components/WizardNumberStepper";
import { apiAbsoluteUrl } from "@/lib/mediaUrl";
import { listingGalleryImageUrls } from "@/lib/listingImageUrls";
import {
  PROPERTY_SUMMARY_MAX,
  PROPERTY_SUMMARY_MIN,
  PROPERTY_TITLE_MAX,
  PROPERTY_TITLE_MIN,
  ROOM_SUMMARY_MAX,
  ROOM_SUMMARY_MIN,
  CITY_ANCHOR,
  effectiveWizardPropertyBathrooms,
} from "@/lib/publishWizard/publishCore";
import { draftToListingPreview } from "@/lib/publishWizard/draftPreview";
import {
  derivedPropertyOccupantCounts,
  syncPropertyRoomSlotsToTotal,
} from "@/lib/publishWizard/propertyRoomSlots";
import { newRoomDraftId } from "@/lib/roomDisplay";
import { streetViewPovCacheKey } from "@/lib/streetView";
import {
  PROPERTY_TAG_GROUPS,
  ROOM_TAG_GROUPS,
  ROOMMATE_GENDER_PREF_FIELD_LABEL_SHORT,
  filterPropertyScopeTags,
  filterRoomScopeTags,
  isListingRentMissing,
  sortRoomScopeTags,
} from "@/lib/listingTags";
import {
  draftImagesAppend,
  draftImagesWithoutUrl,
  preferDraftImages,
  syncDraftPhotoArrays,
} from "@/lib/publishWizard/draftImages";
import {
  ROOM_SINGLE_FLOW_PHOTO_HINT,
  roomsAvailableFromIdealTags,
} from "@/lib/publishWizard/wizardTags";
import type { Draft, RoomDraft } from "@/pages/PublishWizardPage";
import type { ListingTag, LodgingType, PropertyKind, RoomDimension, RoommateGenderPref } from "@/types/listing";
import type { ListingTagGroup } from "@/lib/listingTags";
import type { LiveEditScope } from "@/components/publish/PublishWizardReviewStep";

const ROOM_PLAZAS_MAX = 12;
const ROOM_STAY_MAX = 36;
const PROPERTY_BEDROOMS_MAX = 20;
const PROPERTY_OCCUPANTS_MAX = 50;

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
  /** Re-open photo editor after camera/gallery remount (live edit). */
  initialEditingPhotos?: boolean;
  /** Notify parent when the inline photo editor opens/closes (persist across remounts). */
  onEditingPhotosChange?: (editing: boolean) => void;
  /** Flush live-edit snapshot before OS camera/gallery may kill the tab. */
  onPhotoPickerOpen?: () => void;
  /** Show unselected tags dimmed so the user can see what the AI skipped (AI draft + preview only). */
  isAssistedDraft?: boolean;
};

function PreviewSection({
  title,
  children,
  onEdit,
  editLabel = "Editar",
}: {
  title: string;
  children: React.ReactNode;
  onEdit?: () => void;
  editLabel?: string;
}) {
  return (
    <ListingSection
      title={title}
      action={
        onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold text-primary transition hover:bg-surface-elevated"
          >
            <Pencil className="size-3.5" aria-hidden />
            {editLabel}
          </button>
        ) : undefined
      }
    >
      {children}
    </ListingSection>
  );
}

function InlineFieldEditor({
  label,
  children,
  onSave,
  onCancel,
  saveLabel = "Guardar cambios",
}: {
  label: string;
  children: React.ReactNode;
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      {children}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSave}
          className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-fg"
        >
          {saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-body"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

const TAG_CHIP_ACTIVE =
  "min-w-0 rounded-full px-3 py-2 text-left text-xs font-medium hyphens-manual transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-0 bg-primary text-primary-fg shadow-sm ring-1 ring-primary/20";

function TagGroupsEditor({
  groups,
  selected,
  onToggle,
}: {
  groups: readonly ListingTagGroup[];
  selected: readonly ListingTag[];
  onToggle: (tag: ListingTag) => void;
}) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <TagChoiceSection
          key={group.title}
          title={group.title}
          tags={group.tags}
          selected={selected}
          dashedInactive
          onToggle={(tag) => onToggle(tag)}
        />
      ))}
    </div>
  );
}

function ScopeTagsBlock({
  heading,
  tags,
  editing,
  onStartEdit,
  onSave,
  onCancel,
  editGroups,
  draftTags,
  onToggle,
  hideEditButton = false,
  unselectedTags,
}: {
  heading: string;
  tags: readonly ListingTag[];
  editing: boolean;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  editGroups: readonly ListingTagGroup[];
  draftTags: readonly ListingTag[];
  onToggle: (tag: ListingTag) => void;
  /** Hide the inline "Editar etiquetas" button when the parent section already provides an edit trigger. */
  hideEditButton?: boolean;
  /** Tags NOT selected — shown dimmed in AI-draft preview so the user knows what's available. */
  unselectedTags?: readonly ListingTag[];
}) {
  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{heading}</p>
        {!editing && !hideEditButton ? (
          <button
            type="button"
            onClick={onStartEdit}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-[11px] font-semibold text-primary transition hover:bg-surface-elevated"
          >
            <Pencil className="size-3" aria-hidden />
            Editar etiquetas
          </button>
        ) : null}
      </div>
      <div className="mt-2">
        {editing ? (
          <InlineFieldEditor label="Selecciona las etiquetas" onSave={onSave} onCancel={onCancel}>
            <TagGroupsEditor groups={editGroups} selected={draftTags} onToggle={onToggle} />
          </InlineFieldEditor>
        ) : (
          <>
            <ListingTagChips tags={tags} />
            {unselectedTags && unselectedTags.length > 0 ? (
              <div className="mt-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted/50">
                  No incluidas · edita para agregar
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {unselectedTags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted/50"
                    >
                      {listingTagLabel(t)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function cloneRoomDraft(room: RoomDraft): RoomDraft {
  return { ...room, tags: [...room.tags] };
}

function createPreviewDefaultRoom(d: Draft): RoomDraft {
  const base = d.rooms[0];
  if (base) {
    return {
      ...cloneRoomDraft(base),
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
      summary: "",
      photos: [],
    };
  }
  return {
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
    availableFrom: new Date().toISOString().slice(0, 10),
    minimalStayMonths: 1,
    roomDimension: "medium",
    avalRequired: false,
    rentIncludesUtilities: false,
    photos: [],
  };
}

type PropertyFactsDraft = {
  propertyKind: PropertyKind;
  propertyBedroomsTotal: number;
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
  return {
    propertyKind: d.propertyKind,
    propertyBedroomsTotal: d.propertyKind === "loft" ? 1 : d.propertyBedroomsTotal,
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
  initialEditingPhotos = false,
  onEditingPhotosChange,
  onPhotoPickerOpen,
  isAssistedDraft = false,
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
  /** Wizard review shows everything; scoped live-edit shows only the relevant blocks. */
  const showPropertyBlocks = !isRoomScope;
  const showRoomBlocks = !isPropertyScope;
  /** A room inside a property shares the property's address: edit it from the property screen. */
  const isRoomOfProperty = isRoomScope && draft.postMode === "property";
  const canEditLocation = !isRoomOfProperty;

  const [editingHeader, setEditingHeader] = useState(false);
  const [editingProperty, setEditingProperty] = useState(false);
  const [editingPropertyTags, setEditingPropertyTags] = useState(false);
  const [editingRoom, setEditingRoom] = useState(false);
  const [editingRoomTags, setEditingRoomTags] = useState(false);
  const [editingPhotos, setEditingPhotos] = useState(initialEditingPhotos);
  const [editingRoomDetails, setEditingRoomDetails] = useState(false);
  const [editingPropertyFacts, setEditingPropertyFacts] = useState(false);

  const setPhotosEditing = (next: boolean) => {
    setEditingPhotos(next);
    onEditingPhotosChange?.(next);
  };

  const [headerDraft, setHeaderDraft] = useState({
    neighborhood: draft.neighborhood,
    propertyTitle: draft.propertyTitle,
    roomTitle: room?.title ?? "",
    rentMxn: room?.rentMxn ?? 0,
    depositMxn: room?.depositMxn ?? 0,
  });
  const [propertySummaryDraft, setPropertySummaryDraft] = useState(draft.propertySummary);
  const [propertyTagsDraft, setPropertyTagsDraft] = useState<ListingTag[]>([...draft.propertyTags]);
  const [roomSummaryDraft, setRoomSummaryDraft] = useState(room?.summary ?? "");
  const [roomTagsDraft, setRoomTagsDraft] = useState<ListingTag[]>([]);
  const [roomDetailsDraft, setRoomDetailsDraft] = useState<RoomDraft | null>(null);
  const [propertyFactsDraft, setPropertyFactsDraft] = useState<PropertyFactsDraft>(() =>
    propertyFactsFromDraft(draft),
  );

  const galleryUrls = useMemo(() => {
    if (isPropertyScope) {
      return listingGalleryImageUrls({
        postMode: "property",
        propertyImageUrls: listing.propertyImageUrls,
        roomImageUrls: [],
      });
    }
    if (isRoomScope) {
      return listingGalleryImageUrls({
        postMode: draft.postMode === "room" ? "room" : "property",
        propertyImageUrls: draft.postMode === "room" ? listing.propertyImageUrls : [],
        roomImageUrls: listing.roomImageUrls,
      });
    }
    return listingGalleryImageUrls({
      postMode: listing.propertyPostMode,
      propertyImageUrls: listing.propertyImageUrls,
      roomImageUrls: listing.roomImageUrls,
    });
  }, [
    isPropertyScope,
    isRoomScope,
    draft.postMode,
    listing.propertyPostMode,
    listing.propertyImageUrls,
    listing.roomImageUrls,
  ]);

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

  if (!room) {
    return <p className="text-sm text-muted">No hay recámara seleccionada.</p>;
  }

  const propertyTagsActive = filterPropertyScopeTags(draft.propertyTags);
  const roomTagsActive = sortRoomScopeTags(filterRoomScopeTags(room.tags));

  const showUnselected = isAssistedDraft && variant === "preview";
  const unselectedPropertyTags = showUnselected
    ? (PROPERTY_TAG_GROUPS.flatMap((g) => g.tags).filter(
        (t) => !propertyTagsActive.includes(t),
      ) as ListingTag[])
    : undefined;
  const unselectedRoomTags = showUnselected
    ? (ROOM_TAG_GROUPS.flatMap((g) => g.tags).filter(
        (t) => !roomTagsActive.includes(t),
      ) as ListingTag[])
    : undefined;

  const openHeaderEdit = () => {
    setHeaderDraft({
      neighborhood: draft.neighborhood,
      propertyTitle: draft.propertyTitle,
      roomTitle: room.title,
      rentMxn: room.rentMxn,
      depositMxn: room.depositMxn,
    });
    setEditingHeader(true);
  };

  const saveHeader = () => {
    const nextPropertyTitle = headerDraft.propertyTitle.slice(0, PROPERTY_TITLE_MAX);
    if (isPropertyScope) {
      onDraftChange((d) => ({
        ...d,
        neighborhood: headerDraft.neighborhood,
        propertyTitle: nextPropertyTitle,
      }));
      setEditingHeader(false);
      return;
    }
    onDraftChange((d) => ({
      ...d,
      // Single-room posts use Datos Generales → Título del anuncio (propertyTitle).
      propertyTitle: d.postMode === "room" ? nextPropertyTitle : d.propertyTitle,
      // The colonia belongs to the property, so a room-scoped edit leaves it untouched.
      neighborhood: isRoomOfProperty ? d.neighborhood : headerDraft.neighborhood,
      rooms: d.rooms.map((r, i) =>
        i === roomIndex
          ? {
              ...r,
              title:
                d.postMode === "room"
                  ? nextPropertyTitle.trim() || r.title
                  : headerDraft.roomTitle,
              rentMxn: Math.max(0, headerDraft.rentMxn),
              depositMxn: Math.max(0, headerDraft.depositMxn),
            }
          : r,
      ),
    }));
    setEditingHeader(false);
  };

  const savePropertySummary = () => {
    onDraftChange((d) => ({ ...d, propertySummary: propertySummaryDraft }));
    setEditingProperty(false);
  };

  const openPropertyTagsEdit = () => {
    setPropertyTagsDraft(filterPropertyScopeTags(draft.propertyTags));
    setEditingPropertyTags(true);
  };

  const savePropertyTags = () => {
    onDraftChange((d) => ({
      ...d,
      propertyTags: filterPropertyScopeTags(propertyTagsDraft),
    }));
    setEditingPropertyTags(false);
  };

  const togglePropertyTagDraft = (tag: ListingTag) => {
    setPropertyTagsDraft((prev) => {
      const active = prev.includes(tag);
      return active ? prev.filter((t) => t !== tag) : [...prev, tag];
    });
  };

  const saveRoomSummary = () => {
    onDraftChange((d) => ({
      ...d,
      rooms: d.rooms.map((r, i) => (i === roomIndex ? { ...r, summary: roomSummaryDraft } : r)),
    }));
    setEditingRoom(false);
  };

  const openRoomTagsEdit = () => {
    setRoomTagsDraft(filterRoomScopeTags(room.tags));
    setEditingRoomTags(true);
  };

  const saveRoomTags = () => {
    onDraftChange((d) => ({
      ...d,
      rooms: d.rooms.map((r, i) => {
        if (i !== roomIndex) return r;
        const tags = filterRoomScopeTags(roomTagsDraft);
        return {
          ...r,
          tags,
          roomsAvailable:
            d.postMode === "room" ? roomsAvailableFromIdealTags(tags) : r.roomsAvailable,
        };
      }),
    }));
    setEditingRoomTags(false);
  };

  const toggleRoomTagDraft = (tag: ListingTag) => {
    setRoomTagsDraft((prev) => {
      const active = prev.includes(tag);
      return active ? prev.filter((t) => t !== tag) : [...prev, tag];
    });
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
    onDraftChange((d) => {
      let next: Draft = {
        ...d,
        propertyKind: nextKind,
        propertyBedroomsTotal: nextBedrooms,
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
  const rentMissing = !isPropertyScope && isListingRentMissing(room.rentMxn);

  return (
    <div className="space-y-6">
      <header
        className={`rounded-2xl border border-dashed p-5 ${
          rentMissing ? "border-error/60 bg-error/5" : "border-secondary/50 bg-secondary/5"
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
                : isRoomScope
                  ? `Editando · Recámara ${roomIndex + 1}`
                  : "Editando anuncio"
              : "Vista previa · Borrador"}
          </span>
          {!editingHeader ? (
            <button
              type="button"
              onClick={openHeaderEdit}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <Pencil className="size-3.5" aria-hidden />
              Editar encabezado
            </button>
          ) : null}
        </div>

        {editingHeader ? (
          <InlineFieldEditor
            label={
              isPropertyScope
                ? "Título y colonia"
                : draft.postMode === "room"
                  ? "Título, ubicación y precio"
                  : "Ubicación y precio"
            }
            onSave={saveHeader}
            onCancel={() => setEditingHeader(false)}
          >
            {isPropertyScope ? (
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
            ) : draft.postMode === "property" ? (
              <label className="block text-sm font-medium text-body">
                Título de esta recámara
                <input
                  value={headerDraft.roomTitle}
                  onChange={(e) => setHeaderDraft((h) => ({ ...h, roomTitle: e.target.value }))}
                  className={WIZARD_FIELD_CONTROL_CLASS}
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
              <label className="mt-2 block text-sm font-medium text-body">
                Colonia o zona
                <input
                  value={headerDraft.neighborhood}
                  onChange={(e) => setHeaderDraft((h) => ({ ...h, neighborhood: e.target.value }))}
                  className={WIZARD_FIELD_CONTROL_CLASS}
                />
              </label>
            ) : null}
            {!isPropertyScope ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="block text-sm font-medium text-body">
                  Renta (MXN / mes)
                  <span className="text-error"> *</span>
                  <input
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
                    className={`mt-1 w-full rounded-lg bg-surface px-3 py-2 text-sm ${
                      isListingRentMissing(headerDraft.rentMxn)
                        ? "border border-error ring-1 ring-error/40"
                        : "border border-border"
                    }`}
                  />
                </label>
                <label className="block text-sm font-medium text-body">
                  Depósito (MXN)
                  <input
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
            {!isPropertyScope && draft.postMode === "property" && listing.title.trim() ? (
              <p className="mt-1 text-sm text-muted">Recámara: {listing.title}</p>
            ) : null}
            {!isPropertyScope ? (
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
              roommateGenderPref={room.roommateGenderPref}
              availableFrom={isPropertyScope ? undefined : room.availableFrom}
              occupiedByMenCount={draft.occupiedByMenCount}
              occupiedByWomenCount={draft.occupiedByWomenCount}
              propertyBedroomsTotal={draft.propertyBedroomsTotal}
              propertyBathrooms={effectiveWizardPropertyBathrooms(draft)}
              propertyKind={draft.propertyKind}
              tags={draft.propertyTags}
            />
            {!isPropertyScope && (listing.depositMxn ?? 0) > 0 ? (
              <p className="mt-2 text-sm text-muted">Depósito · {money.format(listing.depositMxn ?? 0)}</p>
            ) : null}
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
            {showPropertyBlocks && draft.postMode === "property" && draft.unassignedImageUrls.length > 0 ? (
              <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning-fg">
                <p className="font-medium">
                  {draft.unassignedImageUrls.length} foto(s) sin categorizar — asígnalas antes de publicar.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {draft.unassignedImageUrls.map((img) => (
                    <div key={img.url} className="flex items-start gap-3 rounded-lg border border-border bg-surface p-2">
                      <img
                        src={apiAbsoluteUrl(img.url)}
                        alt=""
                        className="h-14 w-14 rounded-lg object-cover ring-1 ring-border"
                        loading="lazy"
                      />
                      <label className="min-w-0 flex-1 text-xs font-semibold text-muted">
                        Asignar a…
                        <select
                          className="mt-1 w-full rounded-lg border border-border bg-bg-light px-2 py-1.5 text-sm text-body"
                          defaultValue="uncat"
                          onChange={(e) => {
                            const v = e.target.value;
                            const u = img.url;
                            onDraftChange((d) => {
                              const nextUnassigned = d.unassignedImageUrls.filter((x) => x.url !== u);
                              if (v === "shared") {
                                const nextShared = draftImagesAppend(
                                  preferDraftImages(d.commonAreaPhotos, d.propertyImageUrls),
                                  { url: u, isCover: false },
                                  20,
                                );
                                return syncDraftPhotoArrays({
                                  ...d,
                                  unassignedImageUrls: nextUnassigned,
                                  commonAreaPhotos: nextShared,
                                  propertyImageUrls: nextShared,
                                });
                              }
                              if (v === "facade") {
                                const base = preferDraftImages(d.commonAreaPhotos, d.propertyImageUrls);
                                const nextShared = draftImagesAppend(
                                  draftImagesWithoutUrl(base, u),
                                  { url: u, isCover: true },
                                  20,
                                );
                                return syncDraftPhotoArrays({
                                  ...d,
                                  unassignedImageUrls: nextUnassigned,
                                  commonAreaPhotos: nextShared,
                                  propertyImageUrls: nextShared,
                                });
                              }
                              if (v.startsWith("room:") && !isPropertyScope) {
                                const idx = Number(v.split(":")[1] ?? "1") - 1;
                                if (!Number.isFinite(idx) || idx < 0 || idx >= d.rooms.length) return d;
                                const row = preferDraftImages(d.rooms[idx]?.photos, d.roomImageUrls[idx]);
                                const nextRow = draftImagesAppend(
                                  row,
                                  { url: u, isCover: row.length === 0 },
                                  20,
                                );
                                return syncDraftPhotoArrays({
                                  ...d,
                                  unassignedImageUrls: nextUnassigned,
                                  rooms: d.rooms.map((r, ri) =>
                                    ri === idx ? { ...r, photos: nextRow } : r,
                                  ),
                                  roomImageUrls: d.roomImageUrls.map((r, ri) =>
                                    ri === idx ? nextRow : r,
                                  ),
                                });
                              }
                              return d;
                            });
                          }}
                        >
                          <option value="uncat">Sin categorizar</option>
                          <option value="shared">Áreas compartidas</option>
                          <option value="facade">Fachada</option>
                          {!isPropertyScope
                            ? draft.rooms.map((r, idx) => (
                                <option key={idx} value={`room:${idx + 1}`}>
                                  Recámara {idx + 1}: {r.title.trim() || "Sin título"}
                                </option>
                              ))
                            : null}
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
                images={preferDraftImages(
                  draft.rooms[roomIndex]?.photos,
                  draft.roomImageUrls[roomIndex],
                )}
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
          <p className="text-sm text-muted">Aún no hay fotos. Usa Editar fotos para agregarlas.</p>
        )}
      </PreviewSection>

      {showPropertyBlocks ? (
        <PreviewSection
          title="Amenidades de la propiedad"
          onEdit={editingPropertyTags ? undefined : openPropertyTagsEdit}
          editLabel="Editar amenidades"
        >
          <ScopeTagsBlock
            heading="Amenidades de la propiedad"
            tags={propertyTagsActive}
            editing={editingPropertyTags}
            onStartEdit={openPropertyTagsEdit}
            onSave={savePropertyTags}
            onCancel={() => setEditingPropertyTags(false)}
            editGroups={PROPERTY_TAG_GROUPS}
            draftTags={propertyTagsDraft}
            onToggle={togglePropertyTagDraft}
            hideEditButton
            unselectedTags={unselectedPropertyTags}
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
              occupiedByWomenCount={occupantCounts.occupiedByWomenCount}
              occupiedByMenCount={occupantCounts.occupiedByMenCount}
            />
          )}
        </PreviewSection>
      ) : null}

      {showPropertyBlocks && draft.postMode === "property" ? (
        <PreviewSection
          title="Sobre la propiedad"
          onEdit={
            () => {
              setPropertySummaryDraft(draft.propertySummary);
              setEditingProperty(true);
            }
          }
        >
          {editingProperty ? (
            <InlineFieldEditor
              label="Descripción de la propiedad y áreas comunes"
              onSave={savePropertySummary}
              onCancel={() => setEditingProperty(false)}
            >
              <ResizableTextarea
                value={propertySummaryDraft}
                onChange={(e) => setPropertySummaryDraft(e.target.value)}
                rows={6}
                maxLength={PROPERTY_SUMMARY_MAX}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              />
              <FieldCharCount
                current={propertySummaryDraft.trim().length}
                min={PROPERTY_SUMMARY_MIN}
                max={PROPERTY_SUMMARY_MAX}
                warnBelowMin
              />
            </InlineFieldEditor>
          ) : (
            <div className="max-h-[350px] overflow-y-auto overscroll-y-contain pr-1 text-sm leading-relaxed text-muted sm:text-base">
              {draft.propertySummary.trim() || (
                <span className="italic">Sin descripción de la propiedad.</span>
              )}
            </div>
          )}
        </PreviewSection>
      ) : null}

      {showRoomBlocks ? (
        <PreviewSection title="Detalles de la recámara" onEdit={openRoomDetailsEdit} editLabel="Editar detalles">
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
                  value={detailsRoom.roomDimension}
                  onChange={(e) =>
                    setRoomDetailsDraft((r) =>
                      r ? { ...r, roomDimension: e.target.value as RoomDimension } : r,
                    )
                  }
                  className={WIZARD_FIELD_CONTROL_CLASS}
                >
                  {draft.postMode === "room" ? (
                    <>
                      <option value="small">Individual (Cabe cama individual + buró)</option>
                      <option value="medium">Matrimonial (Cabe cama matrimonial + escritorio)</option>
                      <option value="large">Grande (Cabe cama Queen/King + área de estar)</option>
                    </>
                  ) : (
                    <>
                      <option value="small">Pequeño (individual)</option>
                      <option value="medium">Mediano (matrimonial)</option>
                      <option value="large">Grande (Queen/King)</option>
                    </>
                  )}
                </select>
              </label>
              {draft.postMode === "property" ? (
                <div className="block text-sm font-medium text-body">
                  <WizardPairedFieldLabel>Plazas / espacios</WizardPairedFieldLabel>
                  <WizardNumberStepper
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
                  type="date"
                  value={detailsRoom.availableFrom}
                  onChange={(e) =>
                    setRoomDetailsDraft((r) => (r ? { ...r, availableFrom: e.target.value } : r))
                  }
                  className={WIZARD_FIELD_CONTROL_CLASS}
                />
              </label>
              <div className="block text-sm font-medium text-body">
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
              <div className="block text-sm font-medium text-body">
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
              <div className="block text-sm font-medium text-body">
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
            </div>
          </InlineFieldEditor>
        ) : (
          <ListingRoomDetailsGrid
            room={detailsRoom}
            postMode={draft.postMode}
            roomCount={draft.rooms.length}
          />
        )}
      </PreviewSection>
      ) : null}

      {showRoomBlocks ? (
      <PreviewSection
        title="Descripción de la recámara"
        onEdit={() => {
          setRoomSummaryDraft(room.summary);
          setEditingRoom(true);
        }}
      >
        {editingRoom ? (
          <InlineFieldEditor
            label="Descripción de la recámara"
            onSave={saveRoomSummary}
            onCancel={() => setEditingRoom(false)}
          >
            <ResizableTextarea
              value={roomSummaryDraft}
              onChange={(e) => setRoomSummaryDraft(e.target.value)}
              rows={6}
              maxLength={ROOM_SUMMARY_MAX}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
            <FieldCharCount
              current={roomSummaryDraft.trim().length}
              min={ROOM_SUMMARY_MIN}
              max={ROOM_SUMMARY_MAX}
              warnBelowMin
            />
          </InlineFieldEditor>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-muted sm:text-base">
              {room.summary.trim() || <span className="italic">Sin descripción de la recámara.</span>}
            </p>
            <ScopeTagsBlock
              heading="Etiquetas de la recámara"
              tags={roomTagsActive}
              editing={editingRoomTags}
              onStartEdit={openRoomTagsEdit}
              onSave={saveRoomTags}
              onCancel={() => setEditingRoomTags(false)}
              editGroups={ROOM_TAG_GROUPS}
              draftTags={roomTagsDraft}
              onToggle={toggleRoomTagDraft}
              unselectedTags={unselectedRoomTags}
            />
          </>
        )}
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
        />
      </PreviewSection>
    </div>
  );
}

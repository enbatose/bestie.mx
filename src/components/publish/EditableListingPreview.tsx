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
import { PreviewPropertyLocationMap } from "@/components/publish/PreviewPropertyLocationMap";
import { WizardNumberStepper } from "@/components/WizardNumberStepper";
import { apiAbsoluteUrl } from "@/lib/mediaUrl";
import {
  PROPERTY_SUMMARY_MAX,
  PROPERTY_SUMMARY_MIN,
  ROOM_SUMMARY_MAX,
  ROOM_SUMMARY_MIN,
  CITY_ANCHOR,
  effectiveWizardPropertyBathrooms,
} from "@/lib/publishWizard/publishCore";
import { draftToListingPreview } from "@/lib/publishWizard/draftPreview";
import {
  PROPERTY_TAG_GROUPS,
  ROOM_TAG_GROUPS,
  ROOMMATE_GENDER_PREF_FIELD_LABEL,
  filterPropertyScopeTags,
  filterRoomScopeTags,
  sortRoomScopeTags,
} from "@/lib/listingTags";
import {
  draftImagesAppend,
  draftImagesWithoutUrl,
} from "@/lib/publishWizard/draftImages";
import {
  ROOM_SINGLE_FLOW_PHOTO_HINT,
  roomsAvailableFromIdealTags,
} from "@/lib/publishWizard/wizardTags";
import type { Draft, RoomDraft } from "@/pages/PublishWizardPage";
import type { ListingTag, LodgingType, RoomDimension, RoommateGenderPref } from "@/types/listing";
import type { ListingTagGroup } from "@/lib/listingTags";

const ROOM_PLAZAS_MAX = 12;
const ROOM_STAY_MAX = 36;

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
  onDraftChange: (updater: (d: Draft) => Draft) => void;
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
  "rounded-full px-3 py-2 text-left text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-0 bg-primary text-primary-fg shadow-sm ring-1 ring-primary/20";

const TAG_CHIP_INACTIVE =
  "rounded-full px-3 py-2 text-left text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-0 border border-dashed border-border bg-surface-elevated/90 text-muted opacity-75 hover:border-border hover:opacity-100 hover:bg-surface";

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
        <div key={group.title}>
          <p className="text-sm font-medium text-body">{group.title}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {group.tags.map((tag) => {
              const active = selected.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  role="checkbox"
                  aria-checked={active}
                  onClick={() => onToggle(tag)}
                  className={active ? TAG_CHIP_ACTIVE : TAG_CHIP_INACTIVE}
                >
                  {listingTagLabel(tag)}
                </button>
              );
            })}
          </div>
        </div>
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
}) {
  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{heading}</p>
        {!editing ? (
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
          <ListingTagChips tags={tags} />
        )}
      </div>
    </div>
  );
}

function cloneRoomDraft(room: RoomDraft): RoomDraft {
  return { ...room, tags: [...room.tags] };
}


export function EditableListingPreview({
  draft,
  roomIndex,
  apiOn = false,
  variant = "preview",
  onDraftChange,
}: Props) {
  const listing = useMemo(() => draftToListingPreview(draft, roomIndex), [draft, roomIndex]);
  const room = draft.rooms[roomIndex];

  const [editingHeader, setEditingHeader] = useState(false);
  const [editingProperty, setEditingProperty] = useState(false);
  const [editingPropertyTags, setEditingPropertyTags] = useState(false);
  const [editingRoom, setEditingRoom] = useState(false);
  const [editingRoomTags, setEditingRoomTags] = useState(false);
  const [editingPhotos, setEditingPhotos] = useState(false);
  const [editingRoomDetails, setEditingRoomDetails] = useState(false);

  const [headerDraft, setHeaderDraft] = useState({
    neighborhood: draft.neighborhood,
    roomTitle: room?.title ?? "",
    rentMxn: room?.rentMxn ?? 0,
    depositMxn: room?.depositMxn ?? 0,
  });
  const [propertySummaryDraft, setPropertySummaryDraft] = useState(draft.propertySummary);
  const [propertyTagsDraft, setPropertyTagsDraft] = useState<ListingTag[]>([...draft.propertyTags]);
  const [roomSummaryDraft, setRoomSummaryDraft] = useState(room?.summary ?? "");
  const [roomTagsDraft, setRoomTagsDraft] = useState<ListingTag[]>([]);
  const [roomDetailsDraft, setRoomDetailsDraft] = useState<RoomDraft | null>(null);

  const galleryUrls = useMemo(
    () => [...(listing.propertyImageUrls ?? []), ...(listing.roomImageUrls ?? [])],
    [listing.propertyImageUrls, listing.roomImageUrls],
  );

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
    }));
  };

  if (!room) {
    return <p className="text-sm text-muted">No hay recámara seleccionada.</p>;
  }

  const propertyTagsActive = filterPropertyScopeTags(draft.propertyTags);
  const roomTagsActive = sortRoomScopeTags(filterRoomScopeTags(room.tags));

  const openHeaderEdit = () => {
    setHeaderDraft({
      neighborhood: draft.neighborhood,
      roomTitle: room.title,
      rentMxn: room.rentMxn,
      depositMxn: room.depositMxn,
    });
    setEditingHeader(true);
  };

  const saveHeader = () => {
    onDraftChange((d) => ({
      ...d,
      neighborhood: headerDraft.neighborhood,
      rooms: d.rooms.map((r, i) =>
        i === roomIndex
          ? {
              ...r,
              title: headerDraft.roomTitle,
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

  const detailsRoom = roomDetailsDraft ?? room;
  const neighborhoodLabel = draft.neighborhood.trim() || listing.neighborhood;

  const previewHeaderTitle = publicListingHeaderTitle({
    postMode: draft.postMode,
    neighborhood: neighborhoodLabel,
    lodgingType: room.lodgingType,
    propertyKind: draft.propertyKind,
  });

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-dashed border-secondary/50 bg-secondary/5 p-5">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
              variant === "live-edit"
                ? "bg-primary/10 text-primary"
                : "bg-amber-100 text-amber-900"
            }`}
          >
            {variant === "live-edit" ? "Editando anuncio" : "Vista previa · Borrador"}
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
            label="Ubicación y precio"
            onSave={saveHeader}
            onCancel={() => setEditingHeader(false)}
          >
            {draft.postMode === "property" ? (
              <label className="block text-sm font-medium text-body">
                Título de esta recámara
                <input
                  value={headerDraft.roomTitle}
                  onChange={(e) => setHeaderDraft((h) => ({ ...h, roomTitle: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                />
              </label>
            ) : null}
            <label className={`block text-sm font-medium text-body ${draft.postMode === "property" ? "mt-2" : ""}`}>
              Colonia o zona
              <input
                value={headerDraft.neighborhood}
                onChange={(e) => setHeaderDraft((h) => ({ ...h, neighborhood: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              />
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="block text-sm font-medium text-body">
                Renta (MXN / mes)
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={headerDraft.rentMxn === 0 ? "" : headerDraft.rentMxn}
                  onChange={(e) =>
                    setHeaderDraft((h) => ({ ...h, rentMxn: Math.max(0, Number(e.target.value) || 0) }))
                  }
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
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
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                />
              </label>
            </div>
          </InlineFieldEditor>
        ) : (
          <>
            <p className="mt-3 text-sm text-muted">
              {listing.neighborhood} · {listing.city}
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-primary sm:text-3xl">
              {previewHeaderTitle}
            </h1>
            {draft.postMode === "property" && listing.title.trim() ? (
              <p className="mt-1 text-sm text-muted">Recámara: {listing.title}</p>
            ) : null}
            <ListingHeroPrice rentMxn={listing.rentMxn} />
            <ListingHeaderBadges
              postMode={draft.postMode}
              roommateGenderPref={room.roommateGenderPref}
              availableFrom={room.availableFrom}
              occupiedByMenCount={draft.occupiedByMenCount}
              occupiedByWomenCount={draft.occupiedByWomenCount}
              propertyBedroomsTotal={draft.propertyBedroomsTotal}
              propertyBathrooms={effectiveWizardPropertyBathrooms(draft)}
              propertyKind={draft.propertyKind}
              tags={draft.propertyTags}
            />
            {(listing.depositMxn ?? 0) > 0 ? (
              <p className="mt-2 text-sm text-muted">Depósito · {money.format(listing.depositMxn ?? 0)}</p>
            ) : null}
          </>
        )}
      </header>

      <PreviewSection title="Fotos" onEdit={() => setEditingPhotos(true)} editLabel="Editar fotos">
        {editingPhotos ? (
          <InlineFieldEditor
            label="Galería de fotos"
            onSave={() => setEditingPhotos(false)}
            onCancel={() => setEditingPhotos(false)}
            saveLabel="Listo"
          >
            {draft.postMode === "property" && draft.unassignedImageUrls.length > 0 ? (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
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
                                return {
                                  ...d,
                                  unassignedImageUrls: nextUnassigned,
                                  propertyImageUrls: draftImagesAppend(
                                    d.propertyImageUrls,
                                    { url: u, isCover: false },
                                    20,
                                  ),
                                };
                              }
                              if (v === "facade") {
                                return {
                                  ...d,
                                  unassignedImageUrls: nextUnassigned,
                                  propertyImageUrls: draftImagesAppend(
                                    draftImagesWithoutUrl(d.propertyImageUrls, u),
                                    { url: u, isCover: true },
                                    20,
                                  ),
                                };
                              }
                              if (v.startsWith("room:")) {
                                const idx = Number(v.split(":")[1] ?? "1") - 1;
                                if (!Number.isFinite(idx) || idx < 0 || idx >= d.rooms.length) return d;
                                const row = d.roomImageUrls[idx] ?? [];
                                return {
                                  ...d,
                                  unassignedImageUrls: nextUnassigned,
                                  roomImageUrls: d.roomImageUrls.map((r, ri) =>
                                    ri === idx
                                      ? draftImagesAppend(
                                          r,
                                          { url: u, isCover: row.length === 0 },
                                          20,
                                        )
                                      : r,
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
                  ))}
                </div>
              </div>
            ) : null}
            {draft.postMode === "property" ? (
              <BulkImageUploader
                title="Áreas compartidas / fachada"
                images={draft.propertyImageUrls}
                maxCount={20}
                apiOn={apiOn}
                onImagesChange={(next) => onDraftChange((d) => ({ ...d, propertyImageUrls: next }))}
              />
            ) : null}
            <BulkImageUploader
              title={draft.postMode === "room" ? "Fotos de tu espacio" : `Recámara ${roomIndex + 1}`}
              images={draft.roomImageUrls[roomIndex] ?? []}
              maxCount={20}
              apiOn={apiOn}
              hint={draft.postMode === "room" ? ROOM_SINGLE_FLOW_PHOTO_HINT : undefined}
              onImagesChange={(next) =>
                onDraftChange((d) => ({
                  ...d,
                  roomImageUrls: d.roomImageUrls.map((row, ri) => (ri === roomIndex ? next : row)),
                }))
              }
            />
            {draft.postMode === "property" ? (
              <BulkImageUploader
                title="Fotos a categorizar"
                images={draft.unassignedImageUrls}
                maxCount={Math.min(120, draft.rooms.length * 20 + 40)}
                apiOn={apiOn}
                hint="Sube aquí y luego asígnalas arriba o en el paso de etiquetado."
                onImagesChange={(next) => onDraftChange((d) => ({ ...d, unassignedImageUrls: next }))}
              />
            ) : null}
          </InlineFieldEditor>
        ) : galleryUrls.length ? (
          <ListingPhotoGallery urls={galleryUrls} />
        ) : (
          <p className="text-sm text-muted">Aún no hay fotos. Usa Editar fotos para agregarlas.</p>
        )}
      </PreviewSection>

      <PreviewSection title="Resumen de la propiedad">
        <ListingPropertySummaryGrid
          neighborhood={neighborhoodLabel}
          propertyKind={draft.propertyKind}
          propertyBedroomsTotal={draft.propertyBedroomsTotal}
          occupiedByWomenCount={draft.occupiedByWomenCount}
          occupiedByMenCount={draft.occupiedByMenCount}
        />
      </PreviewSection>

      <PreviewSection
        title="Sobre la propiedad"
        onEdit={() => {
          setPropertySummaryDraft(draft.propertySummary);
          setEditingProperty(true);
        }}
      >
        <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
          <div>
            {editingProperty ? (
              <InlineFieldEditor
                label="Descripción de la propiedad y áreas comunes"
                onSave={savePropertySummary}
                onCancel={() => setEditingProperty(false)}
              >
                <textarea
                  value={propertySummaryDraft}
                  onChange={(e) => setPropertySummaryDraft(e.target.value)}
                  rows={5}
                  maxLength={PROPERTY_SUMMARY_MAX}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                />
                <span className="text-xs text-muted">
                  {propertySummaryDraft.trim().length}/{PROPERTY_SUMMARY_MIN} mín.
                </span>
              </InlineFieldEditor>
            ) : (
              <div className="max-h-[350px] overflow-y-auto overscroll-y-contain pr-1 text-sm leading-relaxed text-muted sm:text-base">
                {draft.propertySummary.trim() || (
                  <span className="italic">Sin descripción de la propiedad.</span>
                )}
              </div>
            )}
          </div>
          <PreviewPropertyLocationMap
            listing={listing}
            mapCenter={mapCenter}
            isApproximateLocation={draft.isApproximateLocation}
            onSaveCoordinates={saveMapCoordinates}
          />
        </div>
        {!editingProperty ? (
          <ScopeTagsBlock
            heading="Etiquetas de la propiedad"
            tags={propertyTagsActive}
            editing={editingPropertyTags}
            onStartEdit={openPropertyTagsEdit}
            onSave={savePropertyTags}
            onCancel={() => setEditingPropertyTags(false)}
            editGroups={PROPERTY_TAG_GROUPS}
            draftTags={propertyTagsDraft}
            onToggle={togglePropertyTagDraft}
          />
        ) : null}
      </PreviewSection>

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
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-body">
                {draft.postMode === "room" ? "Tipo de recámara" : "Tipo de espacio"}
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
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
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
                <select
                  value={detailsRoom.roomDimension}
                  onChange={(e) =>
                    setRoomDetailsDraft((r) =>
                      r ? { ...r, roomDimension: e.target.value as RoomDimension } : r,
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                >
                  <option value="small">Pequeño / individual</option>
                  <option value="medium">Mediano / matrimonial</option>
                  <option value="large">Grande</option>
                </select>
              </label>
              {draft.postMode === "property" ? (
                <div className="block text-sm font-medium text-body">
                  <span className="block">Plazas / espacios</span>
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
                Disponible desde
                <input
                  type="date"
                  value={detailsRoom.availableFrom}
                  onChange={(e) =>
                    setRoomDetailsDraft((r) => (r ? { ...r, availableFrom: e.target.value } : r))
                  }
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                />
              </label>
              <div className="block text-sm font-medium text-body">
                <span className="block">Estancia mín. (meses)</span>
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
                {ROOMMATE_GENDER_PREF_FIELD_LABEL}
                <select
                  value={detailsRoom.roommateGenderPref}
                  onChange={(e) =>
                    setRoomDetailsDraft((r) =>
                      r ? { ...r, roommateGenderPref: e.target.value as RoommateGenderPref } : r,
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
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
                <span className="block">Edad máx.</span>
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
            <textarea
              value={roomSummaryDraft}
              onChange={(e) => setRoomSummaryDraft(e.target.value)}
              rows={5}
              maxLength={ROOM_SUMMARY_MAX}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
            <span className="text-xs text-muted">
              {roomSummaryDraft.trim().length}/{ROOM_SUMMARY_MIN} mín.
            </span>
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
            />
          </>
        )}
      </PreviewSection>
    </div>
  );
}

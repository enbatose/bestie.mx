import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { BulkImageUploader } from "@/components/BulkImageUploader";
import { WizardNumberStepper } from "@/components/WizardNumberStepper";
import { apiAbsoluteUrl } from "@/lib/mediaUrl";
import {
  PROPERTY_SUMMARY_MAX,
  PROPERTY_SUMMARY_MIN,
  PROPERTY_TITLE_MAX,
  ROOM_SUMMARY_MAX,
  ROOM_SUMMARY_MIN,
} from "@/lib/publishWizard/publishCore";
import { draftToListingPreview, draftToPropertyWithRooms } from "@/lib/publishWizard/draftPreview";
import {
  ROOM_SINGLE_FLOW_PHOTO_HINT,
  WIZARD_ROOM_TAG_GROUPS,
  WIZARD_STEP4_TAG_LABELS,
} from "@/lib/publishWizard/wizardTags";
import type { Draft, RoomDraft } from "@/pages/PublishWizardPage";
import { TAG_LABELS } from "@/lib/searchFilters";
import type { ListingTag, LodgingType, RoomDimension, RoommateGenderPref } from "@/types/listing";

const ROOM_PLAZAS_MAX = 12;
const ROOM_STAY_MAX = 36;

type RoomOccupationAllowed = "individuals_only" | "couples_or_individuals";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

type Props = {
  draft: Draft;
  roomIndex: number;
  apiOn?: boolean;
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
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-body">{title}</h2>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold text-primary transition hover:bg-surface-elevated"
          >
            <Pencil className="size-3.5" aria-hidden />
            {editLabel}
          </button>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
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

function cloneRoomDraft(room: RoomDraft): RoomDraft {
  return { ...room, tags: [...room.tags] };
}

export function EditableListingPreview({ draft, roomIndex, apiOn = false, onDraftChange }: Props) {
  const listing = useMemo(() => draftToListingPreview(draft, roomIndex), [draft, roomIndex]);
  const propertyPack = useMemo(() => draftToPropertyWithRooms(draft), [draft]);
  const room = draft.rooms[roomIndex];

  const [editingHeader, setEditingHeader] = useState(false);
  const [editingProperty, setEditingProperty] = useState(false);
  const [editingRoom, setEditingRoom] = useState(false);
  const [editingPhotos, setEditingPhotos] = useState(false);
  const [editingRoomDetails, setEditingRoomDetails] = useState(false);

  const [headerDraft, setHeaderDraft] = useState({
    propertyTitle: draft.propertyTitle,
    neighborhood: draft.neighborhood,
    roomTitle: room?.title ?? "",
    rentMxn: room?.rentMxn ?? 0,
    depositMxn: room?.depositMxn ?? 0,
  });
  const [propertySummaryDraft, setPropertySummaryDraft] = useState(draft.propertySummary);
  const [roomSummaryDraft, setRoomSummaryDraft] = useState(room?.summary ?? "");
  const [roomDetailsDraft, setRoomDetailsDraft] = useState<RoomDraft | null>(null);

  const galleryUrls = useMemo(
    () => [...(listing.propertyImageUrls ?? []), ...(listing.roomImageUrls ?? [])],
    [listing.propertyImageUrls, listing.roomImageUrls],
  );

  if (!room) {
    return <p className="text-sm text-muted">No hay recámara seleccionada.</p>;
  }

  const openHeaderEdit = () => {
    setHeaderDraft({
      propertyTitle: draft.propertyTitle,
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
      propertyTitle: headerDraft.propertyTitle,
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

  const saveRoomSummary = () => {
    onDraftChange((d) => ({
      ...d,
      rooms: d.rooms.map((r, i) => (i === roomIndex ? { ...r, summary: roomSummaryDraft } : r)),
    }));
    setEditingRoom(false);
  };

  const openRoomDetailsEdit = () => {
    setRoomDetailsDraft(cloneRoomDraft(room));
    setEditingRoomDetails(true);
  };

  const saveRoomDetails = () => {
    if (!roomDetailsDraft) return;
    onDraftChange((d) => ({
      ...d,
      rooms: d.rooms.map((r, i) => (i === roomIndex ? { ...roomDetailsDraft, tags: [...roomDetailsDraft.tags] } : r)),
    }));
    setEditingRoomDetails(false);
    setRoomDetailsDraft(null);
  };

  const toggleRoomDetailTag = (tag: ListingTag) => {
    setRoomDetailsDraft((prev) => {
      if (!prev) return prev;
      const tags = prev.tags.filter((t) => t !== "servicios-incluidos");
      const active = tags.includes(tag);
      const nextTags = active ? tags.filter((t) => t !== tag) : [...tags, tag];
      return { ...prev, tags: nextTags };
    });
  };

  const displayTitle =
    draft.postMode === "property" ? listing.title : draft.propertyTitle.trim() || listing.title;

  const detailsRoom = roomDetailsDraft ?? room;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-dashed border-secondary/50 bg-secondary/5 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-900">
            Vista previa · Borrador
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
            label="Título, ubicación y precio"
            onSave={saveHeader}
            onCancel={() => setEditingHeader(false)}
          >
            <label className="block text-sm font-medium text-body">
              Título del anuncio
              <input
                value={headerDraft.propertyTitle}
                onChange={(e) => setHeaderDraft((h) => ({ ...h, propertyTitle: e.target.value }))}
                maxLength={PROPERTY_TITLE_MAX}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              />
            </label>
            {draft.postMode === "property" ? (
              <label className="mt-2 block text-sm font-medium text-body">
                Título de esta recámara
                <input
                  value={headerDraft.roomTitle}
                  onChange={(e) => setHeaderDraft((h) => ({ ...h, roomTitle: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                />
              </label>
            ) : null}
            <label className="mt-2 block text-sm font-medium text-body">
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
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-primary sm:text-3xl">{displayTitle}</h1>
            {draft.postMode === "property" && listing.title !== displayTitle ? (
              <p className="mt-1 text-sm text-muted">Recámara: {listing.title}</p>
            ) : null}
            <p className="mt-3 text-2xl font-semibold text-body">{money.format(listing.rentMxn)}</p>
            {(listing.depositMxn ?? 0) > 0 ? (
              <p className="mt-1 text-sm text-muted">Depósito · {money.format(listing.depositMxn ?? 0)}</p>
            ) : null}
            <p className="mt-2 text-sm text-muted">
              {propertyPack.property.bedroomsTotal} recámara(s) · {propertyPack.property.bathrooms} baño(s) ·{" "}
              {listing.roomsAvailable} plaza(s) disponible(s)
            </p>
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
                  {draft.unassignedImageUrls.map((u) => (
                    <div key={u} className="flex items-start gap-3 rounded-lg border border-border bg-surface p-2">
                      <img
                        src={apiAbsoluteUrl(u)}
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
                            onDraftChange((d) => {
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
                  ))}
                </div>
              </div>
            ) : null}
            {draft.postMode === "property" ? (
              <BulkImageUploader
                title="Áreas compartidas / fachada"
                urls={draft.propertyImageUrls}
                maxCount={20}
                apiOn={apiOn}
                onChange={(next) => onDraftChange((d) => ({ ...d, propertyImageUrls: next }))}
              />
            ) : null}
            <BulkImageUploader
              title={draft.postMode === "room" ? "Fotos de tu espacio" : `Recámara ${roomIndex + 1}`}
              urls={draft.roomImageUrls[roomIndex] ?? []}
              maxCount={20}
              apiOn={apiOn}
              hint={draft.postMode === "room" ? ROOM_SINGLE_FLOW_PHOTO_HINT : undefined}
              onChange={(next) =>
                onDraftChange((d) => ({
                  ...d,
                  roomImageUrls: d.roomImageUrls.map((row, ri) => (ri === roomIndex ? next : row)),
                }))
              }
            />
            {draft.postMode === "property" ? (
              <BulkImageUploader
                title="Fotos a categorizar"
                urls={draft.unassignedImageUrls}
                maxCount={Math.min(120, draft.rooms.length * 20 + 40)}
                apiOn={apiOn}
                hint="Sube aquí y luego asígnalas arriba o en el paso de etiquetado."
                onChange={(next) => onDraftChange((d) => ({ ...d, unassignedImageUrls: next }))}
              />
            ) : null}
          </InlineFieldEditor>
        ) : galleryUrls.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {galleryUrls.map((u) => (
              <img
                key={u}
                src={apiAbsoluteUrl(u)}
                alt=""
                className="aspect-square w-full rounded-xl object-cover ring-1 ring-border"
                loading="lazy"
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Aún no hay fotos. Usa Editar fotos para agregarlas.</p>
        )}
      </PreviewSection>

      <PreviewSection
        title="Sobre la propiedad"
        onEdit={() => {
          setPropertySummaryDraft(draft.propertySummary);
          setEditingProperty(true);
        }}
      >
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
          <p className="text-sm leading-relaxed text-muted sm:text-base">
            {draft.propertySummary.trim() || (
              <span className="italic">Sin descripción de la propiedad.</span>
            )}
          </p>
        )}
      </PreviewSection>

      <PreviewSection
        title="Descripción del cuarto"
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
          <p className="text-sm leading-relaxed text-muted sm:text-base">
            {room.summary.trim() || <span className="italic">Sin descripción de la recámara.</span>}
          </p>
        )}
      </PreviewSection>

      <PreviewSection title="Detalles de la recámara" onEdit={openRoomDetailsEdit} editLabel="Editar detalles">
        {editingRoomDetails && roomDetailsDraft ? (
          <InlineFieldEditor
            label="Tipo, disponibilidad, perfil y etiquetas"
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
              ) : (
                <label className="block text-sm font-medium text-body">
                  Ocupación permitida
                  <select
                    value={
                      detailsRoom.roomsAvailable >= 2 ? "couples_or_individuals" : "individuals_only"
                    }
                    onChange={(e) => {
                      const occ = e.target.value as RoomOccupationAllowed;
                      setRoomDetailsDraft((r) =>
                        r
                          ? { ...r, roomsAvailable: occ === "individuals_only" ? 1 : 2 }
                          : r,
                      );
                    }}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  >
                    <option value="individuals_only">Solo individuos</option>
                    <option value="couples_or_individuals">Parejas o individuos</option>
                  </select>
                </label>
              )}
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
                Prefieren
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
            {WIZARD_ROOM_TAG_GROUPS.map((group) => (
              <div key={group.title} className="mt-4">
                <p className="text-sm font-medium text-body">{group.title}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {group.tags.map((tag) => {
                    const active = detailsRoom.tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        role="checkbox"
                        aria-checked={active}
                        onClick={() => toggleRoomDetailTag(tag)}
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
          </InlineFieldEditor>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {listing.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-bg-light px-3 py-1 text-xs font-medium text-body ring-1 ring-border"
                >
                  {TAG_LABELS[t]}
                </span>
              ))}
              {!listing.tags.length ? <span className="text-sm text-muted">Sin etiquetas.</span> : null}
            </div>
            <p className="mt-3 text-xs text-muted">
              {detailsRoom.lodgingType === "private_room"
                ? "Recámara privada"
                : detailsRoom.lodgingType === "shared_room"
                  ? "Recámara compartida"
                  : "Vivienda completa"}
              {" · "}
              Disponible desde {detailsRoom.availableFrom || "—"}
              {" · "}
              Estancia mín. {detailsRoom.minimalStayMonths} mes(es)
            </p>
          </>
        )}
      </PreviewSection>
    </div>
  );
}

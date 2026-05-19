import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { apiAbsoluteUrl } from "@/lib/mediaUrl";
import {
  PROPERTY_SUMMARY_MAX,
  PROPERTY_SUMMARY_MIN,
  PROPERTY_TITLE_MAX,
  ROOM_SUMMARY_MAX,
  ROOM_SUMMARY_MIN,
} from "@/lib/publishWizard/publishCore";
import { draftToListingPreview, draftToPropertyWithRooms } from "@/lib/publishWizard/draftPreview";
import type { Draft, RoomDraft } from "@/pages/PublishWizardPage";
import { TAG_LABELS } from "@/lib/searchFilters";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

type Props = {
  draft: Draft;
  roomIndex: number;
  onDraftChange: (updater: (d: Draft) => Draft) => void;
  onEditPhotos: () => void;
  onEditRoomDetails: () => void;
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
}: {
  label: string;
  children: React.ReactNode;
  onSave: () => void;
  onCancel: () => void;
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
          Guardar cambios
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

export function EditableListingPreview({
  draft,
  roomIndex,
  onDraftChange,
  onEditPhotos,
  onEditRoomDetails,
}: Props) {
  const listing = useMemo(() => draftToListingPreview(draft, roomIndex), [draft, roomIndex]);
  const propertyPack = useMemo(() => draftToPropertyWithRooms(draft), [draft]);
  const room = draft.rooms[roomIndex];

  const [editingHeader, setEditingHeader] = useState(false);
  const [editingProperty, setEditingProperty] = useState(false);
  const [editingRoom, setEditingRoom] = useState(false);

  const [headerDraft, setHeaderDraft] = useState({
    propertyTitle: draft.propertyTitle,
    neighborhood: draft.neighborhood,
    roomTitle: room?.title ?? "",
    rentMxn: room?.rentMxn ?? 0,
    depositMxn: room?.depositMxn ?? 0,
  });
  const [propertySummaryDraft, setPropertySummaryDraft] = useState(draft.propertySummary);
  const [roomSummaryDraft, setRoomSummaryDraft] = useState(room?.summary ?? "");

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

  const displayTitle =
    draft.postMode === "property" ? listing.title : draft.propertyTitle.trim() || listing.title;

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

      <PreviewSection title="Fotos" onEdit={onEditPhotos} editLabel="Editar fotos">
        {galleryUrls.length ? (
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
          <p className="text-sm text-muted">Aún no hay fotos. Agrégalas desde el asistente.</p>
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

      <PreviewSection title="Detalles de la recámara" onEdit={onEditRoomDetails} editLabel="Editar en asistente">
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
      </PreviewSection>
    </div>
  );
}

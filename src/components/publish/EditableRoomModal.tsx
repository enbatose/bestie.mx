import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BulkImageUploader } from "@/components/BulkImageUploader";
import { ListingPhotoGallery } from "@/components/listing/ListingPhotoGallery";
import { ListingRoomDetailsGrid } from "@/components/listing/ListingPropertySummaryGrid";
import { CONSULTAR_RENT_LABEL } from "@/lib/listingPricing";
import { ListingHeroPrice } from "@/components/listing/PublicListingHeader";
import { RoomOnOffToggle, RoomOccupancyBadge } from "@/components/myListings/listingCardChrome";
import { FieldCharCount } from "@/components/publish/FieldCharCount";
import { MissingRentCallout } from "@/components/publish/MissingRentCallout";
import { ResizableTextarea } from "@/components/publish/ResizableTextarea";
import { useDebouncedCommit } from "@/components/publish/useDebouncedCommit";
import {
  cloneRoomDraft,
  InlineFieldEditor,
  PreviewPencilEditButton,
  PreviewSection,
  ROOM_OCCUPANT_MAX,
  ROOM_PLAZAS_MAX,
  ROOM_STAY_MAX,
  ScopeTagsBlock,
} from "@/components/publish/editablePreviewShared";
import {
  WizardNumberStepper,
  WizardPairedFieldLabel,
  WIZARD_FIELD_CONTROL_CLASS,
} from "@/components/WizardNumberStepper";
import {
  filterRoomScopeTags,
  isListingRentMissing,
  listingTagsNotSelected,
  ROOM_TAG_GROUPS,
  ROOMMATE_GENDER_PREF_FIELD_LABEL_SHORT,
  sortRoomScopeTags,
} from "@/lib/listingTags";
import { draftImagesToUrls, listSharedDumpPhotosNotInRoom } from "@/lib/publishWizard/draftImages";
import { draftRoomEditorImages, ROOM_SUMMARY_MAX, ROOM_SUMMARY_MIN } from "@/lib/publishWizard/publishCore";
import { ROOM_SINGLE_FLOW_PHOTO_HINT, roomsAvailableFromIdealTags } from "@/lib/publishWizard/wizardTags";
import {
  collectRoomFieldIssueDetails,
  PUBLISH_PREVIEW_RENT_INPUT_ID,
  PUBLISH_ROOM_MODAL_AGE_MAX_ID,
  PUBLISH_ROOM_MODAL_AGE_MIN_ID,
  PUBLISH_ROOM_MODAL_AVAILABLE_FROM_ID,
  PUBLISH_ROOM_MODAL_DEPOSIT_INPUT_ID,
  PUBLISH_ROOM_MODAL_DESCRIPTION_FIELD_ID,
  PUBLISH_ROOM_MODAL_DIMENSION_ID,
  PUBLISH_ROOM_MODAL_GENDER_ID,
  PUBLISH_ROOM_MODAL_LODGING_ID,
  PUBLISH_ROOM_MODAL_STAY_ID,
  roomIssueFocusElementId,
  type RoomFieldIssue,
  type RoomIssueSection,
} from "@/lib/publishWizard/roomWizardValidation";
import { RoomLocalIssuesCallout } from "@/components/publish/RoomSaveIssuesCallout";
import { SharedDumpPhotosPicker } from "@/components/publish/SharedDumpPhotosPicker";
import { RoomTitlePencilEditor } from "@/components/publish/RoomTitlePencilEditor";
import {
  isRoomAvailableForRent,
  propertyRoomPencilTitle,
  propertyRoomSlotTitle,
  roomDisplayName,
} from "@/lib/roomDisplay";
import type { Draft, RoomDraft } from "@/pages/PublishWizardPage";
import type { ListingTag, LodgingType, RoomDimension, RoommateGenderPref } from "@/types/listing";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const ROOM_SUMMARY_PLACEHOLDER =
  "Describe el tamaño, la iluminación, si tiene clóset, y qué incluye.";

type Props = {
  room: RoomDraft;
  roomIndex: number;
  draft: Draft;
  apiOn: boolean;
  confirmLabel: string;
  submitInFlight?: "publish" | "draft" | null;
  publishBlockedReason?: string | null;
  actionErr?: string | null;
  initialEditingPhotos?: boolean;
  /** When set (e.g. jumped from a missing-field bullet), focus that control after open. */
  initialFocusIssueId?: string | null;
  onSave: (updated: RoomDraft) => void;
  onClose: () => void;
  onPhotoPickerOpen?: () => void;
};

function OccupiedRoomOccupantFields({
  room,
  onChange,
}: {
  room: RoomDraft;
  onChange: (patch: Partial<RoomDraft>) => void;
}) {
  const women = Math.max(0, Math.floor(room.occupantWomenCount ?? 0));
  const men = Math.max(0, Math.floor(room.occupantMenCount ?? 0));
  const needsDetailSteppers = women > 1 || men > 1 || (women > 0 && men > 0);
  const chipClass = (active: boolean) =>
    `rounded-full px-2.5 py-1 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
      active
        ? "bg-primary text-primary-fg shadow-sm ring-1 ring-primary/20"
        : "border border-border bg-surface text-body hover:bg-surface-elevated"
    }`;

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted">Ocupado por — opcional</span>
        {!needsDetailSteppers ? (
          <>
            <button
              type="button"
              onClick={() =>
                onChange({
                  occupantWomenCount: women === 1 && men === 0 ? 0 : 1,
                  occupantMenCount: 0,
                })
              }
              className={chipClass(women === 1 && men === 0)}
            >
              1 Mujer
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({
                  occupantMenCount: men === 1 && women === 0 ? 0 : 1,
                  occupantWomenCount: 0,
                })
              }
              className={chipClass(men === 1 && women === 0)}
            >
              1 Hombre
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({
                  occupantWomenCount: women > 0 ? Math.max(2, women) : 2,
                  occupantMenCount: men,
                })
              }
              className="rounded-full px-2 py-1 text-xs font-medium text-muted transition hover:bg-surface-elevated hover:text-body"
            >
              Más de una persona
            </button>
          </>
        ) : null}
      </div>
      {needsDetailSteppers ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="block min-w-0 text-[11px] font-medium text-body">
            Mujeres
            <WizardNumberStepper
              compact
              value={women}
              min={0}
              max={ROOM_OCCUPANT_MAX}
              onChange={(n) => onChange({ occupantWomenCount: n })}
              decrementLabel="Menos mujeres"
              incrementLabel="Más mujeres"
            />
          </label>
          <label className="block min-w-0 text-[11px] font-medium text-body">
            Hombres
            <WizardNumberStepper
              compact
              value={men}
              min={0}
              max={ROOM_OCCUPANT_MAX}
              onChange={(n) => onChange({ occupantMenCount: n })}
              decrementLabel="Menos hombres"
              incrementLabel="Más hombres"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

export function EditableRoomModal({
  room,
  roomIndex,
  draft,
  apiOn,
  confirmLabel,
  submitInFlight = null,
  publishBlockedReason = null,
  actionErr = null,
  initialEditingPhotos = false,
  initialFocusIssueId = null,
  onSave,
  onClose,
  onPhotoPickerOpen,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [localRoom, setLocalRoom] = useState<RoomDraft>(() => cloneRoomDraft(room));
  const [editingHeader, setEditingHeader] = useState(false);
  const [editingPhotos, setEditingPhotos] = useState(() => {
    if (initialEditingPhotos) return true;
    if (draft.postMode !== "property") return false;
    const existing = draftImagesToUrls(draftRoomEditorImages(draft, roomIndex, room.photos));
    return (
      existing.length === 0 && listSharedDumpPhotosNotInRoom(draft, roomIndex, room.photos).length > 0
    );
  });
  const [editingDetails, setEditingDetails] = useState(false);
  const [headerDraft, setHeaderDraft] = useState({
    rentMxn: room.rentMxn,
    depositMxn: room.depositMxn,
  });
  const [detailsDraft, setDetailsDraft] = useState<RoomDraft | null>(null);
  const [summaryDraft, setSummaryDraft] = useState(room.summary);
  const [showIssues, setShowIssues] = useState(
    () => collectRoomFieldIssueDetails(draft, room).length > 0,
  );

  const flushSummary = useDebouncedCommit(summaryDraft, (next) => {
    setLocalRoom((r) => (r.summary === next ? r : { ...r, summary: next }));
  });

  const available = isRoomAvailableForRent(localRoom);
  const rentMissing = available && !draft.hidePricing && isListingRentMissing(localRoom.rentMxn);
  const roomSlotTitle = propertyRoomSlotTitle(roomIndex + 1);
  const roomLabel =
    draft.postMode === "property"
      ? propertyRoomPencilTitle(localRoom, roomIndex + 1)
      : roomDisplayName(localRoom, roomIndex);
  const roomTagsActive = sortRoomScopeTags(filterRoomScopeTags(localRoom.tags));
  const galleryUrls = draftImagesToUrls(draftRoomEditorImages(draft, roomIndex, localRoom.photos));
  const detailsRoom = detailsDraft ?? localRoom;

  const applyIssueFocus = (issue: RoomFieldIssue) => {
    if (issue.section === "header") {
      setHeaderDraft({
        rentMxn: localRoom.rentMxn,
        depositMxn: localRoom.depositMxn,
      });
      setEditingHeader(true);
    }
    if (issue.section === "details") {
      setDetailsDraft(cloneRoomDraft(localRoom));
      setEditingDetails(true);
    }
    const targetId = roomIssueFocusElementId(issue);
    window.setTimeout(() => {
      const el = document.getElementById(targetId);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el instanceof HTMLElement) el.focus();
    }, 80);
  };

  const applyIssueFocusSections = (sections: readonly RoomIssueSection[]) => {
    if (sections.includes("header")) {
      setHeaderDraft({
        rentMxn: localRoom.rentMxn,
        depositMxn: localRoom.depositMxn,
      });
      setEditingHeader(true);
    }
    if (sections.includes("details")) {
      setDetailsDraft(cloneRoomDraft(localRoom));
      setEditingDetails(true);
    }
    if (sections.includes("description")) {
      window.setTimeout(() => {
        document.getElementById(PUBLISH_ROOM_MODAL_DESCRIPTION_FIELD_ID)?.focus();
      }, 80);
    }
  };

  useEffect(() => {
    const initial = collectRoomFieldIssueDetails(draft, room);
    if (!initial.length) return;
    const preferred =
      (initialFocusIssueId
        ? initial.find((issue) => issue.id === initialFocusIssueId)
        : undefined) ?? initial[0];
    if (preferred) applyIssueFocus(preferred);
    else applyIssueFocusSections([...new Set(initial.map((issue) => issue.section))]);
    // Only on mount: highlight whatever is already missing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!editingHeader || !rentMissing) return;
    const t = window.setTimeout(() => {
      document.getElementById(PUBLISH_PREVIEW_RENT_INPUT_ID)?.focus();
    }, 50);
    return () => window.clearTimeout(t);
  }, [editingHeader, rentMissing]);

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [room.id]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const flushPendingEdits = (base: RoomDraft): RoomDraft => {
    let next = base;
    if (editingHeader) {
      next = {
        ...next,
        rentMxn: Math.max(0, headerDraft.rentMxn),
        depositMxn: Math.max(0, headerDraft.depositMxn),
      };
    }
    if (editingDetails && detailsDraft) {
      next = {
        ...next,
        ...detailsDraft,
        tags: filterRoomScopeTags(next.tags),
        summary: summaryDraft,
      };
    }
    next = { ...next, summary: summaryDraft };
    return next;
  };

  const localIssues = collectRoomFieldIssueDetails(draft, flushPendingEdits(localRoom));

  const trySave = () => {
    const next = flushPendingEdits(localRoom);
    setLocalRoom(next);
    const issues = collectRoomFieldIssueDetails(draft, next);
    if (issues.length) {
      setShowIssues(true);
      applyIssueFocus(issues[0]!);
      return;
    }
    onSave(next);
  };

  const openHeaderEdit = () => {
    setHeaderDraft({
      rentMxn: localRoom.rentMxn,
      depositMxn: localRoom.depositMxn,
    });
    setEditingHeader(true);
  };

  const saveHeader = () => {
    setLocalRoom((r) => ({
      ...r,
      rentMxn: Math.max(0, headerDraft.rentMxn),
      depositMxn: Math.max(0, headerDraft.depositMxn),
    }));
    setEditingHeader(false);
  };

  const commitRoomTitle = (nextTitle: string) => {
    const trimmed = nextTitle.trim();
    setLocalRoom((r) => ({
      ...r,
      customName: trimmed,
      title: trimmed || roomSlotTitle,
    }));
  };

  const saveDetails = () => {
    if (!detailsDraft) return;
    setLocalRoom((r) => ({
      ...r,
      ...detailsDraft,
      tags: filterRoomScopeTags(r.tags),
      summary: summaryDraft,
      roomsAvailable:
        draft.postMode === "room"
          ? roomsAvailableFromIdealTags(r.tags)
          : detailsDraft.roomsAvailable,
    }));
    setEditingDetails(false);
    setDetailsDraft(null);
  };

  const toggleRoomTag = (tag: ListingTag, currentlyActive: boolean) => {
    setLocalRoom((r) => {
      const next = currentlyActive ? r.tags.filter((t) => t !== tag) : [...r.tags, tag];
      const tags = filterRoomScopeTags(next);
      return {
        ...r,
        tags,
        roomsAvailable: draft.postMode === "room" ? roomsAvailableFromIdealTags(tags) : r.roomsAvailable,
      };
    });
  };

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={draft.postMode === "room" ? "Editar anuncio" : `Editar ${roomLabel}`}
      className="fixed inset-0 z-[2100] flex items-end justify-center bg-black/55 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-xl sm:max-h-[90vh] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-6">
          {draft.postMode === "property" ? (
            <div className="min-w-0 flex-1">
              <RoomTitlePencilEditor
                variant="badge"
                prefix="Editando · "
                value={roomLabel}
                fallbackTitle={roomSlotTitle}
                onCommit={commitRoomTitle}
              />
            </div>
          ) : (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
              Editando anuncio
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-border px-4 text-sm font-semibold text-body"
          >
            Cerrar
          </button>
        </div>

        <div
          ref={panelRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
        >
          <div className="space-y-5">
            <header
              className={`rounded-2xl border border-dashed p-4 sm:p-5 ${
                rentMissing ? "border-error/60 bg-error/5" : "border-secondary/50 bg-secondary/5"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{roomLabel}</p>
                {!editingHeader && available ? (
                  <PreviewPencilEditButton onClick={openHeaderEdit} ariaLabel="Editar encabezado" />
                ) : null}
              </div>

              {draft.postMode === "property" ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <RoomOccupancyBadge available={available} />
                  <RoomOnOffToggle
                    available={available}
                    onChange={(next) =>
                      setLocalRoom((r) => ({
                        ...r,
                        occupancyStatus: next ? "available" : "occupied",
                      }))
                    }
                  />
                </div>
              ) : (
              <div className="mt-3 inline-flex w-full rounded-xl border border-border bg-surface p-1 shadow-sm" role="group" aria-label="Estado de la recámara">
                <button
                  type="button"
                  onClick={() => setLocalRoom((r) => ({ ...r, occupancyStatus: "occupied" }))}
                  className={`min-h-9 flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    !available
                      ? "bg-bg-light text-body ring-1 ring-border"
                      : "text-muted hover:bg-surface-elevated"
                  }`}
                >
                  Ocupada
                </button>
                <button
                  type="button"
                  onClick={() => setLocalRoom((r) => ({ ...r, occupancyStatus: "available" }))}
                  className={`min-h-9 flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    available
                      ? "bg-primary text-primary-fg ring-1 ring-primary/20"
                      : "text-muted hover:bg-surface-elevated"
                  }`}
                >
                  Disponible
                </button>
              </div>
              )}

              {editingHeader && available ? (
                <div className="mt-3">
                  <InlineFieldEditor
                    label="Precio"
                    onSave={saveHeader}
                    onCancel={() => setEditingHeader(false)}
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-body">
                        Renta (MXN / mes)
                        {draft.hidePricing ? (
                          <span className="font-normal text-muted"> (opcional)</span>
                        ) : (
                          <span className="text-error"> *</span>
                        )}
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
                            !draft.hidePricing && isListingRentMissing(headerDraft.rentMxn)
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
                  </InlineFieldEditor>
                </div>
              ) : (
                <>
                  <h2 className="mt-3 text-xl font-bold tracking-tight text-primary sm:text-2xl">
                    {roomLabel}
                  </h2>
                  {available ? (
                    rentMissing ? (
                      <div className="mt-3">
                        <MissingRentCallout onEdit={openHeaderEdit} />
                      </div>
                    ) : draft.hidePricing ? (
                      <p className="mt-2 text-2xl font-bold text-body">{CONSULTAR_RENT_LABEL}</p>
                    ) : (
                      <ListingHeroPrice rentMxn={localRoom.rentMxn} />
                    )
                  ) : (
                    <OccupiedRoomOccupantFields
                      room={localRoom}
                      onChange={(patch) => setLocalRoom((r) => ({ ...r, ...patch }))}
                    />
                  )}
                  {available && !draft.hidePricing && localRoom.depositMxn > 0 ? (
                    <p className="mt-2 text-sm text-muted">
                      Depósito · {money.format(localRoom.depositMxn)}
                    </p>
                  ) : null}
                </>
              )}
            </header>

            {available ? (
              <>
                <PreviewSection
                  title="Fotos"
                  onEdit={() => setEditingPhotos(true)}
                  editLabel="Editar fotos"
                >
                  {editingPhotos ? (
                    <InlineFieldEditor
                      label="Fotos de esta recámara"
                      onSave={() => setEditingPhotos(false)}
                      onCancel={() => setEditingPhotos(false)}
                      saveLabel="Listo"
                    >
                      <SharedDumpPhotosPicker
                        draft={draft}
                        roomIndex={roomIndex}
                        roomPhotos={localRoom.photos ?? []}
                        maxCount={20}
                        onTake={(next) => setLocalRoom((r) => ({ ...r, photos: next }))}
                      />
                      <BulkImageUploader
                        title={draft.postMode === "room" ? "Fotos de tu espacio" : `Recámara ${roomIndex + 1}`}
                        images={draftRoomEditorImages(draft, roomIndex, localRoom.photos)}
                        maxCount={20}
                        apiOn={apiOn}
                        hint={draft.postMode === "room" ? ROOM_SINGLE_FLOW_PHOTO_HINT : undefined}
                        onPickerOpen={onPhotoPickerOpen}
                        onImagesChange={(next) => setLocalRoom((r) => ({ ...r, photos: next }))}
                      />
                    </InlineFieldEditor>
                  ) : galleryUrls.length ? (
                    <ListingPhotoGallery urls={galleryUrls} />
                  ) : (
                    <p className="text-sm text-muted">
                      Aún no hay fotos. Usa el ícono de lápiz en Fotos para agregarlas.
                    </p>
                  )}
                </PreviewSection>

                <PreviewSection
                  title="Detalles de la recámara"
                  onEdit={() => {
                    setDetailsDraft(cloneRoomDraft(localRoom));
                    setEditingDetails(true);
                  }}
                  editLabel="Editar detalles"
                >
                  {editingDetails && detailsDraft ? (
                    <InlineFieldEditor
                      label="Tipo, disponibilidad y perfil buscado"
                      onSave={saveDetails}
                      onCancel={() => {
                        setEditingDetails(false);
                        setDetailsDraft(null);
                      }}
                    >
                      <div className="grid items-start gap-3 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-body">
                          <WizardPairedFieldLabel>Tipo de espacio</WizardPairedFieldLabel>
                          <select
                            id={PUBLISH_ROOM_MODAL_LODGING_ID}
                            value={detailsRoom.lodgingType}
                            onChange={(e) =>
                              setDetailsDraft((r) =>
                                r ? { ...r, lodgingType: e.target.value as LodgingType } : r,
                              )
                            }
                            className={WIZARD_FIELD_CONTROL_CLASS}
                          >
                            <option value="private_room">Recámara privada</option>
                            <option value="shared_room">Recámara compartida</option>
                            <option value="whole_home">Vivienda completa</option>
                          </select>
                        </label>
                        <label className="block text-sm font-medium text-body">
                          <WizardPairedFieldLabel>Tamaño de la recámara</WizardPairedFieldLabel>
                          <select
                            id={PUBLISH_ROOM_MODAL_DIMENSION_ID}
                            value={detailsRoom.roomDimension}
                            onChange={(e) =>
                              setDetailsDraft((r) =>
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
                        <div className="block text-sm font-medium text-body">
                          <WizardPairedFieldLabel>Plazas / espacios</WizardPairedFieldLabel>
                          <WizardNumberStepper
                            compact
                            value={Math.min(ROOM_PLAZAS_MAX, Math.max(0, detailsRoom.roomsAvailable))}
                            min={0}
                            max={ROOM_PLAZAS_MAX}
                            onChange={(n) =>
                              setDetailsDraft((r) => (r ? { ...r, roomsAvailable: n } : r))
                            }
                            decrementLabel="Menos plazas"
                            incrementLabel="Más plazas"
                          />
                        </div>
                        <label className="block text-sm font-medium text-body">
                          <WizardPairedFieldLabel>Disponible desde</WizardPairedFieldLabel>
                          <input
                            id={PUBLISH_ROOM_MODAL_AVAILABLE_FROM_ID}
                            type="date"
                            value={detailsRoom.availableFrom}
                            onChange={(e) =>
                              setDetailsDraft((r) => (r ? { ...r, availableFrom: e.target.value } : r))
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
                              setDetailsDraft((r) => (r ? { ...r, minimalStayMonths: n } : r))
                            }
                            decrementLabel="Menos meses"
                            incrementLabel="Más meses"
                          />
                        </div>
                        <label className="block text-sm font-medium text-body">
                          <WizardPairedFieldLabel>
                            {ROOMMATE_GENDER_PREF_FIELD_LABEL_SHORT}
                          </WizardPairedFieldLabel>
                          <select
                            id={PUBLISH_ROOM_MODAL_GENDER_ID}
                            value={detailsRoom.roommateGenderPref}
                            onChange={(e) =>
                              setDetailsDraft((r) =>
                                r
                                  ? { ...r, roommateGenderPref: e.target.value as RoommateGenderPref }
                                  : r,
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
                              setDetailsDraft((r) =>
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
                              setDetailsDraft((r) =>
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
                      hidePricing={draft.hidePricing}
                    />
                  )}
                </PreviewSection>

                <PreviewSection title="Descripción de la recámara">
                  <ResizableTextarea
                    id={PUBLISH_ROOM_MODAL_DESCRIPTION_FIELD_ID}
                    value={summaryDraft}
                    onChange={(e) => setSummaryDraft(e.target.value)}
                    onBlur={flushSummary}
                    rows={6}
                    maxLength={ROOM_SUMMARY_MAX}
                    placeholder={ROOM_SUMMARY_PLACEHOLDER}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base sm:text-sm"
                  />
                  <FieldCharCount
                    current={summaryDraft.trim().length}
                    min={ROOM_SUMMARY_MIN}
                    max={ROOM_SUMMARY_MAX}
                    warnBelowMin
                    className="mt-1"
                  />
                  <ScopeTagsBlock
                    heading="Etiquetas de la recámara"
                    tags={roomTagsActive}
                    unselectedTags={listingTagsNotSelected(
                      ROOM_TAG_GROUPS.flatMap((g) => g.tags),
                      roomTagsActive,
                    )}
                    onToggle={toggleRoomTag}
                  />
                </PreviewSection>
              </>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-t border-border bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {showIssues && localIssues.length ? (
            <RoomLocalIssuesCallout
              draft={draft}
              room={flushPendingEdits(localRoom)}
              onFocusIssue={applyIssueFocus}
            />
          ) : publishBlockedReason ? (
            <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm font-medium text-warning-fg" role="status">
              {publishBlockedReason}
            </p>
          ) : null}
          {actionErr ? (
            <p className="text-sm text-error" role="alert">
              {actionErr}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={submitInFlight !== null}
              onClick={trySave}
              className="min-h-11 w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition enabled:hover:brightness-110 disabled:opacity-50 sm:flex-1"
            >
              {submitInFlight === "publish" ? "Guardando…" : confirmLabel}
            </button>
            <button
              type="button"
              disabled={submitInFlight !== null}
              onClick={onClose}
              className="min-h-11 w-full rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-body transition hover:bg-surface-elevated disabled:opacity-50 sm:w-auto"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : modal;
}

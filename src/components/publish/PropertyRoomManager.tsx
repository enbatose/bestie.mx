import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { BulkImageUploader } from "@/components/BulkImageUploader";
import { WizardNumberStepper } from "@/components/WizardNumberStepper";
import {
  LISTING_TAG_LABEL_OVERRIDES,
  ROOMMATE_GENDER_PREF_FIELD_LABEL,
  ROOM_TAG_GROUPS,
} from "@/lib/listingTags";
import {
  propertyOccupiedRoomCount,
  propertyRentRoomCount,
  propertyRoomDefaultTitle,
  propertyRoomListOrder,
} from "@/lib/publishWizard/propertyRoomSlots";
import {
  collectRoomFieldIssues,
  roomValidationIssuesByIndex,
} from "@/lib/publishWizard/roomWizardValidation";
import { isRoomAvailableForRent } from "@/lib/roomDisplay";
import type { DraftImage } from "@/lib/publishWizard/draftImages";
import { TAG_LABELS } from "@/lib/searchFilters";
import type { Draft, RoomDraft } from "@/pages/PublishWizardPage";
import type { ListingTag, LodgingType, PropertyKind, RoomDimension, RoomOccupancyStatus, RoommateGenderPref } from "@/types/listing";

const ROOM_STAY_MAX = 36;
const ROOM_SUMMARY_MIN = 100;
const ROOM_SUMMARY_MAX = 1500;
const ROOM_OCCUPANT_MAX = 12;

const ROOM_SUMMARY_PLACEHOLDER =
  "Describe el tamaño, la iluminación, si tiene clóset, y qué incluye.";

type Props = {
  draft: Draft;
  propertyKind: PropertyKind;
  propertyBedroomsTotal: number;
  propertyBedroomsMax: number;
  onBedroomTotalChange: (count: number) => void;
  expandedRoomIndex: number | null;
  onExpandedRoomIndexChange: (index: number | null) => void;
  /** When true (new post), occupied rooms appear before available ones. */
  preferOccupiedFirst?: boolean;
  onRentRoomCountChange: (count: number) => void;
  onOccupancyStatusChange: (roomIndex: number, status: RoomOccupancyStatus) => void;
  onUpdateRoom: (index: number, patch: Partial<RoomDraft>) => void;
  onRoomPhotosChange: (roomIndex: number, photos: DraftImage[]) => void;
  onToggleTag: (roomIndex: number, tag: ListingTag, active: boolean) => void;
  apiOn?: boolean;
};

function RoomStatusBadges({
  issues,
  showStatus = false,
  available = false,
}: {
  issues: string[];
  showStatus?: boolean;
  available?: boolean;
}) {
  return (
    <span className="inline-flex shrink-0 flex-wrap items-center justify-end gap-2">
      {showStatus ? (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            available ? "bg-secondary/15 text-primary" : "bg-bg-light text-muted ring-1 ring-border"
          }`}
        >
          {available ? "Disponible" : "Ocupada"}
        </span>
      ) : null}
      {issues.length > 0 ? (
        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-body">
          Incompleta
        </span>
      ) : (
        <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
          Lista
        </span>
      )}
    </span>
  );
}

function RoomCardFooter({
  expanded,
  onCollapse,
}: {
  expanded: boolean;
  onCollapse: () => void;
}) {
  if (!expanded) return null;

  return (
    <div className="border-t border-border px-4 py-3">
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCollapse}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-surface-elevated"
        >
          <ChevronUp className="size-3.5" aria-hidden />
          Contraer
        </button>
      </div>
    </div>
  );
}

function RoomTitleInlineEditor({
  room,
  displayNumber,
  onUpdate,
  stopClickPropagation = false,
}: {
  room: RoomDraft;
  displayNumber: number;
  onUpdate: (patch: Partial<RoomDraft>) => void;
  /** Prevents accordion toggle when editing from the card header. */
  stopClickPropagation?: boolean;
}) {
  const fallbackTitle = propertyRoomDefaultTitle(displayNumber);
  const resolvedTitle = room.customName?.trim() || room.title?.trim() || fallbackTitle;
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(resolvedTitle);

  useEffect(() => {
    if (!editing) setDraftTitle(resolvedTitle);
  }, [resolvedTitle, editing]);

  const stopBubble = (e: { stopPropagation(): void }) => {
    if (stopClickPropagation) e.stopPropagation();
  };

  const commitTitle = () => {
    const trimmed = draftTitle.trim();
    onUpdate({
      customName: trimmed,
      title: trimmed || fallbackTitle,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <label className="block text-sm font-medium text-body" onClick={stopBubble}>
        Título de la recámara
        <span className="text-error"> *</span>
        <input
          autoFocus
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onBlur={commitTitle}
          onClick={stopBubble}
          onKeyDown={(e) => {
            stopBubble(e);
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Escape") {
              setDraftTitle(resolvedTitle);
              setEditing(false);
            }
          }}
          placeholder={`Ej. Cuarto con balcón · ${fallbackTitle}`}
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
        />
      </label>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="break-words text-base font-bold text-primary">{resolvedTitle}</span>
      <button
        type="button"
        onClick={(e) => {
          if (stopClickPropagation) e.stopPropagation();
          setEditing(true);
        }}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/5 text-primary transition hover:bg-primary/10"
        aria-label={`Editar título de ${fallbackTitle}`}
      >
        <Pencil className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

function OccupiedRoomFields({
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
        <span className="text-xs text-muted">Ocupado por —</span>
        {!needsDetailSteppers ? (
          <>
            <button
              type="button"
              onClick={() => onChange({ occupantWomenCount: 1, occupantMenCount: 0 })}
              className={chipClass(women === 1 && men === 0)}
            >
              1 Mujer
            </button>
            <button
              type="button"
              onClick={() => onChange({ occupantMenCount: 1, occupantWomenCount: 0 })}
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
            <span className="text-error"> *</span>
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
            <span className="text-error"> *</span>
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

function RoomAvailabilityToggle({
  available,
  onChange,
  fullWidth = false,
}: {
  available: boolean;
  onChange: (nextAvailable: boolean) => void;
  /** Stack below badges on narrow screens so controls do not overlap. */
  fullWidth?: boolean;
}) {
  return (
    <div
      className={`inline-flex min-w-0 rounded-xl border border-border bg-surface p-1 shadow-sm ${
        fullWidth ? "w-full" : "sm:flex-none"
      }`}
      role="group"
      aria-label="Estado de la recámara"
    >
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`min-h-9 flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:flex-none sm:px-3 sm:py-1 ${
          !available
            ? "bg-bg-light text-body ring-1 ring-border"
            : "text-muted hover:bg-surface-elevated"
        }`}
      >
        Ocupada
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`min-h-9 flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:flex-none sm:px-3 sm:py-1 ${
          available
            ? "bg-primary text-primary-fg ring-1 ring-primary/20"
            : "text-muted hover:bg-surface-elevated"
        }`}
      >
        Disponible
      </button>
    </div>
  );
}

function RoomExpandButton({
  expanded,
  onExpandToggle,
}: {
  expanded?: boolean;
  onExpandToggle: () => void;
}) {
  return (
    <span className="inline-flex size-9 shrink-0 items-center justify-center sm:size-7">
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? "Contraer recámara" : "Expandir recámara"}
        onClick={onExpandToggle}
        className="inline-flex size-9 items-center justify-center rounded-full border border-border/80 bg-surface text-body/70 shadow-sm transition hover:border-primary/30 hover:bg-surface-elevated hover:text-primary sm:size-7"
      >
        <ChevronDown
          className={`size-4 stroke-[2.5] transition ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
    </span>
  );
}

/** Keeps toggle, status badge, and expand control aligned across occupied/available cards. */
function RoomCardHeaderActions({
  available,
  onAvailabilityChange,
  issues,
  expanded,
  onExpandToggle,
  showExpand = false,
}: {
  available: boolean;
  onAvailabilityChange: (nextAvailable: boolean) => void;
  issues: string[];
  expanded?: boolean;
  onExpandToggle?: () => void;
  showExpand?: boolean;
}) {
  const expandBtn =
    showExpand && onExpandToggle ? (
      <RoomExpandButton expanded={expanded} onExpandToggle={onExpandToggle} />
    ) : null;

  return (
    <>
      {/* Mobile: badge row + full-width toggle — avoids pill overlap on narrow screens. */}
      <span className="flex w-full min-w-0 flex-col gap-2 sm:hidden">
        <span className="flex items-center justify-between gap-2">
          <RoomStatusBadges issues={issues} />
          {expandBtn}
        </span>
        <RoomAvailabilityToggle
          available={available}
          onChange={onAvailabilityChange}
          fullWidth
        />
      </span>

      {/* sm+: inline toggle, badge, and chevron. */}
      <span className="hidden sm:flex sm:w-auto sm:shrink-0 sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
        <RoomAvailabilityToggle available={available} onChange={onAvailabilityChange} />
        <RoomStatusBadges issues={issues} />
        {expandBtn ?? (showExpand ? <span className="size-7 shrink-0" aria-hidden /> : null)}
      </span>
    </>
  );
}

function AvailableRoomFields({
  room,
  roomLabel,
  onChange,
  onToggleTag,
  onPhotosChange,
  apiOn = false,
}: {
  room: RoomDraft;
  roomLabel: string;
  onChange: (patch: Partial<RoomDraft>) => void;
  onToggleTag: (tag: ListingTag, active: boolean) => void;
  onPhotosChange: (photos: DraftImage[]) => void;
  apiOn?: boolean;
}) {
  return (
    <>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-body">
          Tipo de recámara
          <span className="text-error"> *</span>
          <select
            value={room.lodgingType === "whole_home" ? "private_room" : room.lodgingType}
            onChange={(e) => onChange({ lodgingType: e.target.value as LodgingType })}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
          >
            <option value="private_room">Recámara privada</option>
            <option value="shared_room">Recámara compartida</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-body">
          Tamaño de la recámara
          <span className="text-error"> *</span>
          <select
            value={room.roomDimension}
            onChange={(e) => onChange({ roomDimension: e.target.value as RoomDimension })}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
          >
            <option value="small">Individual (Cabe cama individual + buró)</option>
            <option value="medium">Matrimonial (Cabe cama matrimonial + escritorio)</option>
            <option value="large">Grande (Cabe cama Queen/King + área de estar)</option>
          </select>
        </label>
        <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-body">
              Renta (MXN / mes)
              <span className="text-error"> *</span>
              <input
                type="number"
                min={0}
                step={100}
                value={room.rentMxn === 0 ? "" : room.rentMxn}
                onChange={(e) => onChange({ rentMxn: Math.max(0, Number(e.target.value) || 0) })}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
              />
            </label>
            <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-elevated/50 px-3 py-2.5 text-body">
              <input
                type="checkbox"
                checked={room.rentIncludesUtilities}
                onChange={(e) => onChange({ rentIncludesUtilities: e.target.checked })}
                className="mt-0.5 size-4 shrink-0 rounded border-border text-primary"
              />
              <span>
                <span className="block text-sm font-medium text-body">Servicios básicos incluidos</span>
                <span className="mt-0.5 block text-xs text-muted leading-snug">
                  Activa esta opción si el precio de renta ya cubre luz, agua, gas e internet (Wi-Fi).
                </span>
              </span>
            </label>
          </div>
          <label className="block text-sm font-medium text-body">
            Depósito (MXN)
            <input
              type="number"
              min={0}
              step={100}
              value={room.depositMxn === 0 ? "" : room.depositMxn}
              onChange={(e) => onChange({ depositMxn: Math.max(0, Number(e.target.value) || 0) })}
              placeholder="0"
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
            />
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-elevated/50 px-3 py-2.5 text-body">
            <input
              type="checkbox"
              checked={room.avalRequired}
              onChange={(e) => onChange({ avalRequired: e.target.checked })}
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

      <div className="mt-4 rounded-xl border border-border bg-surface p-4 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-primary">Disponibilidad</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-body">
            Disponible desde
            <span className="text-error"> *</span>
            <input
              type="date"
              value={room.availableFrom}
              onChange={(e) => onChange({ availableFrom: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
            />
          </label>
          <div className="block text-sm font-medium text-body">
            <span className="block">
              Estancia mín. (meses)
              <span className="text-error"> *</span>
            </span>
            <WizardNumberStepper
              editableCenter
              maxInputDigits={2}
              value={Math.min(ROOM_STAY_MAX, Math.max(0, room.minimalStayMonths))}
              min={0}
              max={ROOM_STAY_MAX}
              onChange={(n) => onChange({ minimalStayMonths: n })}
              decrementLabel="Menos meses"
              incrementLabel="Más meses"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-surface p-4 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-primary">Perfil buscado</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm font-medium text-body">
            {ROOMMATE_GENDER_PREF_FIELD_LABEL}
            <span className="text-error"> *</span>
            <select
              value={room.roommateGenderPref}
              onChange={(e) => onChange({ roommateGenderPref: e.target.value as RoommateGenderPref })}
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
              <span className="text-error"> *</span>
            </span>
            <WizardNumberStepper
              editableCenter
              maxInputDigits={2}
              value={Math.min(99, Math.max(18, room.ageMin))}
              min={18}
              max={99}
              onChange={(n) =>
                onChange({
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
              <span className="text-error"> *</span>
            </span>
            <WizardNumberStepper
              editableCenter
              maxInputDigits={2}
              value={Math.min(99, Math.max(18, room.ageMax))}
              min={18}
              max={99}
              onChange={(n) =>
                onChange({
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
          Detalles de esta recámara
          <span className="text-error"> *</span>
        </h3>
        <textarea
          value={room.summary}
          onChange={(e) => onChange({ summary: e.target.value })}
          rows={6}
          maxLength={ROOM_SUMMARY_MAX}
          placeholder={ROOM_SUMMARY_PLACEHOLDER}
          className="min-h-[9rem] max-h-[70vh] w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
        />
        <span
          className={`flex justify-between gap-2 text-xs ${
            room.summary.trim().length < ROOM_SUMMARY_MIN ? "text-warning-fg" : "text-muted"
          }`}
        >
          <span>Mín. {ROOM_SUMMARY_MIN} caracteres</span>
          <span>
            {room.summary.trim().length} / {ROOM_SUMMARY_MAX}
          </span>
        </span>
        <BulkImageUploader
          title={`Fotos de ${roomLabel}`}
          images={room.photos}
          maxCount={20}
          apiOn={apiOn}
          hint="Solo el interior de esta recámara. No incluyas sala, cocina ni otras áreas comunes."
          onImagesChange={onPhotosChange}
        />
      </div>

      <div className="mt-4 rounded-xl border border-border bg-surface p-4 shadow-sm space-y-4">
        <div className="space-y-4">
          {ROOM_TAG_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-medium text-body">
                {group.title}
                {group.title === "Ideal para" ? <span className="text-error"> *</span> : null}
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
                      onClick={() => onToggleTag(tag, active)}
                      className={`min-w-0 rounded-full px-3 py-2 text-left text-xs font-medium hyphens-manual transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        active
                          ? "bg-primary text-primary-fg shadow-sm ring-1 ring-primary/20"
                          : "border border-border bg-surface text-body shadow-sm hover:bg-surface-elevated"
                      }`}
                    >
                      {LISTING_TAG_LABEL_OVERRIDES[tag] ?? TAG_LABELS[tag]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function PropertyRoomManager({
  draft,
  propertyKind,
  propertyBedroomsTotal,
  propertyBedroomsMax,
  onBedroomTotalChange,
  expandedRoomIndex,
  onExpandedRoomIndexChange,
  preferOccupiedFirst = false,
  onRentRoomCountChange,
  onOccupancyStatusChange,
  onUpdateRoom,
  onRoomPhotosChange,
  onToggleTag,
  apiOn = false,
}: Props) {
  const totalBedrooms = Math.max(1, propertyBedroomsTotal);
  const rentCount = propertyRentRoomCount(draft);
  const occupiedCount = propertyOccupiedRoomCount(draft);
  const issueRows = useMemo(() => roomValidationIssuesByIndex(draft), [draft]);
  const roomOrder = useMemo(
    () => propertyRoomListOrder(draft, preferOccupiedFirst),
    [draft, preferOccupiedFirst],
  );

  useEffect(() => {
    if (expandedRoomIndex == null) return;
    if (expandedRoomIndex >= draft.rooms.length) {
      onExpandedRoomIndexChange(null);
    }
  }, [draft.rooms.length, expandedRoomIndex, onExpandedRoomIndexChange]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-bg-light p-4 shadow-sm">
        <h3 className="text-[15px] font-bold text-primary">Recámaras de la propiedad</h3>
        <p className="mt-1 text-sm text-muted leading-snug">
          Indica el número total de recámaras de la propiedad y cuántas de ellas deseas publicar para
          rentar en este momento.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <label className="block text-sm font-medium text-body">
            <span className="block text-xs text-muted">Total en la propiedad</span>
            <span className="mt-0.5 block">
              Total de recámaras
              <span className="text-error"> *</span>
            </span>
            <WizardNumberStepper
              compact
              value={Math.min(propertyBedroomsMax, Math.max(1, propertyBedroomsTotal))}
              min={1}
              max={propertyBedroomsMax}
              disabled={propertyKind === "loft"}
              onChange={onBedroomTotalChange}
              decrementLabel="Menos recámaras"
              incrementLabel="Más recámaras"
            />
          </label>

          <label className="block text-sm font-medium text-body">
            <span className="block text-xs text-muted">Disponibles ahora</span>
            <span className="mt-0.5 block">
              Recámaras a rentar
              <span className="text-error"> *</span>
            </span>
            <WizardNumberStepper
              compact
              value={rentCount}
              min={0}
              max={totalBedrooms}
              onChange={onRentRoomCountChange}
              decrementLabel="Menos recámaras en renta"
              incrementLabel="Más recámaras en renta"
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-muted leading-snug">
          {occupiedCount > 0
            ? `${occupiedCount} ocupada${occupiedCount === 1 ? "" : "s"} — completa quién vive en cada una abajo.`
            : rentCount === totalBedrooms
              ? "Todas quedarán disponibles para renta."
              : `${totalBedrooms - rentCount} quedarán marcadas como ocupadas.`}
        </p>
      </div>

      {roomOrder.map((i) => {
        const room = draft.rooms[i]!;
        const roomNumber = i + 1;
        const expanded = expandedRoomIndex === i;
        const available = isRoomAvailableForRent(room);
        const issues = issueRows[i] ?? collectRoomFieldIssues(draft, room, i);
        const slotLabel = propertyRoomDefaultTitle(roomNumber);
        const customTitle = room.customName?.trim() || room.title?.trim() || "";
        const roomLabel = customTitle || slotLabel;
        const cardClass = `rounded-xl border bg-bg-light shadow-md ring-1 transition ${
          issues.length
            ? "border-warning/50 ring-warning/30"
            : expanded
              ? "border-primary/30 ring-primary/10"
              : "border-border ring-primary/10"
        }`;

        if (!available) {
          return (
            <div key={room.id} className={cardClass}>
              <div className="p-4">
                <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <RoomTitleInlineEditor
                      room={room}
                      displayNumber={roomNumber}
                      onUpdate={(patch) => onUpdateRoom(i, patch)}
                    />
                    {issues.length > 0 ? (
                      <p className="mt-1 text-xs text-warning-fg">Faltan: {issues.join(", ")}</p>
                    ) : null}
                  </div>
                  <RoomCardHeaderActions
                    available={false}
                    onAvailabilityChange={(nextAvailable) =>
                      onOccupancyStatusChange(i, nextAvailable ? "available" : "occupied")
                    }
                    issues={issues}
                  />
                </div>
                <OccupiedRoomFields room={room} onChange={(patch) => onUpdateRoom(i, patch)} />
              </div>
            </div>
          );
        }

        return (
          <div key={room.id} className={cardClass}>
            <div className="flex w-full min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div
                className="min-w-0 flex-1 cursor-pointer"
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                onClick={() => onExpandedRoomIndexChange(expanded ? null : i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onExpandedRoomIndexChange(expanded ? null : i);
                  }
                }}
              >
                <RoomTitleInlineEditor
                  room={room}
                  displayNumber={roomNumber}
                  onUpdate={(patch) => onUpdateRoom(i, patch)}
                  stopClickPropagation
                />
                {!expanded && issues.length > 0 ? (
                  <p className="mt-1 text-xs text-warning-fg">Faltan: {issues.join(", ")}</p>
                ) : null}
                {!expanded && issues.length === 0 ? (
                  <p className="mt-1 text-xs text-muted">Completa — toca para editar</p>
                ) : null}
              </div>
              <RoomCardHeaderActions
                available
                onAvailabilityChange={(nextAvailable) =>
                  onOccupancyStatusChange(i, nextAvailable ? "available" : "occupied")
                }
                issues={issues}
                expanded={expanded}
                showExpand
                onExpandToggle={() => onExpandedRoomIndexChange(expanded ? null : i)}
              />
            </div>

            {expanded ? (
              <div className="border-t border-border px-4 pb-4">
                <div className="mt-2 rounded-xl border border-border bg-surface p-4 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-primary">Información principal</h3>
                  </div>
                  <AvailableRoomFields
                    room={room}
                    roomLabel={roomLabel}
                    apiOn={apiOn}
                    onChange={(patch) => onUpdateRoom(i, patch)}
                    onPhotosChange={(photos) => onRoomPhotosChange(i, photos)}
                    onToggleTag={(tag, active) => onToggleTag(i, tag, active)}
                  />
                  <p className="text-xs text-muted">
                    Si alguien renta esta recámara, puedes marcarla como ocupada más adelante. Guardamos descripción,
                    fotos y precio para cuando vuelva a estar disponible.
                  </p>
                </div>
              </div>
            ) : null}

            <RoomCardFooter
              expanded={expanded}
              onCollapse={() => onExpandedRoomIndexChange(null)}
            />
          </div>
        );
      })}
    </div>
  );
}

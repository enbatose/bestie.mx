import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Pencil } from "lucide-react";
import { WizardNumberStepper } from "@/components/WizardNumberStepper";
import {
  LISTING_TAG_LABEL_OVERRIDES,
  ROOMMATE_GENDER_PREF_FIELD_LABEL,
  ROOM_TAG_GROUPS,
} from "@/lib/listingTags";
import {
  propertyOccupiedRoomCount,
  propertyRentRoomCount,
  propertyRoomContextLabel,
  propertyRoomDefaultTitle,
  propertyRoomListOrder,
} from "@/lib/publishWizard/propertyRoomSlots";
import {
  collectRoomFieldIssues,
  roomValidationIssuesByIndex,
} from "@/lib/publishWizard/roomWizardValidation";
import { isRoomAvailableForRent, occupiedRoomOccupantSummary, occupancyStatusLabel } from "@/lib/roomDisplay";
import { WizardSaveDraftButton } from "@/components/publish/WizardSaveDraftButton";
import { TAG_LABELS } from "@/lib/searchFilters";
import type { Draft, RoomDraft } from "@/pages/PublishWizardPage";
import type { ListingTag, LodgingType, PropertyKind, RoomDimension, RoomOccupancyStatus, RoommateGenderPref } from "@/types/listing";

const ROOM_STAY_MAX = 36;
const ROOM_SUMMARY_MIN = 200;
const ROOM_SUMMARY_MAX = 1500;
const ROOM_OCCUPANT_MAX = 12;

const ROOM_SUMMARY_PLACEHOLDER =
  "Comparte los detalles que harían que alguien quiera vivir aquí. Describe la vista, el tipo de cama, si cuenta con espacio para trabajar y el ambiente general con los roomies.";

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
  onToggleTag: (roomIndex: number, tag: ListingTag, active: boolean) => void;
  showSaveProgress?: boolean;
  onSaveProgress?: () => void;
  saveProgressInFlight?: boolean;
  saveProgressSaved?: boolean;
};

function RoomStatusBadges({
  available,
  issues,
}: {
  available: boolean;
  issues: string[];
}) {
  return (
    <span className="inline-flex shrink-0 flex-wrap items-center justify-end gap-2">
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
          available ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700"
        }`}
      >
        {occupancyStatusLabel(available ? "available" : "occupied")}
      </span>
      {issues.length > 0 ? (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
          Incompleta
        </span>
      ) : (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900">
          Lista
        </span>
      )}
    </span>
  );
}

function RoomSaveFooter({
  showSaveProgress,
  onSaveProgress,
  saveProgressInFlight,
  saveProgressSaved,
}: Pick<Props, "showSaveProgress" | "onSaveProgress" | "saveProgressInFlight" | "saveProgressSaved">) {
  if (!showSaveProgress || !onSaveProgress) return null;
  return (
    <div className="border-t border-border px-4 py-3">
      <WizardSaveDraftButton
        compact
        onClick={onSaveProgress}
        inFlight={saveProgressInFlight}
        saved={saveProgressSaved}
      />
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
        Título de la habitación
        <span className="text-red-600"> *</span>
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
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-base font-bold text-primary">{resolvedTitle}</span>
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
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="block text-sm font-medium text-body">
        <span className="block">
          Mujeres en esta recámara
          <span className="text-red-600"> *</span>
        </span>
        <WizardNumberStepper
          value={room.occupantWomenCount ?? 0}
          min={0}
          max={ROOM_OCCUPANT_MAX}
          onChange={(n) => onChange({ occupantWomenCount: n })}
          decrementLabel="Menos mujeres"
          incrementLabel="Más mujeres"
        />
      </div>
      <div className="block text-sm font-medium text-body">
        <span className="block">
          Hombres en esta recámara
          <span className="text-red-600"> *</span>
        </span>
        <WizardNumberStepper
          value={room.occupantMenCount ?? 0}
          min={0}
          max={ROOM_OCCUPANT_MAX}
          onChange={(n) => onChange({ occupantMenCount: n })}
          decrementLabel="Menos hombres"
          incrementLabel="Más hombres"
        />
      </div>
    </div>
  );
}

function AvailableRoomFields({
  room,
  onChange,
  onToggleTag,
}: {
  room: RoomDraft;
  onChange: (patch: Partial<RoomDraft>) => void;
  onToggleTag: (tag: ListingTag, active: boolean) => void;
}) {
  return (
    <>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-body">
          Tipo de recámara
          <span className="text-red-600"> *</span>
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
          <span className="text-red-600"> *</span>
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
              <span className="text-red-600"> *</span>
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
            <span className="text-red-600"> *</span>
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
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-surface p-4 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-primary">Disponibilidad</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-body">
            Disponible desde
            <span className="text-red-600"> *</span>
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
              <span className="text-red-600"> *</span>
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
            <span className="text-red-600"> *</span>
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
              <span className="text-red-600"> *</span>
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
              <span className="text-red-600"> *</span>
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
        <h3 className="text-sm font-bold text-primary">Detalles de la recámara</h3>
        <label className="block text-sm font-medium text-body">
          Descripción de la recámara
          <span className="text-red-600"> *</span>
          <textarea
            value={room.summary}
            onChange={(e) => onChange({ summary: e.target.value })}
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
          {ROOM_TAG_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-medium text-body">
                {group.title}
                {group.title === "Ideal para" ? <span className="text-red-600"> *</span> : null}
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
                      className={`rounded-full px-3 py-2 text-left text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
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
  onToggleTag,
  showSaveProgress = false,
  onSaveProgress,
  saveProgressInFlight = false,
  saveProgressSaved = false,
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

  const saveFooterProps = {
    showSaveProgress,
    onSaveProgress,
    saveProgressInFlight,
    saveProgressSaved,
  };

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
              <span className="text-red-600"> *</span>
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
              <span className="text-red-600"> *</span>
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

      {roomOrder.map((i, displayIndex) => {
        const room = draft.rooms[i]!;
        const displayNumber = displayIndex + 1;
        const expanded = expandedRoomIndex === i;
        const available = isRoomAvailableForRent(room);
        const issues = issueRows[i] ?? collectRoomFieldIssues(draft, room, i);
        const contextLabel = propertyRoomContextLabel(displayNumber, totalBedrooms, !available);
        const cardClass = `rounded-xl border bg-bg-light shadow-md ring-1 transition ${
          issues.length
            ? "border-amber-300/80 ring-amber-200/60"
            : expanded
              ? "border-primary/30 ring-primary/10"
              : "border-border ring-primary/10"
        }`;

        if (!available) {
          const occupantSummary = occupiedRoomOccupantSummary(room);

          return (
            <div key={room.id} className={cardClass}>
              <div className="flex w-full items-start justify-between gap-3 p-4">
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{contextLabel}</p>
                  <div className="mt-1">
                    <RoomTitleInlineEditor
                      room={room}
                      displayNumber={displayNumber}
                      onUpdate={(patch) => onUpdateRoom(i, patch)}
                      stopClickPropagation
                    />
                  </div>
                  {!expanded && occupantSummary ? (
                    <p className="mt-1 text-xs text-muted">{occupantSummary}</p>
                  ) : null}
                  {!expanded && issues.length > 0 ? (
                    <p className="mt-1 text-xs text-amber-800">Faltan: {issues.join(", ")}</p>
                  ) : null}
                  {!expanded && !occupantSummary && issues.length === 0 ? (
                    <p className="mt-1 text-xs text-muted">Toca para indicar quién ocupa</p>
                  ) : null}
                </div>
                <span className="inline-flex shrink-0 items-center gap-2">
                  <RoomStatusBadges available={false} issues={issues} />
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-label={expanded ? "Contraer recámara" : "Expandir recámara"}
                    onClick={() => onExpandedRoomIndexChange(expanded ? null : i)}
                    className="rounded-lg p-1 text-muted transition hover:bg-surface-elevated"
                  >
                    <ChevronDown
                      className={`size-5 transition ${expanded ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </button>
                </span>
              </div>

              {expanded ? (
                <div className="space-y-4 border-t border-border px-4 pb-4 pt-4">
                  <OccupiedRoomFields room={room} onChange={(patch) => onUpdateRoom(i, patch)} />

                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-body">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => onOccupancyStatusChange(i, "available")}
                      className="size-4 rounded border-border text-primary"
                    />
                    Marcar como disponible para renta
                  </label>
                </div>
              ) : null}

              <RoomSaveFooter {...saveFooterProps} />
            </div>
          );
        }

        return (
          <div key={room.id} className={cardClass}>
            <div className="flex w-full items-start justify-between gap-3 p-4">
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
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{contextLabel}</p>
                <div className="mt-1">
                  <RoomTitleInlineEditor
                    room={room}
                    displayNumber={displayNumber}
                    onUpdate={(patch) => onUpdateRoom(i, patch)}
                    stopClickPropagation
                  />
                </div>
                {!expanded && issues.length > 0 ? (
                  <p className="mt-1 text-xs text-amber-800">Faltan: {issues.join(", ")}</p>
                ) : null}
                {!expanded && issues.length === 0 ? (
                  <p className="mt-1 text-xs text-muted">Completa — toca para editar</p>
                ) : null}
              </div>
              <span className="inline-flex shrink-0 items-center gap-2">
                <RoomStatusBadges available issues={issues} />
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-label={expanded ? "Contraer recámara" : "Expandir recámara"}
                  onClick={() => onExpandedRoomIndexChange(expanded ? null : i)}
                  className="rounded-lg p-1 text-muted transition hover:bg-surface-elevated"
                >
                  <ChevronDown
                    className={`size-5 transition ${expanded ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
              </span>
            </div>

            {expanded ? (
              <div className="border-t border-border px-4 pb-4">
                <div className="mt-2 rounded-xl border border-border bg-surface p-4 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-primary">Información principal</h3>
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-body">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => onOccupancyStatusChange(i, "occupied")}
                        className="size-4 rounded border-border text-primary"
                      />
                      Recámara ocupada
                    </label>
                  </div>
                  <AvailableRoomFields
                    room={room}
                    onChange={(patch) => onUpdateRoom(i, patch)}
                    onToggleTag={(tag, active) => onToggleTag(i, tag, active)}
                  />
                  <p className="text-xs text-muted">
                    Si alguien renta esta recámara, puedes marcarla como ocupada más adelante. Guardamos descripción,
                    fotos y precio para cuando vuelva a estar disponible.
                  </p>
                </div>
              </div>
            ) : null}

            <RoomSaveFooter {...saveFooterProps} />
          </div>
        );
      })}
    </div>
  );
}

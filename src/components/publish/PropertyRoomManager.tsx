import { useEffect, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { WizardNumberStepper } from "@/components/WizardNumberStepper";
import {
  LISTING_TAG_LABEL_OVERRIDES,
  ROOMMATE_GENDER_PREF_FIELD_LABEL,
  ROOM_TAG_GROUPS,
} from "@/lib/listingTags";
import {
  collectRoomFieldIssues,
  roomValidationIssuesByIndex,
  roomWizardLabel,
} from "@/lib/publishWizard/roomWizardValidation";
import { TAG_LABELS } from "@/lib/searchFilters";
import type { Draft, RoomDraft } from "@/pages/PublishWizardPage";
import type { ListingTag, LodgingType, RoomDimension, RoommateGenderPref } from "@/types/listing";

const ROOM_STAY_MAX = 36;
const ROOM_SUMMARY_MIN = 200;
const ROOM_SUMMARY_MAX = 1500;

const ROOM_SUMMARY_PLACEHOLDER =
  "Comparte los detalles que harían que alguien quiera vivir aquí. Describe la vista, el tipo de cama, si cuenta con espacio para trabajar y el ambiente general con los roomies.";

type Props = {
  draft: Draft;
  propertyBedroomsTotal: number;
  expandedRoomIndex: number;
  onExpandedRoomIndexChange: (index: number) => void;
  onAvailableRoomCountChange: (count: number) => void;
  onUpdateRoom: (index: number, patch: Partial<RoomDraft>) => void;
  onToggleTag: (roomIndex: number, tag: ListingTag, active: boolean) => void;
};

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
  propertyBedroomsTotal,
  expandedRoomIndex,
  onExpandedRoomIndexChange,
  onAvailableRoomCountChange,
  onUpdateRoom,
  onToggleTag,
}: Props) {
  const totalBedrooms = Math.max(1, propertyBedroomsTotal);
  const availableCount = Math.max(1, Math.min(totalBedrooms, draft.rooms.length));
  const issueRows = useMemo(() => roomValidationIssuesByIndex(draft), [draft]);

  useEffect(() => {
    if (expandedRoomIndex >= availableCount) {
      onExpandedRoomIndexChange(Math.max(0, availableCount - 1));
    }
  }, [availableCount, expandedRoomIndex, onExpandedRoomIndexChange]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-bg-light p-4 px-5 shadow-sm space-y-3">
        <h3 className="text-[15px] font-bold text-primary">Recámaras en renta</h3>
        <p className="text-sm text-muted">
          En el paso anterior indicaste que la propiedad tiene{" "}
          <strong className="text-body">
            {totalBedrooms} {totalBedrooms === 1 ? "recámara" : "recámaras"}
          </strong>{" "}
          en total (ocupadas y disponibles). ¿Cuántas de esas recámaras publicarás en renta?
        </p>
        <div className="block text-sm font-medium text-body">
          <span className="block">
            Recámaras disponibles para renta
            <span className="text-red-600"> *</span>
          </span>
          <WizardNumberStepper
            value={availableCount}
            min={1}
            max={totalBedrooms}
            onChange={onAvailableRoomCountChange}
            decrementLabel="Menos recámaras en renta"
            incrementLabel="Más recámaras en renta"
          />
          <span className="mt-1 block text-xs text-muted">
            Crearemos una ficha por recámara (máximo {totalBedrooms}, según el total de la propiedad).
          </span>
        </div>
      </div>

      {draft.rooms.map((room, i) => {
        if (i >= availableCount) return null;
        const expanded = expandedRoomIndex === i;
        const issues = issueRows[i] ?? collectRoomFieldIssues(draft, room, i);
        const heading = roomWizardLabel(draft, room, i);
        return (
          <div
            key={room.id}
            className={`rounded-xl border bg-bg-light shadow-md ring-1 transition ${
              issues.length
                ? "border-amber-300/80 ring-amber-200/60"
                : expanded
                  ? "border-primary/30 ring-primary/10"
                  : "border-border ring-primary/10"
            }`}
          >
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => onExpandedRoomIndexChange(i)}
              className="flex w-full items-start justify-between gap-3 p-4 text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Recámara en renta {i + 1} de {availableCount}
                </p>
                <p className="mt-1 text-sm font-bold text-primary">{heading}</p>
                {!expanded && issues.length > 0 ? (
                  <p className="mt-1 text-xs text-amber-800">
                    Faltan: {issues.join(", ")}
                  </p>
                ) : null}
                {!expanded && issues.length === 0 ? (
                  <p className="mt-1 text-xs text-muted">Completa — toca para revisar</p>
                ) : null}
              </div>
              <span className="inline-flex shrink-0 items-center gap-2">
                {issues.length > 0 ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                    Incompleta
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900">
                    Lista
                  </span>
                )}
                <ChevronDown
                  className={`size-5 text-muted transition ${expanded ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </span>
            </button>

            {expanded ? (
              <div className="border-t border-border px-4 pb-4">
                <div className="mt-2 rounded-xl border border-border bg-surface p-4 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-primary">Información principal</h3>
                  <label className="block text-sm font-medium text-body">
                    Título de la habitación
                    <span className="text-red-600"> *</span>
                    <input
                      value={room.customName || room.title}
                      onChange={(e) =>
                        onUpdateRoom(i, {
                          customName: e.target.value,
                          title: e.target.value,
                        })
                      }
                      placeholder={`Ej. Cuarto con balcón · Habitación ${i + 1}`}
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                    />
                  </label>
                  <AvailableRoomFields
                    room={room}
                    onChange={(patch) => onUpdateRoom(i, patch)}
                    onToggleTag={(tag, active) => onToggleTag(i, tag, active)}
                  />
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

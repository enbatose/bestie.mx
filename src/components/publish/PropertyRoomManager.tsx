import { WizardNumberStepper } from "@/components/WizardNumberStepper";
import {
  LISTING_TAG_LABEL_OVERRIDES,
  ROOMMATE_GENDER_PREF_FIELD_LABEL,
  ROOM_TAG_GROUPS,
} from "@/lib/listingTags";
import { isRoomAvailableForRent, roomDisplayName } from "@/lib/roomDisplay";
import { TAG_LABELS } from "@/lib/searchFilters";
import type { Draft, RoomDraft } from "@/pages/PublishWizardPage";
import type { ListingTag, LodgingType, RoomDimension, RoommateGenderPref } from "@/types/listing";

const ROOM_PLAZAS_MAX = 12;
const ROOM_STAY_MAX = 36;
const ROOM_SUMMARY_MIN = 200;
const ROOM_SUMMARY_MAX = 1500;

const ROOM_SUMMARY_PLACEHOLDER =
  "Comparte los detalles que harían que alguien quiera vivir aquí. Describe la vista, el tipo de cama, si cuenta con espacio para trabajar y el ambiente general con los roomies.";

type Props = {
  draft: Draft;
  onUpdateRoom: (index: number, patch: Partial<RoomDraft>) => void;
  onRemoveRoom: (index: number) => void;
  onAddRoom: () => void;
  onToggleTag: (roomIndex: number, tag: ListingTag, active: boolean) => void;
};

function OccupancyToggle({
  value,
  onChange,
}: {
  value: RoomDraft["occupancyStatus"];
  onChange: (next: RoomDraft["occupancyStatus"]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {(
        [
          { id: "available" as const, label: "Disponible" },
          { id: "occupied" as const, label: "Ocupada" },
        ] as const
      ).map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
            value === opt.id
              ? "bg-primary text-primary-fg ring-2 ring-primary/30"
              : "border border-border bg-surface text-body hover:bg-surface-elevated"
          }`}
        >
          {opt.label}
        </button>
      ))}
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
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm font-medium text-body">
        Género del ocupante actual
        <span className="text-red-600"> *</span>
        <select
          value={room.occupantGender}
          onChange={(e) => onChange({ occupantGender: e.target.value as RoommateGenderPref })}
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
        >
          <option value="female">Mujer</option>
          <option value="male">Hombre</option>
          <option value="any">Otro / prefiero no decir</option>
        </select>
      </label>
      <div className="block text-sm font-medium text-body">
        <span className="block">
          Edad del ocupante actual
          <span className="text-red-600"> *</span>
        </span>
        <WizardNumberStepper
          editableCenter
          maxInputDigits={2}
          value={Math.min(99, Math.max(18, room.occupantAge))}
          min={18}
          max={99}
          onChange={(n) => onChange({ occupantAge: n })}
          decrementLabel="Menor edad"
          incrementLabel="Mayor edad"
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
          Tipo de espacio
          <span className="text-red-600"> *</span>
          <select
            value={room.lodgingType === "whole_home" ? "private_room" : room.lodgingType}
            onChange={(e) => onChange({ lodgingType: e.target.value as LodgingType })}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
          >
            <option value="private_room">Recámara privada</option>
            <option value="shared_room">Recámara compartida</option>
            <option value="whole_home">Vivienda completa</option>
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
            <option value="small">Pequeño</option>
            <option value="medium">Mediano</option>
            <option value="large">Grande</option>
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
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="block text-sm font-medium text-body">
            <span className="block">
              Plazas / espacios
              <span className="text-red-600"> *</span>
            </span>
            <WizardNumberStepper
              value={Math.min(ROOM_PLAZAS_MAX, Math.max(1, room.roomsAvailable))}
              min={1}
              max={ROOM_PLAZAS_MAX}
              onChange={(n) => onChange({ roomsAvailable: n })}
              decrementLabel="Menos plazas"
              incrementLabel="Más plazas"
            />
          </div>
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

export function PropertyRoomManager({ draft, onUpdateRoom, onRemoveRoom, onAddRoom, onToggleTag }: Props) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Administra cada recámara de la propiedad. Marca las ocupadas para registrar solo al roomie actual; las
        disponibles se publican con el mismo detalle que un anuncio de habitación individual.
      </p>
      {draft.rooms.map((room, i) => {
        const available = isRoomAvailableForRent(room);
        const label = roomDisplayName(room, i);
        return (
          <div
            key={room.id}
            className="rounded-xl border border-border bg-bg-light p-4 shadow-md ring-1 ring-primary/10"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
              {draft.rooms.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onRemoveRoom(i)}
                  className="text-xs font-semibold text-red-600 hover:underline"
                >
                  Quitar
                </button>
              ) : null}
            </div>
            <div className="mt-2 rounded-xl border border-border bg-surface p-4 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-primary">Estado de la recámara</h3>
              <label className="block text-sm font-medium text-body">
                Nombre personalizado (opcional)
                <input
                  value={room.customName}
                  onChange={(e) =>
                    onUpdateRoom(i, {
                      customName: e.target.value,
                      title: e.target.value,
                    })
                  }
                  placeholder={`Ej. Cuarto principal · ${label}`}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                />
              </label>
              <div>
                <p className="text-sm font-medium text-body mb-2">¿Está disponible para renta?</p>
                <OccupancyToggle
                  value={room.occupancyStatus}
                  onChange={(occupancyStatus) => onUpdateRoom(i, { occupancyStatus })}
                />
              </div>
              {available ? (
                <AvailableRoomFields
                  room={room}
                  onChange={(patch) => onUpdateRoom(i, patch)}
                  onToggleTag={(tag, active) => onToggleTag(i, tag, active)}
                />
              ) : (
                <OccupiedRoomFields room={room} onChange={(patch) => onUpdateRoom(i, patch)} />
              )}
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={onAddRoom}
        className="w-full rounded-xl border border-dashed border-secondary/60 py-2 text-sm font-semibold text-primary hover:bg-secondary/10"
      >
        + Agregar otra recámara
      </button>
    </div>
  );
}

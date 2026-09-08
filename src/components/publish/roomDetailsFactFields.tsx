import {
  WizardPairedFieldLabel,
  WIZARD_FIELD_CONTROL_CLASS,
} from "@/components/WizardNumberStepper";
import { setListingTag } from "@/lib/listingTags";
import type { ListingTag } from "@/types/listing";

export const PUBLISH_ROOM_BATHROOM_ID = "publish-room-bathroom";

function FactCheckbox({
  checked,
  onChange,
  title,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  hint: string;
}) {
  return (
    <label className="flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-elevated/50 px-3 py-2.5 text-body">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 rounded border-border text-primary"
      />
      <span className="min-w-0">
        <span className="block break-words text-sm font-medium text-body">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted">{hint}</span>
      </span>
    </label>
  );
}

/** Baño fact shown on Detalles de la recámara (`baño-privado` room tag). */
export function RoomBathroomField({
  tags,
  onChange,
}: {
  tags: readonly ListingTag[];
  onChange: (tags: ListingTag[]) => void;
}) {
  return (
    <label className="block min-w-0 text-sm font-medium text-body">
      <WizardPairedFieldLabel>Baño</WizardPairedFieldLabel>
      <select
        id={PUBLISH_ROOM_BATHROOM_ID}
        value={tags.includes("baño-privado") ? "private" : "shared"}
        onChange={(e) => onChange(setListingTag(tags, "baño-privado", e.target.value === "private"))}
        className={WIZARD_FIELD_CONTROL_CLASS}
      >
        <option value="shared">Baño compartido</option>
        <option value="private">Baño privado</option>
      </select>
    </label>
  );
}

export function RoomUtilitiesAvalFields({
  rentIncludesUtilities,
  avalRequired,
  onRentIncludesUtilitiesChange,
  onAvalRequiredChange,
}: {
  rentIncludesUtilities: boolean;
  avalRequired: boolean;
  onRentIncludesUtilitiesChange: (checked: boolean) => void;
  onAvalRequiredChange: (checked: boolean) => void;
}) {
  return (
    <>
      <FactCheckbox
        checked={rentIncludesUtilities}
        onChange={onRentIncludesUtilitiesChange}
        title="Servicios básicos incluidos"
        hint="Activa esta opción si el precio de renta ya cubre luz, agua, gas e internet (Wi-Fi)."
      />
      <FactCheckbox
        checked={avalRequired}
        onChange={onAvalRequiredChange}
        title="Se requiere aval"
        hint="Activa esta opción si para rentar esta recámara es obligatorio presentar aval."
      />
    </>
  );
}

/**
 * Facts shown on a single-room Detalles de la recámara that live as tags:
 * parking on the room, pets / parties / smoking on the property.
 */
export function RoomHouseRuleFactFields({
  roomTags,
  onRoomTagsChange,
  permitidoTags,
  onPermitidoChange,
}: {
  roomTags: readonly ListingTag[];
  onRoomTagsChange: (tags: ListingTag[]) => void;
  permitidoTags: readonly ListingTag[];
  onPermitidoChange: (tags: ListingTag[]) => void;
}) {
  return (
    <>
      <FactCheckbox
        checked={roomTags.includes("estacionamiento")}
        onChange={(checked) => onRoomTagsChange(setListingTag(roomTags, "estacionamiento", checked))}
        title="Estacionamiento incluido"
        hint="Activa esta opción si la renta incluye un lugar de estacionamiento."
      />
      <FactCheckbox
        checked={permitidoTags.includes("mascotas")}
        onChange={(checked) => onPermitidoChange(setListingTag(permitidoTags, "mascotas", checked))}
        title="Mascotas"
        hint="Activa esta opción si se aceptan mascotas en el espacio."
      />
      <FactCheckbox
        checked={permitidoTags.includes("fiestas")}
        onChange={(checked) => onPermitidoChange(setListingTag(permitidoTags, "fiestas", checked))}
        title="Fiestas"
        hint="Activa esta opción si se permiten fiestas en áreas comunes."
      />
      <FactCheckbox
        checked={permitidoTags.includes("fumar")}
        onChange={(checked) => onPermitidoChange(setListingTag(permitidoTags, "fumar", checked))}
        title="Fumar en áreas comunes"
        hint="Activa esta opción si se permite fumar en áreas comunes."
      />
    </>
  );
}

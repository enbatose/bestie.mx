import { Pencil } from "lucide-react";
import { ListingSection } from "@/components/listing/ListingSection";
import { ListingTagChips } from "@/components/listing/ListingTagChips";
import { newRoomDraftId } from "@/lib/roomDisplay";
import type { Draft, RoomDraft } from "@/pages/PublishWizardPage";
import type { ListingTag } from "@/types/listing";

export const ROOM_PLAZAS_MAX = 12;
export const ROOM_STAY_MAX = 36;
export const ROOM_OCCUPANT_MAX = 12;

/** Icon-only pencil for editable preview blocks (wizard, AI, live edit). */
export function PreviewPencilEditButton({
  onClick,
  ariaLabel,
  className = "",
}: {
  onClick: () => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/5 text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${className}`.trim()}
    >
      <Pencil className="size-3.5" aria-hidden />
    </button>
  );
}

export function PreviewSection({
  title,
  subtitle,
  children,
  onEdit,
  editLabel = "Editar",
  id,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onEdit?: () => void;
  editLabel?: string;
  id?: string;
  className?: string;
}) {
  return (
    <ListingSection
      id={id}
      className={className}
      title={title}
      subtitle={subtitle}
      action={
        onEdit ? <PreviewPencilEditButton onClick={onEdit} ariaLabel={editLabel} /> : undefined
      }
    >
      {children}
    </ListingSection>
  );
}

export function InlineFieldEditor({
  label,
  children,
  onSave,
  onCancel,
  saveLabel = "Guardar cambios",
  labelClassName = "text-xs font-medium text-muted",
}: {
  label: string;
  children: React.ReactNode;
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
  labelClassName?: string;
}) {
  return (
    <div className="min-w-0 max-w-full space-y-3">
      <p className={`break-words ${labelClassName}`}>{label}</p>
      <div className="min-w-0 max-w-full overflow-hidden">{children}</div>
      <div className="flex flex-col gap-2 border-t border-border/70 pt-3 sm:flex-row sm:flex-wrap sm:border-t-0 sm:pt-0">
        <button
          type="button"
          onClick={onSave}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-fg sm:w-auto"
        >
          {saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-body sm:w-auto"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function ScopeTagsBlock({
  heading,
  tags,
  unselectedTags,
  onToggle,
}: {
  heading: string;
  tags: readonly ListingTag[];
  unselectedTags?: readonly ListingTag[];
  onToggle: (tag: ListingTag, currentlyActive: boolean) => void;
}) {
  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{heading}</p>
      <div className="mt-2">
        <ListingTagChips tags={tags} unselectedTags={unselectedTags} onToggle={onToggle} />
      </div>
    </div>
  );
}

export function cloneRoomDraft(room: RoomDraft): RoomDraft {
  return { ...room, tags: [...room.tags], photos: [...(room.photos ?? [])] };
}

export function createPreviewDefaultRoom(d: Draft): RoomDraft {
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

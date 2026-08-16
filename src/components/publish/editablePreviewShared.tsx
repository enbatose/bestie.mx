import { Pencil } from "lucide-react";
import { ListingSection } from "@/components/listing/ListingSection";
import { ListingTagChips, listingTagLabel } from "@/components/listing/ListingTagChips";
import { TagChoiceSection } from "@/components/publish/TagChoiceSection";
import { newRoomDraftId } from "@/lib/roomDisplay";
import type { Draft, RoomDraft } from "@/pages/PublishWizardPage";
import type { ListingTag } from "@/types/listing";
import type { ListingTagGroup } from "@/lib/listingTags";

export const ROOM_PLAZAS_MAX = 12;
export const ROOM_STAY_MAX = 36;
export const ROOM_OCCUPANT_MAX = 12;

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

export function InlineFieldEditor({
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

export function TagGroupsEditor({
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
        <TagChoiceSection
          key={group.title}
          title={group.title}
          tags={group.tags}
          selected={selected}
          dashedInactive
          required={group.title === "Ideal para"}
          onToggle={(tag) => onToggle(tag)}
        />
      ))}
    </div>
  );
}

export function ScopeTagsBlock({
  heading,
  tags,
  editing,
  onStartEdit,
  onSave,
  onCancel,
  editGroups,
  draftTags,
  onToggle,
  hideEditButton = false,
  unselectedTags,
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
  hideEditButton?: boolean;
  unselectedTags?: readonly ListingTag[];
}) {
  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{heading}</p>
        {!editing && !hideEditButton ? (
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
          <>
            <ListingTagChips tags={tags} />
            {unselectedTags && unselectedTags.length > 0 ? (
              <div className="mt-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted/50">
                  No incluidas · edita para agregar
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {unselectedTags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted/50"
                    >
                      {listingTagLabel(t)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
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

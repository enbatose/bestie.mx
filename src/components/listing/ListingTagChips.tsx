import { Plus, Minus } from "lucide-react";
import { LISTING_TAG_CHIP_LABELS, LISTING_TAG_LABEL_OVERRIDES } from "@/lib/listingTags";
import { TAG_LABELS } from "@/lib/searchFilters";
import type { ListingTag } from "@/types/listing";

const TAG_CHIP_CLASS =
  "inline-flex min-h-9 min-w-0 items-center gap-1 rounded-full bg-bg-light px-2.5 py-1 text-xs font-medium hyphens-manual text-body ring-1 ring-border";

const TAG_CHIP_UNSELECTED_CLASS =
  "inline-flex min-h-9 min-w-0 items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs hyphens-manual text-muted/70";

/** Same 12px box as the bare icon; fill sits behind the glyph so chips don't grow. */
export function TagToggleGlyph({
  action,
  onPrimary = false,
}: {
  action: "add" | "remove";
  /** Active wizard pills sit on primary fill. */
  onPrimary?: boolean;
}) {
  const Icon = action === "add" ? Plus : Minus;
  const shell = onPrimary
    ? "bg-primary-fg/25 text-primary-fg"
    : action === "add"
      ? "bg-primary/20 text-primary"
      : "bg-primary/15 text-primary";
  return (
    <span
      className={`inline-flex size-3 shrink-0 items-center justify-center rounded-full ${shell}`}
      aria-hidden
    >
      <Icon className="size-2.5" strokeWidth={2.75} />
    </span>
  );
}

export function listingTagLabel(tag: ListingTag): string {
  return LISTING_TAG_LABEL_OVERRIDES[tag] ?? TAG_LABELS[tag];
}

/** One-line chip label for publish / room-editor pill grids. */
export function listingTagChipLabel(tag: ListingTag): string {
  return LISTING_TAG_CHIP_LABELS[tag] ?? listingTagLabel(tag);
}

/** Full label for section info dialogs (soft hyphens stripped for readability). */
export function listingTagFullLabel(tag: ListingTag): string {
  return listingTagLabel(tag).replace(/\u00AD/g, "");
}

export function ListingTagChips({
  tags,
  unselectedTags,
  onToggle,
}: {
  tags: readonly ListingTag[];
  unselectedTags?: readonly ListingTag[];
  /** When set, chips are add/remove controls (preview / wizard). Public listings omit this. */
  onToggle?: (tag: ListingTag, currentlyActive: boolean) => void;
}) {
  return (
    <>
      {tags.length ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => {
            const label = listingTagLabel(t);
            const full = listingTagFullLabel(t);
            if (!onToggle) {
              return (
                <span key={t} className={TAG_CHIP_CLASS}>
                  {label}
                </span>
              );
            }
            return (
              <button
                key={t}
                type="button"
                onClick={() => onToggle(t, true)}
                className={`${TAG_CHIP_CLASS} transition hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
                aria-label={`Quitar ${full}`}
                title={`Quitar ${full}`}
              >
                <span className="min-w-0 text-left">{label}</span>
                <TagToggleGlyph action="remove" />
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm italic text-muted">Sin etiquetas seleccionadas.</p>
      )}
      {unselectedTags && unselectedTags.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted/50">
            {onToggle ? "Toca + para agregar" : "No incluidas"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unselectedTags.map((t) => {
              const label = listingTagLabel(t);
              const full = listingTagFullLabel(t);
              if (!onToggle) {
                return (
                  <span key={t} className={TAG_CHIP_UNSELECTED_CLASS}>
                    {label}
                  </span>
                );
              }
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onToggle(t, false)}
                  className={`${TAG_CHIP_UNSELECTED_CLASS} transition hover:border-primary/40 hover:text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
                  aria-label={`Agregar ${full}`}
                  title={`Agregar ${full}`}
                >
                  <TagToggleGlyph action="add" />
                  <span className="min-w-0 text-left">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ListingTagSection({
  heading,
  tags,
}: {
  heading: string;
  tags: readonly ListingTag[];
}) {
  if (!tags.length) return null;

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{heading}</p>
      <div className="mt-2">
        <ListingTagChips tags={tags} />
      </div>
    </div>
  );
}

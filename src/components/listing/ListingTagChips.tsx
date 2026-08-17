import { LISTING_TAG_CHIP_LABELS, LISTING_TAG_LABEL_OVERRIDES } from "@/lib/listingTags";
import { TAG_LABELS } from "@/lib/searchFilters";
import type { ListingTag } from "@/types/listing";

const TAG_CHIP_CLASS =
  "rounded-full bg-bg-light px-3 py-1 text-xs font-medium text-body ring-1 ring-border";

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
}: {
  tags: readonly ListingTag[];
  unselectedTags?: readonly ListingTag[];
}) {
  return (
    <>
      {tags.length ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <span key={t} className={TAG_CHIP_CLASS}>
              {listingTagLabel(t)}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm italic text-muted">Sin etiquetas seleccionadas.</p>
      )}
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

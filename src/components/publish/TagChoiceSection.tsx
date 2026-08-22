import { useEffect, useState } from "react";
import { Info, X } from "lucide-react";
import { listingTagChipLabel, listingTagFullLabel, TagToggleGlyph } from "@/components/listing/ListingTagChips";
import type { ListingTag } from "@/types/listing";

export const WIZARD_TAG_PILL_CLASS =
  "inline-flex min-h-11 min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-center text-[11px] font-medium leading-tight transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-0 sm:min-h-9";

export const WIZARD_TAG_PILL_ACTIVE =
  "bg-primary text-primary-fg shadow-sm ring-1 ring-primary/20";

export const WIZARD_TAG_PILL_INACTIVE =
  "border border-border bg-surface text-body shadow-sm hover:bg-surface-elevated";

export const WIZARD_TAG_PILL_INACTIVE_DASHED =
  "border border-dashed border-border bg-surface-elevated/90 text-muted opacity-75 hover:border-border hover:opacity-100 hover:bg-surface";

function TagSectionInfoButton({
  title,
  tags,
}: {
  title: string;
  tags: readonly ListingTag[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={`Ver descripciones completas de ${title}`}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-elevated hover:text-primary"
      >
        <Info className="size-3.5" aria-hidden="true" />
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[2200] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="max-h-[min(80dvh,28rem)] w-full max-w-sm overflow-y-auto rounded-xl border border-border bg-surface p-4 text-left shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-body">{title}</p>
                <p className="mt-0.5 text-xs text-muted">Nombre completo de cada opción</p>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setOpen(false)}
                className="-mr-1 -mt-1 rounded-full p-1.5 text-muted transition hover:bg-bg-light hover:text-primary"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <dl className="mt-3 space-y-2.5">
              {tags.map((tag) => {
                const chip = listingTagChipLabel(tag).replace(/\u00AD/g, "");
                const full = listingTagFullLabel(tag);
                return (
                  <div key={tag}>
                    <dt className="text-xs font-semibold text-body">{full}</dt>
                    {chip !== full ? (
                      <dd className="text-xs leading-relaxed text-muted">En el botón: «{chip}»</dd>
                    ) : null}
                  </div>
                );
              })}
            </dl>
          </div>
        </div>
      ) : null}
    </>
  );
}

type TagChoiceSectionProps = {
  title: string;
  tags: readonly ListingTag[];
  selected: readonly ListingTag[];
  onToggle: (tag: ListingTag, currentlyActive: boolean) => void;
  /** Show red asterisk after the title (e.g. Ideal para). */
  required?: boolean;
  /** Use dashed inactive style (preview editor). */
  dashedInactive?: boolean;
};

/**
 * Shared amenity / permission / room-tag pill grid for publish flows.
 * One-line chip labels + section header info dialog with full names.
 */
export function TagChoiceSection({
  title,
  tags,
  selected,
  onToggle,
  required = false,
  dashedInactive = false,
}: TagChoiceSectionProps) {
  const inactiveClass = dashedInactive ? WIZARD_TAG_PILL_INACTIVE_DASHED : WIZARD_TAG_PILL_INACTIVE;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-medium text-body">
          {title}
          {required ? <span className="text-error"> *</span> : null}
        </p>
        <TagSectionInfoButton title={title} tags={tags} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tags.map((tag) => {
          const active = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              role="checkbox"
              aria-checked={active}
              aria-label={`${active ? "Quitar" : "Agregar"} ${listingTagFullLabel(tag)}`}
              title={listingTagFullLabel(tag)}
              onClick={() => onToggle(tag, active)}
              className={`${WIZARD_TAG_PILL_CLASS} ${active ? WIZARD_TAG_PILL_ACTIVE : inactiveClass}`}
            >
              {active ? null : <TagToggleGlyph action="add" />}
              <span className="min-w-0 hyphens-manual">{listingTagChipLabel(tag)}</span>
              {active ? <TagToggleGlyph action="remove" onPrimary /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

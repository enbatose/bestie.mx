import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";

/** Matches server `ROOM_TITLE_MAX_LEN`. */
export const ROOM_TITLE_MAX = 120;

type Variant = "badge" | "heading";

type Props = {
  value: string;
  fallbackTitle: string;
  onCommit: (next: string) => void;
  variant?: Variant;
  /** Shown before the title in badge mode, e.g. "Editando · ". */
  prefix?: string;
  /** Prevents accordion toggle when editing from a card header. */
  stopClickPropagation?: boolean;
};

export function RoomTitlePencilEditor({
  value,
  fallbackTitle,
  onCommit,
  variant = "heading",
  prefix = "",
  stopClickPropagation = false,
}: Props) {
  const resolved = value.trim() || fallbackTitle;
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(resolved);
  const skipBlurCommit = useRef(false);

  useEffect(() => {
    if (!editing) setDraftTitle(resolved);
  }, [resolved, editing]);

  const stopBubble = (e: { stopPropagation(): void }) => {
    if (stopClickPropagation) e.stopPropagation();
  };

  const commitTitle = () => {
    if (skipBlurCommit.current) {
      skipBlurCommit.current = false;
      return;
    }
    const trimmed = draftTitle.trim();
    onCommit(trimmed || fallbackTitle);
    setEditing(false);
  };

  const cancelTitle = () => {
    skipBlurCommit.current = true;
    setDraftTitle(resolved);
    setEditing(false);
  };

  const startEdit = (e: { stopPropagation(): void }) => {
    skipBlurCommit.current = false;
    stopBubble(e);
    setDraftTitle(resolved);
    setEditing(true);
  };

  const pencilButton = (
    <button
      type="button"
      onMouseDown={(e) => {
        // Keep the input focused so blur doesn't race the click.
        if (editing) e.preventDefault();
      }}
      onClick={(e) => {
        if (editing) {
          stopBubble(e);
          commitTitle();
          return;
        }
        startEdit(e);
      }}
      className={
        variant === "badge"
          ? "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-primary transition hover:bg-primary/15"
          : "inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/5 text-primary transition hover:bg-primary/10"
      }
      aria-label={editing ? `Guardar título de ${fallbackTitle}` : `Editar título de ${fallbackTitle}`}
    >
      <Pencil className="size-3.5" aria-hidden />
    </button>
  );

  const titleInput = (
    <input
      autoFocus
      value={draftTitle}
      maxLength={ROOM_TITLE_MAX}
      onChange={(e) => setDraftTitle(e.target.value)}
      onBlur={commitTitle}
      onClick={stopBubble}
      onKeyDown={(e) => {
        stopBubble(e);
        if (e.key === "Enter") {
          e.preventDefault();
          commitTitle();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          cancelTitle();
        }
      }}
      placeholder={fallbackTitle}
      aria-label="Título de la recámara"
      className={
        variant === "badge"
          ? "min-h-7 min-w-[8rem] flex-1 rounded-md bg-surface/80 px-1.5 text-xs font-semibold tracking-wide text-primary outline-none ring-1 ring-primary/30"
          : "min-h-11 min-w-0 flex-1 rounded-lg border border-primary/60 bg-surface px-2 py-1 text-base font-bold text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:text-sm"
      }
    />
  );

  if (variant === "badge") {
    return (
      <div
        className="flex min-w-0 max-w-full items-center gap-0.5 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-1"
        onClick={stopBubble}
      >
        {prefix ? (
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-primary">
            {prefix}
          </span>
        ) : null}
        {editing ? (
          titleInput
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="min-w-0 truncate text-left text-xs font-semibold uppercase tracking-wide text-primary"
          >
            {resolved}
          </button>
        )}
        {pencilButton}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2" onClick={stopBubble}>
      {editing ? (
        titleInput
      ) : (
        <button
          type="button"
          onClick={startEdit}
          className="min-w-0 break-words text-left text-base font-bold text-primary"
        >
          {resolved}
        </button>
      )}
      {pencilButton}
    </div>
  );
}

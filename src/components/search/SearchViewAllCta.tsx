import { LayoutGrid, Undo2 } from "lucide-react";

export type SearchViewAllMode = "expand" | "restore";

type Props = {
  mode: SearchViewAllMode;
  /** Metro short name shown to the user, e.g. "ZMG". */
  metroName: string;
  /** Published cards in the whole metro area. */
  totalCount: number;
  /** Cards currently visible with the active criteria. */
  shownCount: number | null;
  onExpand: () => void;
  onRestore: () => void;
  /** `bar` = one line under the filters. `block` = full-width row atop a results list. */
  layout: "bar" | "block";
};

const money = new Intl.NumberFormat("es-MX");

export function SearchViewAllCta({
  mode,
  metroName,
  totalCount,
  shownCount,
  onExpand,
  onRestore,
  layout,
}: Props) {
  const expanding = mode === "expand";
  const total = money.format(totalCount);
  const label = expanding ? `Todas las Publicaciones (${total})` : "Volver a mi búsqueda";
  const ariaLabel = expanding
    ? `Ver todas las publicaciones en ${metroName}: ${total}`
    : "Volver a los resultados de mi búsqueda";
  const hint = expanding
    ? shownCount != null
      ? `Mostrando ${money.format(shownCount)} de ${total} publicaciones en ${metroName}.`
      : `${total} publicaciones en ${metroName}.`
    : `Estás viendo las ${total} publicaciones de ${metroName}.`;

  const Icon = expanding ? LayoutGrid : Undo2;
  const buttonTone = expanding
    ? "bg-primary text-primary-fg hover:brightness-110"
    : "border border-border bg-surface text-primary hover:bg-surface-elevated";

  const button = (
    <button
      type="button"
      onClick={expanding ? onExpand : onRestore}
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full font-semibold shadow-sm transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 ${buttonTone} ${
        layout === "bar"
          ? "order-1 min-h-10 w-full min-w-0 px-3 text-xs sm:order-2 sm:w-auto sm:shrink-0 sm:px-4 sm:text-sm"
          : "min-h-11 w-full min-w-0 px-3 py-2 text-sm leading-tight"
      }`}
    >
      <Icon className="size-4 shrink-0" aria-hidden strokeWidth={2.2} />
      {/* The results-list column is ~200px wide: wrap rather than clip the label. */}
      <span className={layout === "bar" ? "truncate" : "min-w-0 text-center"}>{label}</span>
    </button>
  );

  if (layout === "block") {
    return (
      <div className="min-w-0">
        {button}
        <p className="mt-1 min-w-0 break-words text-[0.7rem] leading-snug text-muted">{hint}</p>
      </div>
    );
  }

  // Mobile: the button owns the row and the hint sits under it. Desktop keeps
  // both on one line, hint first.
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <p className="order-2 min-w-0 break-words text-[0.7rem] leading-snug text-muted sm:order-1 sm:flex-1 sm:text-xs">
        {hint}
      </p>
      {button}
    </div>
  );
}

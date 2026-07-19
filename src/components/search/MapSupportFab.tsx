import { CircleHelp } from "lucide-react";

type Props = {
  onClick: () => void;
  /** Extra classes for layout context (e.g. pointer-events). */
  className?: string;
};

/**
 * Circular map support FAB — intentionally not the list-tab shape.
 * Forest ring + surface fill for contrast on map tiles.
 */
export function MapSupportFab({ onClick, className = "" }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ayuda y contacto"
      title="Ayuda y contacto"
      className={`pointer-events-auto inline-flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-surface text-primary shadow-[0_10px_24px_rgba(0,0,0,0.18)] ring-2 ring-secondary/45 transition hover:scale-[1.04] hover:bg-bg-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/70 ${className}`}
    >
      <CircleHelp className="size-5" aria-hidden="true" strokeWidth={2.25} />
    </button>
  );
}

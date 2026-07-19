type Props = {
  onClick: () => void;
  /** Extra classes for layout context (e.g. pointer-events). */
  className?: string;
};

/**
 * Circular map support FAB — intentionally not the list-tab shape.
 * Surface + forest border for contrast; plain "?" keeps the glyph simple.
 */
export function MapSupportFab({ onClick, className = "" }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ayuda y contacto"
      title="Ayuda y contacto"
      className={`pointer-events-auto inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-surface text-primary shadow-[0_8px_18px_rgba(0,0,0,0.16)] transition hover:scale-[1.04] hover:bg-bg-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50 ${className}`}
    >
      <span className="translate-y-px text-[1.15rem] font-bold leading-none" aria-hidden="true">
        ?
      </span>
    </button>
  );
}

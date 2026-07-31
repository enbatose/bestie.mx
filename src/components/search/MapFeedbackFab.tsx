import { Star } from "lucide-react";

type Props = {
  onClick: () => void;
  /** Extra classes for layout context (e.g. pointer-events). */
  className?: string;
  /** Brief attention pulse when search-triggered feedback opens. */
  flash?: boolean;
};

/**
 * Circular map feedback FAB — sits under the support "?" button.
 * Amber accent distinguishes it from Soporte.
 * Uses Lucide Star (not the ★ glyph) so the icon sits optically centered.
 */
export function MapFeedbackFab({ onClick, className = "", flash = false }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Enviar feedback"
      title="Enviar feedback"
      className={`pointer-events-auto inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-amber-500 bg-surface text-amber-600 shadow-[0_8px_18px_rgba(0,0,0,0.16)] transition hover:scale-[1.04] hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 dark:text-amber-300 dark:hover:bg-amber-950/40 ${
        flash ? "animate-[feedback-fab-flash_0.7s_ease-in-out_4]" : ""
      } ${className}`}
    >
      <Star className="size-[1.05rem] fill-current" strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

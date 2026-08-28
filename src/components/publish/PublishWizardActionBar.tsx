import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Extra layout classes on the row (e.g. `sm:justify-between`). */
  className?: string;
};

/**
 * In-flow wizard navigation / publish actions at the bottom of the step card.
 *
 * Keep opaque (`bg-surface`) and avoid `backdrop-blur` — semi-transparent blur layers
 * inside AppShell `<main>` can fail to paint until a repaint. Do not use `sticky` or
 * `fixed` here; buttons belong at the end of the step content (scroll to reach on long steps).
 *
 * Stay inside the step card's padding — no negative margins. A `-mx-*` full-bleed here
 * created 16px of horizontal scrollable overflow in the wizard's intermediate containers,
 * which let the browser scroll the card sideways when an input was focused (the whole step
 * appeared shifted left with its right edge clipped).
 */
export function PublishWizardActionBar({ children, className = "" }: Props) {
  return (
    <div
      className={`mt-8 flex flex-col-reverse gap-3 border-t border-border bg-surface py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center ${className}`}
    >
      {children}
    </div>
  );
}

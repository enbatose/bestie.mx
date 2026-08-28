import type { ReactNode } from "react";

type Props = {
  /** Match the wizard shell width (`max-w-2xl` or `max-w-3xl`). */
  maxWidthClass: "max-w-2xl" | "max-w-3xl";
  children: ReactNode;
  /** Extra layout classes on the inner row (e.g. `justify-between`). */
  className?: string;
};

/**
 * Fixed wizard navigation / publish actions.
 *
 * Use `position: fixed` (not sticky) for step footers: AppShell `<main>` scrolls with
 * page content, so sticky never pins and blur layers can fail to paint until a repaint.
 */
export function PublishWizardActionBar({ maxWidthClass, children, className = "" }: Props) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[1100] border-t border-border bg-surface shadow-[0_-4px_16px_rgba(15,23,42,0.08)]"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
    >
      <div
        className={`mx-auto flex flex-col-reverse gap-3 px-3 py-3 sm:flex-row sm:items-center sm:px-6 ${maxWidthClass} ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

/** Reserve space so the last fields are not hidden under the fixed bar. */
export const PUBLISH_WIZARD_FOOTER_PAD = "pb-28";

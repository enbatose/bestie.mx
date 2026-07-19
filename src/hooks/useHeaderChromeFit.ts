import { useLayoutEffect, useRef, useState } from "react";

/** Full lockup at h-9 (viewBox 251×74). */
const LOCKUP_WIDTH_PX = 124;
/** Mark-only at h-9. */
const MARK_WIDTH_PX = 36;
/** Extra room before restoring the wordmark (avoids lockup↔mark flicker). */
const LOCKUP_RESTORE_HYSTERESIS_PX = 16;
/** Leave a few px so logo and actions never touch. */
const SAFETY_PX = 8;
const MAX_ICON_GAP_PX = 8;
const MD_MIN_WIDTH_PX = 768;

type HeaderChromeFit = {
  rowRef: React.RefObject<HTMLDivElement | null>;
  actionsRef: React.RefObject<HTMLDivElement | null>;
  markOnly: boolean;
  iconGapPx: number;
};

/**
 * Measures the sticky header row and keeps icon gaps / logo mode from overlapping.
 * Prefers the full lockup; falls back to mark-only when the row is too narrow.
 */
export function useHeaderChromeFit(authReadyKey: string | undefined): HeaderChromeFit {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const markOnlyRef = useRef(false);
  const [markOnly, setMarkOnly] = useState(false);
  const [iconGapPx, setIconGapPx] = useState(0);

  useLayoutEffect(() => {
    const row = rowRef.current;
    const actions = actionsRef.current;
    if (!row || !actions) return;

    let frame = 0;

    const countVisibleActions = () => {
      let n = 0;
      actions.querySelectorAll<HTMLElement>("[data-header-action='true']").forEach((el) => {
        if (el.getBoundingClientRect().width > 0.5) n += 1;
      });
      return n;
    };

    const measureActionsWidthAtZeroGap = () => {
      actions.style.setProperty("--header-icon-gap", "0px");
      return actions.getBoundingClientRect().width;
    };

    const recompute = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (window.matchMedia(`(min-width: ${MD_MIN_WIDTH_PX}px)`).matches) {
          if (markOnlyRef.current) {
            markOnlyRef.current = false;
            setMarkOnly(false);
          }
          actions.style.removeProperty("--header-icon-gap");
          setIconGapPx(0);
          return;
        }

        const rowStyles = getComputedStyle(row);
        const rowGap = parseFloat(rowStyles.columnGap || rowStyles.gap) || 0;
        const rowW = row.clientWidth;
        const actionsW = measureActionsWidthAtZeroGap();
        const spaceForLogo = rowW - actionsW - rowGap - SAFETY_PX;

        let nextMarkOnly = markOnlyRef.current;
        if (markOnlyRef.current) {
          nextMarkOnly = spaceForLogo < LOCKUP_WIDTH_PX + LOCKUP_RESTORE_HYSTERESIS_PX;
        } else {
          nextMarkOnly = spaceForLogo < LOCKUP_WIDTH_PX;
        }

        const logoW = nextMarkOnly ? MARK_WIDTH_PX : LOCKUP_WIDTH_PX;
        const actionCount = countVisibleActions();
        const slots = Math.max(1, actionCount - 1);
        const leftover = Math.max(0, rowW - actionsW - rowGap - logoW - SAFETY_PX);
        const nextGap = Math.min(MAX_ICON_GAP_PX, Math.floor(leftover / slots));

        actions.style.setProperty("--header-icon-gap", `${nextGap}px`);

        if (nextMarkOnly !== markOnlyRef.current) {
          markOnlyRef.current = nextMarkOnly;
          setMarkOnly(nextMarkOnly);
        }
        setIconGapPx((prev) => (prev === nextGap ? prev : nextGap));
      });
    };

    const ro = new ResizeObserver(() => recompute());
    ro.observe(row);
    ro.observe(actions);
    window.addEventListener("resize", recompute);
    recompute();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [authReadyKey]);

  return { rowRef, actionsRef, markOnly, iconGapPx };
}

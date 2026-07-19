import { useLayoutEffect, useRef, useState } from "react";

/** Full lockup at h-9 (viewBox 251×74, scaled to height 36px). */
const LOCKUP_WIDTH_PX = 124;
/** Mark-only silhouettes at h-9. */
const MARK_WIDTH_PX = 36;
/** Hysteresis before switching back to full lockup (avoids flicker). */
const LOCKUP_RESTORE_HYSTERESIS_PX = 16;
/** Safety gap so logo and actions never touch. */
const SAFETY_PX = 8;
const MAX_ICON_GAP_PX = 8;
const MD_MIN_WIDTH_PX = 768;

export type HeaderChromeFit = {
  rowRef: React.RefObject<HTMLDivElement | null>;
  actionsRef: React.RefObject<HTMLDivElement | null>;
  markOnly: boolean;
  iconGapPx: number;
};

/**
 * Measures the sticky header's content width (excluding padding) and computes:
 * - whether to show the full wordmark lockup or mark-only logo
 * - how many px of gap to distribute between the icon buttons
 *
 * Gap is applied via React state → prop → inline style so it is never
 * dependent on a Tailwind arbitrary-value class with a CSS variable.
 */
export function useHeaderChromeFit(authReadyKey: string | undefined): HeaderChromeFit {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const markOnlyRef = useRef(false);
  const iconGapRef = useRef(0);
  const [markOnly, setMarkOnly] = useState(false);
  const [iconGapPx, setIconGapPx] = useState(0);

  useLayoutEffect(() => {
    const row = rowRef.current;
    const actions = actionsRef.current;
    if (!row || !actions) return;

    let frame = 0;

    const countVisibleMobileActions = (): number => {
      let n = 0;
      actions.querySelectorAll<HTMLElement>("[data-header-action]").forEach((el) => {
        if (getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0.5) {
          n += 1;
        }
      });
      return n;
    };

    const recompute = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (window.matchMedia(`(min-width: ${MD_MIN_WIDTH_PX}px)`).matches) {
          if (markOnlyRef.current) {
            markOnlyRef.current = false;
            setMarkOnly(false);
          }
          if (iconGapRef.current !== 0) {
            iconGapRef.current = 0;
            setIconGapPx(0);
          }
          return;
        }

        const rowStyles = getComputedStyle(row);
        // Use the flex CONTENT width (clientWidth minus horizontal padding).
        const paddingLeft = parseFloat(rowStyles.paddingLeft) || 0;
        const paddingRight = parseFloat(rowStyles.paddingRight) || 0;
        const rowGap = parseFloat(rowStyles.columnGap || rowStyles.gap) || 0;
        const rowW = row.clientWidth - paddingLeft - paddingRight;

        // Measure the actions div's current rendered width, then back out
        // the gaps already applied so we get the zero-gap baseline.
        const currentRenderedActionsW = actions.getBoundingClientRect().width;
        const actionCount = countVisibleMobileActions();
        const slots = Math.max(0, actionCount - 1);
        const zeroGapActionsW = Math.max(0, currentRenderedActionsW - iconGapRef.current * slots);

        // Available horizontal space left of the actions block.
        const spaceForLogo = rowW - zeroGapActionsW - rowGap - SAFETY_PX;

        let nextMarkOnly = markOnlyRef.current;
        if (markOnlyRef.current) {
          // Already in mark-only: stay unless there's clearly enough room for the lockup.
          nextMarkOnly = spaceForLogo < LOCKUP_WIDTH_PX + LOCKUP_RESTORE_HYSTERESIS_PX;
        } else {
          nextMarkOnly = spaceForLogo < LOCKUP_WIDTH_PX;
        }

        const logoW = nextMarkOnly ? MARK_WIDTH_PX : LOCKUP_WIDTH_PX;
        const leftover = Math.max(0, rowW - zeroGapActionsW - rowGap - logoW - SAFETY_PX);
        const nextGap = slots > 0 ? Math.min(MAX_ICON_GAP_PX, Math.floor(leftover / slots)) : 0;

        if (nextMarkOnly !== markOnlyRef.current) {
          markOnlyRef.current = nextMarkOnly;
          setMarkOnly(nextMarkOnly);
        }
        if (nextGap !== iconGapRef.current) {
          iconGapRef.current = nextGap;
          setIconGapPx(nextGap);
        }
      });
    };

    const ro = new ResizeObserver(recompute);
    ro.observe(row);
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

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

/** Worst-case logged-in mobile actions (search + publicar + msg + bell + avatar). */
const LOGGED_IN_ACTIONS_ZERO_GAP_PX = 36 + 36 + 36 + 36 + 44;

function isNarrowViewport(): boolean {
  if (typeof window === "undefined") return true;
  return !window.matchMedia(`(min-width: ${MD_MIN_WIDTH_PX}px)`).matches;
}

export type HeaderChromeFit = {
  rowRef: React.RefObject<HTMLDivElement | null>;
  actionsRef: React.RefObject<HTMLDivElement | null>;
  markOnly: boolean;
  iconGapPx: number;
};

/**
 * Measures the sticky header and decides mark-only vs full lockup + icon gaps.
 *
 * Starts mark-only on narrow viewports and only expands to the wordmark after
 * auth has settled AND measurement proves the lockup fits — avoids the
 * full→compact flash on refresh while `me` is still loading.
 */
export function useHeaderChromeFit(
  authReadyKey: string | undefined,
  /** False while `me === undefined` (authMe in flight). */
  authSettled: boolean,
): HeaderChromeFit {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const markOnlyRef = useRef(isNarrowViewport());
  const iconGapRef = useRef(0);
  const [markOnly, setMarkOnly] = useState(isNarrowViewport);
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

    const apply = (nextMarkOnly: boolean, nextGap: number) => {
      if (nextMarkOnly !== markOnlyRef.current) {
        markOnlyRef.current = nextMarkOnly;
        setMarkOnly(nextMarkOnly);
      }
      if (nextGap !== iconGapRef.current) {
        iconGapRef.current = nextGap;
        setIconGapPx(nextGap);
      }
    };

    const recompute = () => {
      if (window.matchMedia(`(min-width: ${MD_MIN_WIDTH_PX}px)`).matches) {
        apply(false, 0);
        return;
      }

      // Until auth settles, keep the compact mark — guest chrome is narrower than
      // logged-in chrome, so expanding now would flash the full wordmark then collapse.
      if (!authSettled) {
        apply(true, 0);
        return;
      }

      const rowStyles = getComputedStyle(row);
      const paddingLeft = parseFloat(rowStyles.paddingLeft) || 0;
      const paddingRight = parseFloat(rowStyles.paddingRight) || 0;
      const rowGap = parseFloat(rowStyles.columnGap || rowStyles.gap) || 0;
      const rowW = row.clientWidth - paddingLeft - paddingRight;

      const currentRenderedActionsW = actions.getBoundingClientRect().width;
      const actionCount = countVisibleMobileActions();
      const slots = Math.max(0, actionCount - 1);
      const measuredZeroGap = Math.max(0, currentRenderedActionsW - iconGapRef.current * slots);
      // Prefer the larger of measured vs typical logged-in width when logged in,
      // so we don't trust a half-painted actions row.
      const zeroGapActionsW = authReadyKey
        ? Math.max(measuredZeroGap, LOGGED_IN_ACTIONS_ZERO_GAP_PX)
        : measuredZeroGap;

      const spaceForLogo = rowW - zeroGapActionsW - rowGap - SAFETY_PX;

      let nextMarkOnly = markOnlyRef.current;
      if (markOnlyRef.current) {
        nextMarkOnly = spaceForLogo < LOCKUP_WIDTH_PX + LOCKUP_RESTORE_HYSTERESIS_PX;
      } else {
        nextMarkOnly = spaceForLogo < LOCKUP_WIDTH_PX;
      }

      const logoW = nextMarkOnly ? MARK_WIDTH_PX : LOCKUP_WIDTH_PX;
      const leftover = Math.max(0, rowW - zeroGapActionsW - rowGap - logoW - SAFETY_PX);
      const nextGap = slots > 0 ? Math.min(MAX_ICON_GAP_PX, Math.floor(leftover / slots)) : 0;

      apply(nextMarkOnly, nextGap);
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(recompute);
    };

    // Sync first pass before paint of this commit (useLayoutEffect).
    recompute();

    const ro = new ResizeObserver(schedule);
    ro.observe(row);
    window.addEventListener("resize", schedule);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [authReadyKey, authSettled]);

  return { rowRef, actionsRef, markOnly, iconGapPx };
}

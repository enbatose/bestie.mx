import { isProductionAnalyticsHost } from "@/lib/posthog";

/**
 * Meta Pixel (Ads measurement). Prod hosts only — same gate as PostHog.
 * Pixel ID is build-time via VITE_META_PIXEL_ID.
 */

const pixelId = import.meta.env.VITE_META_PIXEL_ID?.trim() || "";

type FbqFn = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
  push?: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    fbq?: FbqFn;
    _fbq?: FbqFn;
  }
}

let initialized = false;

/** True when Pixel may fire (token + www / bestie.mx). */
export function isMetaPixelConfigured(): boolean {
  return Boolean(pixelId) && isProductionAnalyticsHost();
}

/**
 * Load fbevents.js once and init the Pixel. Safe to call repeatedly.
 * Does not fire PageView — SPA navigations call {@link trackMetaPageview}.
 */
export function initMetaPixel(): void {
  if (!isMetaPixelConfigured() || typeof window === "undefined") return;
  if (initialized) return;

  const w = window;
  if (!w.fbq) {
    const n: FbqFn = function (...args: unknown[]) {
      if (n.callMethod) {
        n.callMethod(...args);
      } else {
        (n.queue = n.queue || []).push(args);
      }
    };
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    w.fbq = n;
    if (!w._fbq) w._fbq = n;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    const first = document.getElementsByTagName("script")[0];
    first?.parentNode?.insertBefore(script, first);
  }

  w.fbq?.("init", pixelId);
  initialized = true;
}

/** SPA PageView — call on every react-router location change. */
export function trackMetaPageview(): void {
  if (!isMetaPixelConfigured()) return;
  try {
    initMetaPixel();
    window.fbq?.("track", "PageView");
  } catch {
    /* never break UX for ads measurement */
  }
}

/** Standard or custom Meta Pixel event. */
export function trackMetaEvent(
  eventName: string,
  params?: Record<string, unknown>,
): void {
  if (!isMetaPixelConfigured()) return;
  try {
    initMetaPixel();
    if (params && Object.keys(params).length > 0) {
      window.fbq?.("track", eventName, params);
    } else {
      window.fbq?.("track", eventName);
    }
  } catch {
    /* ignore */
  }
}

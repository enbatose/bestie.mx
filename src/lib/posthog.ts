import posthog from "posthog-js";
import { hasAnalyticsConsent } from "@/lib/cookieConsent";

/** Ingestion host (US Cloud). Only used when analytics is enabled. */
const DEFAULT_HOST = "https://us.i.posthog.com";

/**
 * Hostnames allowed to run PostHog. Everything else (dev.bestie.mx, localhost,
 * Railway previews) stays silent even if a project token was baked into the build.
 *
 * Exported for unit + deploy smoke tests — keep this list as the single source of truth.
 */
export const PRODUCTION_ANALYTICS_HOSTNAMES = ["bestie.mx", "www.bestie.mx"] as const;

const PRODUCTION_ANALYTICS_HOSTS = new Set<string>(PRODUCTION_ANALYTICS_HOSTNAMES);

/**
 * Build-time token. Prefer leaving this unset on Dev / local.
 * Runtime host allowlist is the hard stop if it leaks into a non-prod build.
 */
const token = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN?.trim() || "";
const host = import.meta.env.VITE_POSTHOG_HOST?.trim() || DEFAULT_HOST;

/** Pure hostname check (no `window`) — used by tests and runtime gates. */
export function isAnalyticsAllowedHostname(hostname: string): boolean {
  return PRODUCTION_ANALYTICS_HOSTS.has(hostname.trim().toLowerCase());
}

/**
 * Pure enablement check: token + production hostname.
 * Dev / local / previews always return false even when a token is present.
 */
export function shouldEnablePostHog(input: {
  projectToken: string;
  hostname: string;
}): boolean {
  return Boolean(input.projectToken.trim()) && isAnalyticsAllowedHostname(input.hostname);
}

/** True only on real production hosts (bestie.mx / www). */
export function isProductionAnalyticsHost(): boolean {
  if (typeof window === "undefined") return false;
  return isAnalyticsAllowedHostname(window.location.hostname);
}

/**
 * True when PostHog *may* capture (token + prod host). Consent is checked separately
 * in {@link initPostHog} / {@link isPostHogActive}.
 */
export function isPostHogConfigured(): boolean {
  return shouldEnablePostHog({
    projectToken: token,
    hostname: typeof window !== "undefined" ? window.location.hostname : "",
  });
}

let initialized = false;

/** True when PostHog is initialized and the user opted into analytics cookies. */
export function isPostHogActive(): boolean {
  return isPostHogConfigured() && initialized && hasAnalyticsConsent();
}

/**
 * Initialize PostHog once after analytics cookie consent. Safe to call repeatedly.
 * No-ops outside production hosts or without consent.
 */
export function initPostHog(): typeof posthog | null {
  if (!isPostHogConfigured() || !hasAnalyticsConsent()) return null;
  if (initialized) {
    try {
      posthog.opt_in_capturing?.();
    } catch {
      /* ignore */
    }
    return posthog;
  }

  posthog.init(token, {
    api_host: host,
    defaults: "2026-05-30",
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: true,
    // Heatmaps, dead clicks, exception autocapture, and web vitals follow
    // project remote config (heatmaps_opt_in, capture_dead_clicks,
    // autocapture_exceptions_opt_in, autocapture_web_vitals_opt_in).
    // Session replay is gated by project setting "Record user sessions".
    // Inputs are masked; add class `ph-no-capture` on DOM that must never
    // appear in replays (chat bodies, attachments, notification copy).
    session_recording: {
      maskAllInputs: true,
      maskInputOptions: { password: true },
    },
  });

  initialized = true;
  return posthog;
}

/** Stop capturing when the user withdraws analytics consent. */
export function optOutPostHogCapturing(): void {
  if (!initialized) return;
  try {
    posthog.opt_out_capturing?.();
    posthog.stopSessionRecording?.();
  } catch {
    /* ignore */
  }
}

export { posthog };

/** Current PostHog session id when analytics is active; otherwise null. */
export function getPosthogSessionId(): string | null {
  if (!isPostHogActive()) return null;
  try {
    const id = posthog.get_session_id?.();
    return typeof id === "string" && id.trim() ? id.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Force-start session replay on publish / assisted-claim surfaces.
 * Complements project URL+event trigger groups so AI, Sin IA (manual), and
 * assisted-claim paths are recorded even when global sampling is below 100%.
 */
export function ensurePublishSessionRecording(): void {
  if (!isPostHogActive()) return;
  try {
    posthog.startSessionRecording?.(true);
  } catch {
    /* never break UX for analytics */
  }
}

/**
 * Session id to persist on the property for admin "Ver session replay".
 * Starts recording first so AI / Sin IA / assisted publish all get a linkable id on Prod.
 * Always null on Dev / local (PostHog stays off) or without analytics consent.
 */
export function capturePublishPosthogSessionId(): string | null {
  ensurePublishSessionRecording();
  return getPosthogSessionId();
}

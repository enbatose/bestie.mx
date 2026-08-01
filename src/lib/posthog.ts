import posthog from "posthog-js";

/** Ingestion host (US Cloud). Only used when a project token is set. */
const DEFAULT_HOST = "https://us.i.posthog.com";

/**
 * PostHog is production-only. Dev / local builds leave
 * `VITE_POSTHOG_PROJECT_TOKEN` unset so no events are sent.
 */
const token = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN?.trim() || "";
const host = import.meta.env.VITE_POSTHOG_HOST?.trim() || DEFAULT_HOST;

/** True when a project token is configured for this build. */
export function isPostHogConfigured(): boolean {
  return Boolean(token);
}

let initialized = false;

/**
 * Initialize PostHog once. Safe to call repeatedly.
 * Autocapture stays on; SPA pageviews are captured manually via PostHogPageViews.
 */
export function initPostHog(): typeof posthog | null {
  if (!token) return null;
  if (initialized) return posthog;

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

export { posthog };

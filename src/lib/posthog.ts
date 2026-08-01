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
    // Session replay is gated by project setting "Record user sessions".
    // Inputs are masked in replays; add class `ph-no-capture` on any DOM that
    // must never appear (e.g. chat message bodies, phone numbers).
    session_recording: {
      maskAllInputs: true,
      maskInputOptions: { password: true },
    },
  });

  initialized = true;
  return posthog;
}

export { posthog };

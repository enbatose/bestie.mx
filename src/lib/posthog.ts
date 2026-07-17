import posthog from "posthog-js";

/** Public project token (browser-safe). Prefer env so environments can override. */
const DEFAULT_PROJECT_TOKEN = "phc_ogdsRzYPo7kFh9coJboaRrbaWgeYpCFe984sh6c4fN67";
const DEFAULT_HOST = "https://us.i.posthog.com";

const token =
  import.meta.env.VITE_POSTHOG_PROJECT_TOKEN?.trim() || DEFAULT_PROJECT_TOKEN;
const host = import.meta.env.VITE_POSTHOG_HOST?.trim() || DEFAULT_HOST;

/** True when a project token is configured (local or production). */
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
  });

  initialized = true;
  return posthog;
}

export { posthog };

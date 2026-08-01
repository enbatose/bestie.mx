import posthog from "posthog-js";

/** Ingestion host (US Cloud). Only used when analytics is enabled. */
const DEFAULT_HOST = "https://us.i.posthog.com";

/**
 * Hostnames allowed to run PostHog. Everything else (dev.bestie.mx, localhost,
 * Railway previews) stays silent even if a project token was baked into the build.
 */
const PRODUCTION_ANALYTICS_HOSTS = new Set(["bestie.mx", "www.bestie.mx"]);

/**
 * Build-time token. Prefer leaving this unset on Dev / local.
 * Runtime host allowlist is the hard stop if it leaks into a non-prod build.
 */
const token = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN?.trim() || "";
const host = import.meta.env.VITE_POSTHOG_HOST?.trim() || DEFAULT_HOST;

/** True only on real production hosts (bestie.mx / www). */
export function isProductionAnalyticsHost(): boolean {
  if (typeof window === "undefined") return false;
  return PRODUCTION_ANALYTICS_HOSTS.has(window.location.hostname.toLowerCase());
}

/**
 * True when PostHog may capture. Requires both a build token and a production host.
 * Dev / local never pass this, regardless of env vars.
 */
export function isPostHogConfigured(): boolean {
  return Boolean(token) && isProductionAnalyticsHost();
}

let initialized = false;

/**
 * Initialize PostHog once. Safe to call repeatedly.
 * No-ops outside production hosts so events, replays, heatmaps, and flags stay off.
 */
export function initPostHog(): typeof posthog | null {
  if (!isPostHogConfigured()) return null;
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

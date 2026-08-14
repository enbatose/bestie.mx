/** Soft limits / pricing used by admin cost-driver metrics. Reconcile with vendor dashboards. */

/** Resend free transactional quotas (sent + received count toward both). */
export const RESEND_FREE_DAILY_LIMIT = 100;
export const RESEND_FREE_MONTHLY_LIMIT = 3000;
export const RESEND_USAGE_SOURCE = "https://resend.com/docs/knowledge-base/account-quotas-and-limits";
export const RESEND_USAGE_LAST_VERIFIED = "2026-08-02";

/**
 * Gemini 3.1 Flash-Lite paid-tier rates (USD per 1M tokens) used for rough estimates.
 * @see https://ai.google.dev/gemini-api/docs/pricing
 */
export const GEMINI_FLASH_LITE_INPUT_USD_PER_1M = 0.25;
export const GEMINI_FLASH_LITE_OUTPUT_USD_PER_1M = 1.5;
export const GEMINI_PRICING_SOURCE = "https://ai.google.dev/gemini-api/docs/pricing";
export const GEMINI_PRICING_LAST_VERIFIED = "2026-08-02";

export function estimateGeminiUsd(promptTokens: number, outputTokens: number): number {
  const input = Math.max(0, promptTokens) / 1_000_000 * GEMINI_FLASH_LITE_INPUT_USD_PER_1M;
  const output = Math.max(0, outputTokens) / 1_000_000 * GEMINI_FLASH_LITE_OUTPUT_USD_PER_1M;
  return input + output;
}

/** PostHog Cloud free tier (resets monthly with billing period). */
export const POSTHOG_PROJECT_ID = "517444";
export const POSTHOG_QUERY_HOST = "https://us.posthog.com";
export const POSTHOG_RECORDINGS_FREE_MONTHLY = 5000;
export const POSTHOG_EVENTS_FREE_MONTHLY = 1_000_000;
/** First paid tier after free allotment (web recordings). */
export const POSTHOG_RECORDINGS_USD_EACH = 0.005;
/** First paid tier after free allotment (product analytics events). */
export const POSTHOG_EVENTS_USD_PER_EVENT = 0.00005;
export const POSTHOG_PRICING_SOURCE = "https://posthog.com/pricing";
export const POSTHOG_BILLING_URL = "https://us.posthog.com/organization/billing";
export const POSTHOG_PRICING_LAST_VERIFIED = "2026-08-02";

export function posthogReplayUrl(sessionId: string | null | undefined): string | null {
  const id = typeof sessionId === "string" ? sessionId.trim() : "";
  if (!id) return null;
  return `https://us.posthog.com/project/${POSTHOG_PROJECT_ID}/replay/${encodeURIComponent(id)}`;
}

export function estimatePostHogRecordingsOverageUsd(recordings: number): number {
  return Math.max(0, recordings - POSTHOG_RECORDINGS_FREE_MONTHLY) * POSTHOG_RECORDINGS_USD_EACH;
}

export function estimatePostHogEventsOverageUsd(events: number): number {
  return Math.max(0, events - POSTHOG_EVENTS_FREE_MONTHLY) * POSTHOG_EVENTS_USD_PER_EVENT;
}

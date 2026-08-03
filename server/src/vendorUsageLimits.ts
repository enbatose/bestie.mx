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

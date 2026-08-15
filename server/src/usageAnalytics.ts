import type { DatabaseSync } from "node:sqlite";
import { fetchPostHogUsage } from "./posthogUsage.js";
import { incrementAnalyticsDaily, parseMonthParam } from "./streetViewAnalytics.js";
import {
  estimateGeminiUsd,
  GEMINI_FLASH_LITE_INPUT_USD_PER_1M,
  GEMINI_FLASH_LITE_OUTPUT_USD_PER_1M,
  GEMINI_PRICING_LAST_VERIFIED,
  GEMINI_PRICING_SOURCE,
  RESEND_FREE_DAILY_LIMIT,
  RESEND_FREE_MONTHLY_LIMIT,
  RESEND_USAGE_LAST_VERIFIED,
  RESEND_USAGE_SOURCE,
} from "./vendorUsageLimits.js";

export const EMAIL_SENT_METRIC = "email_sent";
export const EMAIL_RECEIVED_METRIC = "email_received";
export const SHARE_AI_METRIC = "share_ai_generate";
export const GEMINI_PROMPT_TOKENS_METRIC = "gemini_prompt_tokens";
export const GEMINI_OUTPUT_TOKENS_METRIC = "gemini_output_tokens";
export const WHATSAPP_OTP_METRIC = "whatsapp_otp_send";
export const ASSISTED_DRAFT_METRIC = "assisted_draft_generate";
export const ASSISTED_DRAFT_PROMPT_TOKENS_METRIC = "assisted_draft_prompt_tokens";
export const ASSISTED_DRAFT_OUTPUT_TOKENS_METRIC = "assisted_draft_output_tokens";

let usageDb: DatabaseSync | null = null;

/** Bind the live SQLite handle so mailer / webhook paths can record without threading `db`. */
export function bindUsageAnalyticsDb(db: DatabaseSync): void {
  usageDb = db;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function categoryFromTags(tags: { name: string; value: string }[] | undefined): string {
  const hit = tags?.find((t) => t.name === "category");
  const raw = hit?.value?.trim() || "uncategorized";
  return raw.slice(0, 64);
}

export function recordEmailSent(opts?: {
  tags?: { name: string; value: string }[];
  channel?: "resend" | "smtp" | "unknown";
}): void {
  if (!usageDb) return;
  const category = categoryFromTags(opts?.tags);
  const channel = opts?.channel ?? "unknown";
  const day = todayUtc();
  incrementAnalyticsDaily(usageDb, day, EMAIL_SENT_METRIC, category);
  incrementAnalyticsDaily(usageDb, day, EMAIL_SENT_METRIC, `channel:${channel}`);
}

export function recordEmailReceived(dimension = "inbound"): void {
  if (!usageDb) return;
  incrementAnalyticsDaily(usageDb, todayUtc(), EMAIL_RECEIVED_METRIC, dimension.slice(0, 64));
}

export function recordShareAiGenerate(
  source: "gemini" | "template" | "stored",
  scope: "property" | "room" | "unknown" = "unknown",
): void {
  if (!usageDb) return;
  const day = todayUtc();
  incrementAnalyticsDaily(usageDb, day, SHARE_AI_METRIC, source);
  incrementAnalyticsDaily(usageDb, day, SHARE_AI_METRIC, `scope:${scope}`);
}

export function recordGeminiTokens(promptTokens: number, outputTokens: number, model: string): void {
  if (!usageDb) return;
  const day = todayUtc();
  const dim = model.slice(0, 64) || "unknown";
  if (promptTokens > 0) {
    incrementAnalyticsDaily(usageDb, day, GEMINI_PROMPT_TOKENS_METRIC, dim, Math.floor(promptTokens));
  }
  if (outputTokens > 0) {
    incrementAnalyticsDaily(usageDb, day, GEMINI_OUTPUT_TOKENS_METRIC, dim, Math.floor(outputTokens));
  }
}

export function recordWhatsAppOtpSend(result: "ok" | "fail" | "skipped"): void {
  if (!usageDb) return;
  incrementAnalyticsDaily(usageDb, todayUtc(), WHATSAPP_OTP_METRIC, result);
}

export function recordAssistedDraftGenerate(
  promptTokens: number,
  outputTokens: number,
  model: string,
): void {
  if (!usageDb) return;
  const day = todayUtc();
  const dim = model.slice(0, 64) || "unknown";
  incrementAnalyticsDaily(usageDb, day, ASSISTED_DRAFT_METRIC, dim);
  if (promptTokens > 0) {
    incrementAnalyticsDaily(usageDb, day, ASSISTED_DRAFT_PROMPT_TOKENS_METRIC, dim, Math.floor(promptTokens));
  }
  if (outputTokens > 0) {
    incrementAnalyticsDaily(usageDb, day, ASSISTED_DRAFT_OUTPUT_TOKENS_METRIC, dim, Math.floor(outputTokens));
  }
}

function sumMetricByDimension(
  db: DatabaseSync,
  metric: string,
  monthStart: string,
  monthEnd: string,
): Record<string, number> {
  const rows = db
    .prepare(
      `SELECT dimension, SUM(value) AS total FROM analytics_daily
       WHERE metric = ? AND day >= ? AND day <= ?
       GROUP BY dimension`,
    )
    .all(metric, monthStart, monthEnd) as { dimension: string; total: number }[];
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[row.dimension || "unknown"] = row.total;
  }
  return out;
}

function sumMetricTotal(db: DatabaseSync, metric: string, monthStart: string, monthEnd: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(value), 0) AS total FROM analytics_daily
       WHERE metric = ? AND day >= ? AND day <= ?`,
    )
    .get(metric, monthStart, monthEnd) as { total: number };
  return row.total;
}

function sumMetricDay(db: DatabaseSync, metric: string, day: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(value), 0) AS total FROM analytics_daily
       WHERE metric = ? AND day = ? AND dimension NOT LIKE 'channel:%' AND dimension NOT LIKE 'scope:%'`,
    )
    .get(metric, day) as { total: number };
  return row.total;
}

function dailySeriesForMetric(
  db: DatabaseSync,
  metric: string,
  monthStart: string,
  monthEnd: string,
): { day: string; value: number }[] {
  return db
    .prepare(
      `SELECT day, SUM(value) AS value FROM analytics_daily
       WHERE metric = ? AND day >= ? AND day <= ?
       GROUP BY day ORDER BY day`,
    )
    .all(metric, monthStart, monthEnd) as { day: string; value: number }[];
}

function categoryBreakdown(byDimension: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(byDimension)) {
    if (k.startsWith("channel:") || k.startsWith("scope:")) continue;
    out[k] = v;
  }
  return out;
}

function channelBreakdown(byDimension: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(byDimension)) {
    if (!k.startsWith("channel:")) continue;
    out[k.slice("channel:".length)] = v;
  }
  return out;
}

function sourceBreakdown(byDimension: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(byDimension)) {
    if (k.startsWith("scope:")) continue;
    out[k] = v;
  }
  return out;
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function uploadStorageSnapshot(db: DatabaseSync): {
  blobCount: number;
  totalBytes: number;
  totalBytesLabel: string;
} {
  try {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS c, COALESCE(SUM(length(bytes)), 0) AS bytes FROM upload_blobs`,
      )
      .get() as { c: number; bytes: number };
    return {
      blobCount: row.c,
      totalBytes: row.bytes,
      totalBytesLabel: formatBytes(row.bytes),
    };
  } catch {
    return { blobCount: 0, totalBytes: 0, totalBytesLabel: "0 B" };
  }
}

function whatsappOtpFromChallenges(
  db: DatabaseSync,
  monthStart: string,
  monthEnd: string,
): number {
  try {
    const startMs = Date.parse(`${monthStart}T00:00:00.000Z`);
    const endMs = Date.parse(`${monthEnd}T23:59:59.999Z`);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
    const row = db
      .prepare(
        `SELECT COUNT(*) AS c FROM whatsapp_otp_challenges
         WHERE created_at >= ? AND created_at <= ?`,
      )
      .get(startMs, endMs) as { c: number };
    return row.c;
  } catch {
    return 0;
  }
}

export async function buildUsageAnalyticsResponse(db: DatabaseSync, monthParam: unknown) {
  const parsed = parseMonthParam(monthParam);
  if (!parsed) return null;
  const { month, monthStart, monthEnd } = parsed;
  const today = todayUtc();

  const emailSentByDim = sumMetricByDimension(db, EMAIL_SENT_METRIC, monthStart, monthEnd);
  const emailReceivedByDim = sumMetricByDimension(db, EMAIL_RECEIVED_METRIC, monthStart, monthEnd);
  const emailSentCategories = categoryBreakdown(emailSentByDim);
  const emailSentChannels = channelBreakdown(emailSentByDim);
  // Prefer category dims for totals (avoid double-counting channel:* rows).
  const emailSentTotal = Object.values(emailSentCategories).reduce((a, b) => a + b, 0);
  const emailReceivedTotal = sumMetricTotal(db, EMAIL_RECEIVED_METRIC, monthStart, monthEnd);
  const emailQuotaUnits = emailSentTotal + emailReceivedTotal;
  const emailSentToday = sumMetricDay(db, EMAIL_SENT_METRIC, today);
  const emailReceivedToday = sumMetricDay(db, EMAIL_RECEIVED_METRIC, today);
  const emailQuotaToday = emailSentToday + emailReceivedToday;

  const shareAiByDim = sumMetricByDimension(db, SHARE_AI_METRIC, monthStart, monthEnd);
  const shareAiBySource = sourceBreakdown(shareAiByDim);
  const geminiCalls = shareAiBySource.gemini ?? 0;
  const templateFallback = shareAiBySource.template ?? 0;
  const storedHits = shareAiBySource.stored ?? 0;

  const promptTokens = sumMetricTotal(db, GEMINI_PROMPT_TOKENS_METRIC, monthStart, monthEnd);
  const outputTokens = sumMetricTotal(db, GEMINI_OUTPUT_TOKENS_METRIC, monthStart, monthEnd);
  const promptByModel = sumMetricByDimension(db, GEMINI_PROMPT_TOKENS_METRIC, monthStart, monthEnd);
  const outputByModel = sumMetricByDimension(db, GEMINI_OUTPUT_TOKENS_METRIC, monthStart, monthEnd);

  const whatsappByResult = sumMetricByDimension(db, WHATSAPP_OTP_METRIC, monthStart, monthEnd);
  const whatsappTracked = Object.values(whatsappByResult).reduce((a, b) => a + b, 0);
  const whatsappChallenges = whatsappOtpFromChallenges(db, monthStart, monthEnd);

  // Assisted-draft (AI post generation) metrics
  const draftCallsTotal = sumMetricTotal(db, ASSISTED_DRAFT_METRIC, monthStart, monthEnd);
  const draftPromptTokens = sumMetricTotal(db, ASSISTED_DRAFT_PROMPT_TOKENS_METRIC, monthStart, monthEnd);
  const draftOutputTokens = sumMetricTotal(db, ASSISTED_DRAFT_OUTPUT_TOKENS_METRIC, monthStart, monthEnd);
  const draftEstimatedUsd = estimateGeminiUsd(draftPromptTokens, draftOutputTokens);
  const draftAvgUsdPerCall = draftCallsTotal > 0 ? draftEstimatedUsd / draftCallsTotal : 0;
  const draftDailyCalls = dailySeriesForMetric(db, ASSISTED_DRAFT_METRIC, monthStart, monthEnd);
  const draftByModel = sumMetricByDimension(db, ASSISTED_DRAFT_METRIC, monthStart, monthEnd);

  const posthog = await fetchPostHogUsage(month, monthStart, monthEnd);

  return {
    month,
    monthStart,
    monthEnd,
    resend: {
      sent: emailSentTotal,
      received: emailReceivedTotal,
      quotaUnits: emailQuotaUnits,
      dailyLimit: RESEND_FREE_DAILY_LIMIT,
      monthlyLimit: RESEND_FREE_MONTHLY_LIMIT,
      today: {
        sent: emailSentToday,
        received: emailReceivedToday,
        quotaUnits: emailQuotaToday,
      },
      byCategory: emailSentCategories,
      byChannel: emailSentChannels,
      receivedByKind: emailReceivedByDim,
      pricing: {
        sourceUrl: RESEND_USAGE_SOURCE,
        lastVerified: RESEND_USAGE_LAST_VERIFIED,
        note: "Internal counters from successful sends + inbound webhooks. Resend free tier counts sent and received toward 100/day and 3,000/month. Reconcile with https://resend.com/settings/usage.",
      },
    },
    gemini: {
      calls: geminiCalls,
      templateFallback,
      storedCacheHits: storedHits,
      promptTokens,
      outputTokens,
      estimatedUsd: estimateGeminiUsd(promptTokens, outputTokens),
      byModel: {
        promptTokens: promptByModel,
        outputTokens: outputByModel,
      },
      pricing: {
        sourceUrl: GEMINI_PRICING_SOURCE,
        lastVerified: GEMINI_PRICING_LAST_VERIFIED,
        inputUsdPer1M: GEMINI_FLASH_LITE_INPUT_USD_PER_1M,
        outputUsdPer1M: GEMINI_FLASH_LITE_OUTPUT_USD_PER_1M,
        note: "Share-copy generations only. Token totals from Gemini usageMetadata when present. Estimate uses Flash-Lite paid rates — reconcile with Google AI / GCP billing.",
      },
    },
    assistedDraft: {
      calls: draftCallsTotal,
      promptTokens: draftPromptTokens,
      outputTokens: draftOutputTokens,
      estimatedUsd: draftEstimatedUsd,
      avgUsdPerCall: draftAvgUsdPerCall,
      byModel: draftByModel,
      dailyCalls: draftDailyCalls,
      pricing: {
        sourceUrl: GEMINI_PRICING_SOURCE,
        lastVerified: GEMINI_PRICING_LAST_VERIFIED,
        inputUsdPer1M: GEMINI_FLASH_LITE_INPUT_USD_PER_1M,
        outputUsdPer1M: GEMINI_FLASH_LITE_OUTPUT_USD_PER_1M,
        note: "Llamadas al extract endpoint del flujo AI de creación de anuncios. Tokens desde usageMetadata. Estimado con tarifas Flash-Lite — reconciliar con Google AI / GCP billing.",
      },
    },
    posthog,
    whatsappOtp: {
      trackedSends: whatsappTracked,
      byResult: whatsappByResult,
      challengesCreated: whatsappChallenges,
      note: "Meta WhatsApp Cloud API OTP. challengesCreated includes historical rows; trackedSends starts when this counter shipped.",
    },
    storage: uploadStorageSnapshot(db),
    notes: [
      "Street View Maps cost is on the card above.",
      "PostHog numbers are live from the Query API when POSTHOG_PERSONAL_API_KEY is set on the API service.",
      "Railway volume + backup bucket size are ops-side; upload_blobs is the app photo store in SQLite.",
    ],
  };
}

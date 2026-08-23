import type { DatabaseSync } from "node:sqlite";
import { estimateGeminiUsd } from "./vendorUsageLimits.js";

/** Approx USD→MXN for admin cost display (override with BLOG_USD_MXN_RATE). */
export function blogUsdToMxnRate(): number {
  const raw = process.env.BLOG_USD_MXN_RATE?.trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 18.5;
}

export type BlogAiActivity =
  | "research"
  | "draft"
  | "rescore"
  | "enhance"
  | "chat"
  | "images"
  | "topics"
  | "similarity"
  | "social"
  | "other";

export function estimateBlogTokensUsd(
  promptTokens: number,
  outputTokens: number,
  opts?: { imageCount?: number; imageUsdEach?: number },
): { usd: number; mxn: number } {
  const textUsd = estimateGeminiUsd(promptTokens, outputTokens);
  const images = Math.max(0, opts?.imageCount ?? 0);
  const imageUsd = images * (opts?.imageUsdEach ?? 0.04);
  const usd = textUsd + imageUsd;
  return { usd, mxn: usd * blogUsdToMxnRate() };
}

export function recordBlogAiCost(
  db: DatabaseSync,
  opts: {
    id: string;
    articleId: string;
    activity: BlogAiActivity | string;
    model?: string | null;
    promptTokens?: number;
    outputTokens?: number;
    imageCount?: number;
    usdEstimate?: number;
    mxnEstimate?: number;
    meta?: unknown;
  },
): void {
  const prompt = Math.max(0, Math.floor(opts.promptTokens ?? 0));
  const output = Math.max(0, Math.floor(opts.outputTokens ?? 0));
  const images = Math.max(0, Math.floor(opts.imageCount ?? 0));
  const estimated =
    opts.usdEstimate != null && opts.mxnEstimate != null
      ? { usd: opts.usdEstimate, mxn: opts.mxnEstimate }
      : estimateBlogTokensUsd(prompt, output, { imageCount: images });
  db.prepare(
    `INSERT INTO blog_ai_costs (
      id, article_id, activity, model, prompt_tokens, output_tokens, image_count,
      usd_estimate, mxn_estimate, meta_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    opts.id,
    opts.articleId,
    String(opts.activity).slice(0, 64),
    opts.model ? String(opts.model).slice(0, 128) : null,
    prompt,
    output,
    images,
    estimated.usd,
    estimated.mxn,
    opts.meta != null ? JSON.stringify(opts.meta) : null,
    new Date().toISOString(),
  );
}

export function sumBlogAiCosts(db: DatabaseSync, articleId: string): {
  usd: number;
  mxn: number;
  rows: Array<{
    id: string;
    activity: string;
    model: string | null;
    promptTokens: number;
    outputTokens: number;
    imageCount: number;
    usdEstimate: number;
    mxnEstimate: number;
    createdAt: string;
  }>;
} {
  const rows = db
    .prepare(
      `SELECT id, activity, model, prompt_tokens, output_tokens, image_count,
              usd_estimate, mxn_estimate, created_at
       FROM blog_ai_costs WHERE article_id = ? ORDER BY created_at DESC`,
    )
    .all(articleId) as Array<{
    id: string;
    activity: string;
    model: string | null;
    prompt_tokens: number;
    output_tokens: number;
    image_count: number;
    usd_estimate: number;
    mxn_estimate: number;
    created_at: string;
  }>;

  let usd = 0;
  let mxn = 0;
  const mapped = rows.map((r) => {
    usd += Number(r.usd_estimate) || 0;
    mxn += Number(r.mxn_estimate) || 0;
    return {
      id: r.id,
      activity: r.activity,
      model: r.model,
      promptTokens: r.prompt_tokens,
      outputTokens: r.output_tokens,
      imageCount: r.image_count,
      usdEstimate: r.usd_estimate,
      mxnEstimate: r.mxn_estimate,
      createdAt: r.created_at,
    };
  });
  return { usd, mxn, rows: mapped };
}

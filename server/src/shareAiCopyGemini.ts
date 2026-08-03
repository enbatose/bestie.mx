import { SHARE_AI_TEXT_MAX } from "./shareAiCopyLimits.js";
import {
  SHARE_AI_SYSTEM_PROMPT,
  buildShareAiUserPrompt,
  buildTemplateShareCopy,
  finalizeShareCopy,
  type ShareAiListingFacts,
} from "./shareAiCopyPrompt.js";

export function geminiApiKey(): string | null {
  const k = process.env.GEMINI_API_KEY?.trim();
  return k || null;
}

export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite";
}

function thinkingBudget(): number {
  const raw = process.env.GEMINI_THINKING_BUDGET?.trim();
  if (raw === undefined || raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message?: string };
};

export type ShareAiGenerateResult = {
  text: string;
  source: "gemini" | "template";
  model?: string;
  promptTokens?: number;
  outputTokens?: number;
};

/**
 * Generate share copy via Gemini. Falls back to a deterministic template on any failure.
 * Never invents beyond structured facts (template/prompt constrained).
 */
export async function generateShareAiText(facts: ShareAiListingFacts): Promise<ShareAiGenerateResult> {
  const key = geminiApiKey();
  if (!key) {
    return { text: buildTemplateShareCopy(facts), source: "template" };
  }

  const model = geminiModel();
  // Prefer header auth over ?key= so the secret is less likely to land in proxy/APM URL logs.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: SHARE_AI_SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: buildShareAiUserPrompt(facts) }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 512,
    },
  };
  const budget = thinkingBudget();
  // Only attach when non-zero; some models reject unknown thinking fields.
  if (budget > 0) {
    (body.generationConfig as Record<string, unknown>).thinkingConfig = {
      thinkingBudget: budget,
    };
  }

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 20_000);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    clearTimeout(timer);
    const json = (await res.json()) as GeminiGenerateResponse;
    if (!res.ok) {
      console.warn("[share-ai] gemini http", res.status, json.error?.message ?? "");
      return { text: buildTemplateShareCopy(facts), source: "template" };
    }
    const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!raw.trim()) {
      return { text: buildTemplateShareCopy(facts), source: "template" };
    }
    const promptTokens = Number(json.usageMetadata?.promptTokenCount) || 0;
    const outputTokens = Number(json.usageMetadata?.candidatesTokenCount) || 0;
    return {
      text: finalizeShareCopy(raw, facts.permalink),
      source: "gemini",
      model,
      promptTokens,
      outputTokens,
    };
  } catch (err) {
    console.warn("[share-ai] gemini error", err instanceof Error ? err.message : err);
    return { text: buildTemplateShareCopy(facts), source: "template" };
  }
}

export function clampShareAiText(text: string, permalink: string): string {
  return finalizeShareCopy(text.slice(0, SHARE_AI_TEXT_MAX + 200), permalink);
}

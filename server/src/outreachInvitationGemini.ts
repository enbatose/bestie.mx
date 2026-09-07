import {
  OUTREACH_INVITATION_SYSTEM_PROMPT,
  buildOutreachInvitationUserPrompt,
  buildTemplateOutreachInvitation,
  finalizeOutreachInvitationCopy,
  type OutreachInvitationInput,
} from "./outreachInvitationPrompt.js";

function geminiApiKey(): string | null {
  const k = process.env.GEMINI_API_KEY?.trim();
  return k || null;
}

function geminiModel(): string {
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
  };
  error?: { message?: string };
};

export type OutreachInvitationGenerateResult = {
  text: string;
  source: "gemini" | "template";
  model?: string;
  promptTokens?: number;
  outputTokens?: number;
};

/**
 * Generate a paraphrased Facebook invitation comment.
 * Falls back to rotating templates if Gemini is unavailable or fails.
 */
export async function generateOutreachInvitation(
  input: OutreachInvitationInput = {},
): Promise<OutreachInvitationGenerateResult> {
  const key = geminiApiKey();
  if (!key) {
    return { text: buildTemplateOutreachInvitation(input), source: "template" };
  }

  const model = geminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: OUTREACH_INVITATION_SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: buildOutreachInvitationUserPrompt(input) }] }],
    generationConfig: {
      // Higher temperature so regenerate yields distinct paraphrases.
      temperature: 1.05,
      maxOutputTokens: 640,
    },
  };
  const budget = thinkingBudget();
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
      console.warn("[outreach-invitation] gemini http", res.status, json.error?.message ?? "");
      return { text: buildTemplateOutreachInvitation(input), source: "template" };
    }
    const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!raw.trim()) {
      return { text: buildTemplateOutreachInvitation(input), source: "template" };
    }
    return {
      text: finalizeOutreachInvitationCopy(raw),
      source: "gemini",
      model,
      promptTokens: Number(json.usageMetadata?.promptTokenCount) || 0,
      outputTokens: Number(json.usageMetadata?.candidatesTokenCount) || 0,
    };
  } catch (err) {
    console.warn("[outreach-invitation] gemini error", err instanceof Error ? err.message : err);
    return { text: buildTemplateOutreachInvitation(input), source: "template" };
  }
}

import { geminiApiKey, geminiModel } from "./shareAiCopyGemini.js";

export type GeminiGenerateOpts = {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Enable Google Search grounding when supported by the model. */
  googleSearch?: boolean;
  timeoutMs?: number;
};

export type GeminiGenerateOk = {
  ok: true;
  text: string;
  model: string;
  promptTokens: number;
  outputTokens: number;
  groundingUrls?: string[];
};

export type GeminiGenerateErr = {
  ok: false;
  error: string;
};

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
  error?: { message?: string };
};

/** Default Gemini output budget for full blog drafts (generate / enhance / chat). */
export const BLOG_DRAFT_MAX_OUTPUT_TOKENS = 16_384;

/** Admin PUT/POST body size for articles with long blocks JSON. */
export const BLOG_ADMIN_JSON_BODY_LIMIT = "4mb";

/** Stronger default for long-form blog drafts; override with BLOG_GEMINI_MODEL. */
export function blogGeminiDraftModel(): string {
  return process.env.BLOG_GEMINI_MODEL?.trim() || process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

export function blogGeminiCheapModel(): string {
  return process.env.BLOG_GEMINI_CHEAP_MODEL?.trim() || geminiModel();
}

export async function generateGeminiText(
  opts: GeminiGenerateOpts,
): Promise<GeminiGenerateOk | GeminiGenerateErr> {
  const key = geminiApiKey();
  if (!key) return { ok: false, error: "missing_gemini_api_key" };

  const model = opts.model || blogGeminiCheapModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: [{ text: opts.user }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxOutputTokens ?? BLOG_DRAFT_MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json",
    },
  };
  if (opts.googleSearch) {
    body.tools = [{ google_search: {} }];
    // Some models reject responseMimeType with tools — drop it when searching.
    delete (body.generationConfig as Record<string, unknown>).responseMimeType;
  }

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), opts.timeoutMs ?? 90_000);
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
      return { ok: false, error: json.error?.message || `http_${res.status}` };
    }
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text.trim()) return { ok: false, error: "empty_response" };

    const groundingUrls: string[] = [];
    for (const chunk of json.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []) {
      const uri = chunk.web?.uri?.trim();
      if (uri) groundingUrls.push(uri);
    }

    return {
      ok: true,
      text,
      model,
      promptTokens: Number(json.usageMetadata?.promptTokenCount) || 0,
      outputTokens: Number(json.usageMetadata?.candidatesTokenCount) || 0,
      groundingUrls: groundingUrls.length ? groundingUrls : undefined,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "gemini_error" };
  }
}

export function extractJsonObject<T>(raw: string): T | null {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

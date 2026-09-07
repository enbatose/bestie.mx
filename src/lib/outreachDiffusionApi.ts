import { apiBase } from "@/lib/apiBase";
import { deviceHeaders } from "@/lib/deviceFingerprint";

export type OutreachDiffusionCommentResult = {
  text: string;
  source: "gemini" | "template";
  model: string | null;
};

const cred: RequestCredentials = "include";

export async function generateOutreachDiffusionComment(input: {
  sharePath: string;
  seekerName?: string | null;
  zoneRule?: string | null;
  placeHint?: string | null;
  exactCount?: number | null;
  similarCount?: number | null;
  extraCriteria?: string[] | null;
  previousText?: string | null;
}): Promise<OutreachDiffusionCommentResult> {
  const res = await fetch(`${apiBase()}/api/admin/outreach-diffusion/generate`, {
    method: "POST",
    credentials: cred,
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    body: JSON.stringify({
      sharePath: input.sharePath,
      seekerName: input.seekerName?.trim() || undefined,
      zoneRule: input.zoneRule?.trim() || undefined,
      placeHint: input.placeHint?.trim() || undefined,
      exactCount: input.exactCount ?? undefined,
      similarCount: input.similarCount ?? undefined,
      extraCriteria: input.extraCriteria?.length ? input.extraCriteria : undefined,
      previousText: input.previousText?.trim() || undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const code =
      typeof (err as { error?: string }).error === "string"
        ? (err as { error: string }).error
        : `diffusion_${res.status}`;
    throw new Error(code);
  }
  const json = (await res.json()) as {
    text?: string;
    source?: "gemini" | "template";
    model?: string | null;
  };
  if (typeof json.text !== "string" || !json.text.trim()) {
    throw new Error("empty_diffusion_comment");
  }
  return {
    text: json.text,
    source: json.source === "template" ? "template" : "gemini",
    model: typeof json.model === "string" ? json.model : null,
  };
}

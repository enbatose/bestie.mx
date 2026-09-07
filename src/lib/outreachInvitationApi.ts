import { apiBase } from "@/lib/apiBase";
import { deviceHeaders } from "@/lib/deviceFingerprint";

export type OutreachInvitationResult = {
  text: string;
  source: "gemini" | "template";
  model: string | null;
};

const cred: RequestCredentials = "include";

export async function generateOutreachInvitation(input: {
  publisherName?: string;
  previousText?: string;
}): Promise<OutreachInvitationResult> {
  const res = await fetch(`${apiBase()}/api/admin/outreach-invitation/generate`, {
    method: "POST",
    credentials: cred,
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    body: JSON.stringify({
      publisherName: input.publisherName?.trim() || undefined,
      previousText: input.previousText?.trim() || undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const code =
      typeof (err as { error?: string }).error === "string"
        ? (err as { error: string }).error
        : `invitation_${res.status}`;
    throw new Error(code);
  }
  const json = (await res.json()) as {
    text?: string;
    source?: "gemini" | "template";
    model?: string | null;
  };
  if (typeof json.text !== "string" || !json.text.trim()) {
    throw new Error("empty_invitation");
  }
  return {
    text: json.text,
    source: json.source === "template" ? "template" : "gemini",
    model: typeof json.model === "string" ? json.model : null,
  };
}

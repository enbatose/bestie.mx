import { apiBase } from "@/lib/apiBase";
import { deviceHeaders } from "@/lib/deviceFingerprint";

export type ShareAiScope = "property" | "room";

export type ShareAiCopyResult = {
  scope: ShareAiScope;
  propertyId: string | null;
  roomId: string | null;
  text: string;
  permalink: string;
  userEdited: boolean;
  source: "stored" | "gemini" | "template";
};

const cred: RequestCredentials = "include";

export async function generateShareAiCopy(input: {
  scope: ShareAiScope;
  propertyId?: string | null;
  roomId?: string | null;
  force?: boolean;
}): Promise<ShareAiCopyResult> {
  const res = await fetch(`${apiBase()}/api/share-copy/generate`, {
    method: "POST",
    credentials: cred,
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    body: JSON.stringify({
      scope: input.scope,
      propertyId: input.propertyId ?? undefined,
      roomId: input.roomId ?? undefined,
      force: Boolean(input.force),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof (err as { error?: string }).error === "string"
        ? (err as { error: string }).error
        : `share_copy_${res.status}`,
    );
  }
  return (await res.json()) as ShareAiCopyResult;
}

export async function saveShareAiCopy(input: {
  scope: ShareAiScope;
  propertyId?: string | null;
  roomId?: string | null;
  text: string;
}): Promise<ShareAiCopyResult> {
  const res = await fetch(`${apiBase()}/api/share-copy`, {
    method: "PATCH",
    credentials: cred,
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    body: JSON.stringify({
      scope: input.scope,
      propertyId: input.propertyId ?? undefined,
      roomId: input.roomId ?? undefined,
      text: input.text,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof (err as { error?: string }).error === "string"
        ? (err as { error: string }).error
        : `share_copy_save_${res.status}`,
    );
  }
  return (await res.json()) as ShareAiCopyResult;
}

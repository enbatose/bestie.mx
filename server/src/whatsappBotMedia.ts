import type { DatabaseSync } from "node:sqlite";
import { persistListingImageBuffer } from "./uploadsRouter.js";

const GRAPH = "https://graph.facebook.com/v21.0";

function cloudToken(): string | null {
  return process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim() || null;
}

/**
 * Download a WhatsApp inbound image and store it like a wizard upload.
 */
export async function saveWhatsAppMediaImage(
  db: DatabaseSync,
  uploadDir: string,
  mediaId: string,
): Promise<string | null> {
  const token = cloudToken();
  if (!token || !mediaId.trim() || !uploadDir) return null;
  try {
    const metaRes = await fetch(`${GRAPH}/${encodeURIComponent(mediaId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) {
      console.warn(`[whatsapp] media meta ${metaRes.status}`);
      return null;
    }
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!meta.url) return null;
    const binRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!binRes.ok) {
      console.warn(`[whatsapp] media bytes ${binRes.status}`);
      return null;
    }
    const buf = Buffer.from(await binRes.arrayBuffer());
    return persistListingImageBuffer(db, uploadDir, buf, meta.mime_type);
  } catch (err) {
    console.warn("[whatsapp] media download failed", err instanceof Error ? err.message : err);
    return null;
  }
}

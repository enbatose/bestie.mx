/**
 * WhatsApp delivers album photos as separate webhook HTTP calls, often seconds
 * apart. Coalesce per-sender so we process one burst together (cap + messaging).
 */
import type { DatabaseSync } from "node:sqlite";
import type { ChatSink } from "./chatChannel.js";
import { processWhatsAppUserInput } from "./whatsappFlows.js";
import { whatsappChatSink, whatsappSessionId } from "./whatsappCloud.js";

export const WHATSAPP_ALBUM_COALESCE_MS = 5_500;

export type WhatsAppAlbumImage = { id: string; caption?: string };

type PendingAlbum = {
  timer: ReturnType<typeof setTimeout>;
  images: WhatsAppAlbumImage[];
  db: DatabaseSync;
  uploadDir?: string;
};

const pendingAlbums = new Map<string, PendingAlbum>();

/** Test helper — clears in-flight album buffers. */
export function resetWhatsAppAlbumBuffersForTests(): void {
  for (const pending of pendingAlbums.values()) {
    clearTimeout(pending.timer);
  }
  pendingAlbums.clear();
}

export function pendingWhatsAppAlbumImageCount(fromDigits: string): number {
  const key = fromDigits.replace(/\D/g, "");
  return pendingAlbums.get(key)?.images.length ?? 0;
}

async function flushWhatsAppAlbum(fromDigits: string): Promise<void> {
  const key = fromDigits.replace(/\D/g, "");
  const pending = pendingAlbums.get(key);
  if (!pending) return;
  pendingAlbums.delete(key);
  clearTimeout(pending.timer);
  const images = pending.images;
  if (!images.length) return;
  const sink: ChatSink = whatsappChatSink(key);
  const sessionId = whatsappSessionId(key);
  try {
    await processWhatsAppUserInput(
      pending.db,
      sessionId,
      key,
      {
        imageMediaIds: images.map((b) => b.id),
        imageCaption: images.map((b) => b.caption?.trim()).filter(Boolean).join("\n") || undefined,
      },
      sink,
      { uploadDir: pending.uploadDir, photoAckDelayMs: 0 },
    );
  } catch (err) {
    console.warn(`[whatsapp] album flush error for ${key}:`, err);
  }
}

/** Flush any buffered album before handling text/buttons from the same sender. */
export async function flushWhatsAppAlbumIfAny(fromDigits: string): Promise<void> {
  const key = fromDigits.replace(/\D/g, "");
  if (pendingAlbums.has(key)) await flushWhatsAppAlbum(key);
}

/**
 * Queue images for a sender; resets the coalesce window on each call.
 * Returns how many unique media ids are buffered after the enqueue.
 */
export function enqueueWhatsAppAlbumImages(
  db: DatabaseSync,
  fromDigits: string,
  images: WhatsAppAlbumImage[],
  opts?: { uploadDir?: string; coalesceMs?: number },
): number {
  const key = fromDigits.replace(/\D/g, "");
  if (!key || !images.length) return 0;
  let pending = pendingAlbums.get(key);
  if (!pending) {
    pending = {
      timer: setTimeout(() => undefined, 0),
      images: [],
      db,
      uploadDir: opts?.uploadDir,
    };
    pendingAlbums.set(key, pending);
  }
  pending.db = db;
  if (opts?.uploadDir) pending.uploadDir = opts.uploadDir;
  for (const img of images) {
    const id = img.id.trim();
    if (!id) continue;
    if (pending.images.some((x) => x.id === id)) continue;
    pending.images.push({ id, caption: img.caption });
  }
  clearTimeout(pending.timer);
  const wait = opts?.coalesceMs ?? WHATSAPP_ALBUM_COALESCE_MS;
  pending.timer = setTimeout(() => {
    void flushWhatsAppAlbum(key);
  }, wait);
  if (typeof pending.timer.unref === "function") pending.timer.unref();
  return pending.images.length;
}

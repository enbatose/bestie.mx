import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { Request, Response } from "express";
import { isProductionRuntime } from "./authSecret.js";
import {
  enqueueWhatsAppAlbumImages,
  flushWhatsAppAlbumIfAny,
} from "./whatsappAlbumBuffer.js";
import { processWhatsAppUserInput } from "./whatsappFlows.js";
import {
  whatsappChatSink,
  whatsappCloudPhoneNumberId,
  whatsappSessionId,
} from "./whatsappCloud.js";

export type WhatsAppWebhookOptions = {
  uploadDir?: string;
};

export function whatsappWebhookVerify(req: Request, res: Response): void {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const expected = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  if (mode === "subscribe" && typeof token === "string" && token === expected && typeof challenge === "string") {
    res.status(200).send(challenge);
    return;
  }
  res.status(403).send("forbidden");
}

function verifyMetaSignature(rawBody: Buffer, sigHeader: string | undefined): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET?.trim() || "";
  if (!secret) {
    return !isProductionRuntime();
  }
  if (!sigHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const got = sigHeader.slice("sha256=".length);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(got, "hex"));
  } catch {
    return false;
  }
}

type WaMessage = {
  id?: string;
  from?: string;
  type?: string;
  timestamp?: string | number;
  text?: { body?: string };
  image?: { id?: string; caption?: string };
  document?: { id?: string; mime_type?: string; caption?: string; filename?: string };
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
  interactive?: {
    type?: string;
    button_reply?: { id?: string };
    list_reply?: { id?: string };
  };
};

function interactivePayload(msg: WaMessage): string | null {
  const id = msg.interactive?.button_reply?.id ?? msg.interactive?.list_reply?.id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function inboundImageFromMessage(msg: WaMessage): { id: string; caption?: string; timestampSec?: number } | null {
  const tsRaw = msg.timestamp;
  const timestampSec =
    typeof tsRaw === "number" && Number.isFinite(tsRaw)
      ? Math.floor(tsRaw)
      : typeof tsRaw === "string" && /^\d+$/.test(tsRaw.trim())
        ? Number(tsRaw.trim())
        : undefined;
  const withTs = <T extends { id: string; caption?: string }>(img: T) =>
    timestampSec != null ? { ...img, timestampSec } : img;

  if (typeof msg.image?.id === "string" && msg.image.id.trim()) {
    return withTs({ id: msg.image.id.trim(), caption: msg.image.caption });
  }
  const doc = msg.document;
  const mime = (doc?.mime_type ?? "").toLowerCase();
  const name = (doc?.filename ?? "").toLowerCase();
  const looksImage = mime.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic)$/i.test(name);
  if (doc?.id && looksImage) {
    return withTs({ id: doc.id.trim(), caption: doc.caption });
  }
  if (msg.type === "image" && typeof msg.image?.id === "string") {
    return withTs({ id: msg.image.id.trim(), caption: msg.image.caption });
  }
  return null;
}

function rememberWamid(db: DatabaseSync, wamid: string): boolean {
  try {
    db.prepare(`INSERT INTO whatsapp_processed_wamids (wamid, created_at) VALUES (?, ?)`).run(
      wamid,
      Date.now(),
    );
    return true;
  } catch {
    return false;
  }
}

export function whatsappWebhookPost(db: DatabaseSync, opts: WhatsAppWebhookOptions = {}) {
  return async (req: Request, res: Response): Promise<void> => {
    const raw = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
    const sig = req.get("x-hub-signature-256");
    if (!verifyMetaSignature(raw, sig)) {
      res.status(403).json({ error: "bad_signature" });
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(raw.toString("utf8"));
    } catch {
      res.status(400).json({ error: "invalid_json" });
      return;
    }

    const expectedPhoneId = whatsappCloudPhoneNumberId();
    const entries = (payload as { entry?: unknown })?.entry;
    let firstFrom: string | null = null;

    if (Array.isArray(entries)) {
      for (const ent of entries) {
        const changes = (ent as { changes?: unknown })?.changes;
        if (!Array.isArray(changes)) continue;
        for (const ch of changes) {
          const field = (ch as { field?: string })?.field;
          if (field && field !== "messages") continue;
          const value = (ch as { value?: Record<string, unknown> })?.value;
          if (!value || typeof value !== "object") continue;
          const meta = value.metadata as { phone_number_id?: string } | undefined;
          if (expectedPhoneId && meta?.phone_number_id && meta.phone_number_id !== expectedPhoneId) {
            continue;
          }
          const messages = value.messages;
          if (!Array.isArray(messages)) continue;
          const queue = messages as WaMessage[];
          for (let i = 0; i < queue.length; i++) {
            const msg = queue[i]!;
            const from = typeof msg.from === "string" ? msg.from.replace(/\D/g, "") : "";
            const wamid = typeof msg.id === "string" ? msg.id : "";
            if (!from) continue;
            if (!firstFrom) firstFrom = from;
            if (wamid && !rememberWamid(db, wamid)) continue;

            const sessionId = whatsappSessionId(from);
            const sink = whatsappChatSink(from);
            const image = inboundImageFromMessage(msg);
            if (image) {
              const batch = [image];
              while (i + 1 < queue.length) {
                const next = queue[i + 1]!;
                const nextFrom = typeof next.from === "string" ? next.from.replace(/\D/g, "") : "";
                const nextImage = inboundImageFromMessage(next);
                if (nextFrom !== from || !nextImage) break;
                i += 1;
                const nextWamid = typeof next.id === "string" ? next.id : "";
                if (nextWamid && !rememberWamid(db, nextWamid)) continue;
                batch.push(nextImage);
              }
              // Album photos arrive as separate HTTP webhooks — coalesce before processing.
              enqueueWhatsAppAlbumImages(db, from, batch, { uploadDir: opts.uploadDir });
              continue;
            }

            const button = interactivePayload(msg);
            const lat = Number(msg.location?.latitude);
            const lng = Number(msg.location?.longitude);
            const handledType =
              Boolean(button) ||
              msg.type === "text" ||
              msg.type === "location" ||
              (Number.isFinite(lat) && Number.isFinite(lng));
            if (!handledType) continue;

            try {
              await flushWhatsAppAlbumIfAny(from);
              await processWhatsAppUserInput(
                db,
                sessionId,
                from,
                {
                  ...(button ? { quickReplyPayload: button } : {}),
                  ...(msg.type === "text" && typeof msg.text?.body === "string" ? { text: msg.text.body } : {}),
                  ...(Number.isFinite(lat) && Number.isFinite(lng)
                    ? {
                        location: {
                          lat,
                          lng,
                          name: msg.location?.name || msg.location?.address,
                        },
                      }
                    : {}),
                },
                sink,
                { uploadDir: opts.uploadDir },
              );
            } catch (err) {
              console.warn(`[whatsapp] handler error for ${from}:`, err);
            }
          }
        }
      }
    }

    db.prepare(`INSERT INTO whatsapp_events (id, sender_wa, payload_json, created_at) VALUES (?, ?, ?, ?)`).run(
      randomUUID(),
      firstFrom,
      JSON.stringify(payload),
      Date.now(),
    );
    res.status(200).json({ ok: true });
  };
}

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { Request, Response } from "express";
import { isProductionRuntime } from "./authSecret.js";
import { processMessengerUserInput } from "./messengerFlows.js";
import {
  whatsappChatSink,
  whatsappCloudPhoneNumberId,
  whatsappSessionId,
} from "./whatsappCloud.js";

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
  text?: { body?: string };
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

export function whatsappWebhookPost(db: DatabaseSync) {
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
          for (const msg of messages as WaMessage[]) {
            const from = typeof msg.from === "string" ? msg.from.replace(/\D/g, "") : "";
            const wamid = typeof msg.id === "string" ? msg.id : "";
            if (!from) continue;
            if (!firstFrom) firstFrom = from;
            if (wamid && !rememberWamid(db, wamid)) continue;

            const sessionId = whatsappSessionId(from);
            const sink = whatsappChatSink(from);
            try {
              const button = interactivePayload(msg);
              if (button) {
                await processMessengerUserInput(db, sessionId, { quickReplyPayload: button }, sink);
              } else if (msg.type === "text" && typeof msg.text?.body === "string") {
                await processMessengerUserInput(db, sessionId, { text: msg.text.body }, sink);
              } else {
                await processMessengerUserInput(db, sessionId, { postback: "MB_MENU" }, sink);
              }
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

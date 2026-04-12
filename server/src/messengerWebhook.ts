import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { Request, Response } from "express";
import { processMessengerUserInput } from "./messengerFlows.js";

export function messengerWebhookVerify(req: Request, res: Response): void {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const expected = process.env.MESSENGER_VERIFY_TOKEN?.trim();
  if (mode === "subscribe" && typeof token === "string" && token === expected && typeof challenge === "string") {
    res.status(200).send(challenge);
    return;
  }
  res.status(403).send("forbidden");
}

function verifyMetaSignature(rawBody: Buffer, sigHeader: string | undefined): boolean {
  const secret = process.env.META_APP_SECRET?.trim();
  if (!secret || !sigHeader?.startsWith("sha256=")) return !secret;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const got = sigHeader.slice("sha256=".length);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(got, "hex"));
  } catch {
    return false;
  }
}

type MessagingEvent = {
  sender?: { id?: string };
  postback?: { payload?: string };
  message?: { text?: string; quick_reply?: { payload?: string }; is_echo?: boolean };
};

export function messengerWebhookPost(db: DatabaseSync) {
  return async (req: Request, res: Response): Promise<void> => {
    const raw = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
    const sig = req.get("x-hub-signature-256");
    if (process.env.META_APP_SECRET?.trim() && !verifyMetaSignature(raw, sig)) {
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

    const entries = (payload as { entry?: unknown })?.entry;
    let firstPsid: string | null = null;
    if (Array.isArray(entries)) {
      for (const ent of entries) {
        const messaging = (ent as { messaging?: unknown })?.messaging;
        if (!Array.isArray(messaging)) continue;
        for (const ev of messaging as MessagingEvent[]) {
          const sender = ev.sender?.id;
          if (!sender) continue;
          if (!firstPsid) firstPsid = sender;
          if (ev.message?.is_echo) continue;

          try {
            if (ev.postback?.payload) {
              await processMessengerUserInput(db, sender, { postback: ev.postback.payload });
            } else if (ev.message?.quick_reply?.payload) {
              await processMessengerUserInput(db, sender, {
                quickReplyPayload: ev.message.quick_reply.payload,
              });
            } else if (typeof ev.message?.text === "string") {
              await processMessengerUserInput(db, sender, { text: ev.message.text });
            }
          } catch (err) {
            console.warn(`[messenger] handler error for ${sender}:`, err);
          }
        }
      }
    }

    const id = randomUUID();
    db.prepare(`INSERT INTO messenger_events (id, sender_psid, payload_json, created_at) VALUES (?, ?, ?, ?)`).run(
      id,
      firstPsid,
      JSON.stringify(payload),
      Date.now(),
    );
    res.status(200).json({ ok: true });
  };
}

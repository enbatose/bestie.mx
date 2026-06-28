import type { Request, Response } from "express";
import { Resend } from "resend";
import { cleanEnv, getResendApiKey } from "./mailer.js";

function resendClient(): Resend | null {
  const key = getResendApiKey();
  if (!key) return null;
  return new Resend(key);
}

/** POST /api/resend/webhook — delivery, open, click, bounce events (Svix-signed). */
export async function resendWebhookPost(req: Request, res: Response): Promise<void> {
  const secret = cleanEnv(process.env.RESEND_WEBHOOK_SECRET);
  if (!secret) {
    res.status(503).json({ error: "webhook_not_configured" });
    return;
  }

  const client = resendClient();
  if (!client) {
    res.status(503).json({ error: "resend_api_not_configured" });
    return;
  }

  const raw = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
  const payload = raw.toString("utf8");

  try {
    const event = client.webhooks.verify({
      payload,
      headers: {
        id: req.get("svix-id") ?? "",
        timestamp: req.get("svix-timestamp") ?? "",
        signature: req.get("svix-signature") ?? "",
      },
      webhookSecret: secret,
    });

    const emailId = (event.data as { email_id?: string } | undefined)?.email_id;
    const to = (event.data as { to?: string[] } | undefined)?.to;
    console.log(
      `[resend] ${event.type}${emailId ? ` email_id=${emailId}` : ""}${to?.length ? ` to=${to.join(",")}` : ""}`,
    );

    res.status(200).json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[resend] webhook verify failed: ${msg.slice(0, 200)}`);
    res.status(400).json({ error: "invalid_webhook" });
  }
}

import type { Request, Response } from "express";
import { Resend } from "resend";
import { cleanEnv, getResendApiKey } from "./mailer.js";

function resendClient(): Resend | null {
  const key = getResendApiKey();
  if (!key) return null;
  return new Resend(key);
}

/** POST /api/resend/webhook — Resend email + domain events (Svix-signed). See docs/integrations/resend-webhooks.md */
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

    const data = event.data as Record<string, unknown> | undefined;
    const emailId = typeof data?.email_id === "string" ? data.email_id : undefined;
    const to = Array.isArray(data?.to) ? (data.to as string[]) : undefined;
    const domain =
      typeof data?.name === "string"
        ? data.name
        : typeof data?.domain === "string"
          ? data.domain
          : undefined;
    const parts = [event.type];
    if (emailId) parts.push(`email_id=${emailId}`);
    if (to?.length) parts.push(`to=${to.join(",")}`);
    if (domain) parts.push(`domain=${domain}`);
    console.log(`[resend] ${parts.join(" ")}`);

    res.status(200).json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[resend] webhook verify failed: ${msg.slice(0, 200)}`);
    res.status(400).json({ error: "invalid_webhook" });
  }
}

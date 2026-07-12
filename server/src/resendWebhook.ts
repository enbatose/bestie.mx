import type { Request, Response } from "express";
import { Resend } from "resend";
import { cleanEnv } from "./mailer.js";

/** Inbound address on bestie.mx that forwards to RESEND_CONTACT_FORWARD_TO. */
export const CONTACT_INBOUND_ADDRESS = "contacto@bestie.mx";

/** Default forward target when RESEND_CONTACT_FORWARD_TO is unset. */
export const DEFAULT_CONTACT_FORWARD_TO = "batani.enrique@gmail.com";

function resendClient(): Resend | null {
  const key = getResendReceivingApiKey();
  if (!key) return null;
  return new Resend(key);
}

/** Receiving/forward requires full_access; sending-only keys return 401 on receiving APIs. */
export function getResendReceivingApiKey(): string | undefined {
  return (
    cleanEnv(process.env.RESEND_RECEIVING_API_KEY) ||
    cleanEnv(process.env.RESEND_API_KEY) ||
    cleanEnv(process.env.RESEND_KEY) ||
    cleanEnv(process.env.RESEND_ADMIN_API_KEY)
  );
}

export function resolveContactForwardTo(): string {
  return cleanEnv(process.env.RESEND_CONTACT_FORWARD_TO) || DEFAULT_CONTACT_FORWARD_TO;
}

export function resolveContactForwardFrom(): string {
  return (
    cleanEnv(process.env.RESEND_CONTACT_FORWARD_FROM) ||
    `Bestie Contacto <${CONTACT_INBOUND_ADDRESS}>`
  );
}

/** Strip display name from RFC 5322 addresses (`Name <user@host>` → `user@host`). */
export function normalizeEmailAddress(value: string): string {
  const trimmed = value.trim();
  const angle = trimmed.match(/<([^>]+)>/);
  return (angle?.[1] ?? trimmed).trim().toLowerCase();
}

export function matchesInboundAddress(
  recipients: string[] | undefined,
  target: string,
): boolean {
  if (!recipients?.length) return false;
  const normalizedTarget = target.toLowerCase();
  return recipients.some((recipient) => normalizeEmailAddress(recipient) === normalizedTarget);
}

async function forwardContactEmail(client: Resend, emailId: string): Promise<void> {
  const { data, error } = await client.emails.receiving.forward({
    emailId,
    from: resolveContactForwardFrom(),
    to: resolveContactForwardTo(),
  });

  if (error) {
    throw new Error(error.message);
  }

  console.log(
    `[resend] forwarded ${CONTACT_INBOUND_ADDRESS} email_id=${emailId} forward_id=${data?.id ?? "unknown"}`,
  );
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

    const data = event.data as unknown as Record<string, unknown> | undefined;
    const emailId = typeof data?.email_id === "string" ? data.email_id : undefined;
    const to = Array.isArray(data?.to) ? (data.to as string[]) : undefined;
    const domain =
      typeof data?.name === "string"
        ? data.name
        : typeof data?.domain === "string"
          ? data.domain
          : undefined;
    const parts: string[] = [event.type];
    if (emailId) parts.push(`email_id=${emailId}`);
    if (to?.length) parts.push(`to=${to.join(",")}`);
    if (domain) parts.push(`domain=${domain}`);
    console.log(`[resend] ${parts.join(" ")}`);

    if (
      event.type === "email.received" &&
      emailId &&
      matchesInboundAddress(to, CONTACT_INBOUND_ADDRESS)
    ) {
      try {
        await forwardContactEmail(client, emailId);
      } catch (forwardErr) {
        const msg = forwardErr instanceof Error ? forwardErr.message : String(forwardErr);
        console.warn(`[resend] forward failed email_id=${emailId}: ${msg.slice(0, 200)}`);
        res.status(500).json({ error: "forward_failed" });
        return;
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[resend] webhook failed: ${msg.slice(0, 200)}`);
    res.status(400).json({ error: "invalid_webhook" });
  }
}

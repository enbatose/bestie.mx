import type { Request, Response } from "express";
import { Resend } from "resend";
import { cleanEnv, sendTransactionalEmail } from "./mailer.js";
import { recordEmailReceived } from "./usageAnalytics.js";

/** Only published / forwarded inbound address on bestie.mx. */
export const CONTACT_INBOUND_ADDRESS = "contacto@bestie.mx";

/** Default forward target when RESEND_CONTACT_FORWARD_TO is unset. */
export const DEFAULT_CONTACT_FORWARD_TO = "batani.enrique@gmail.com";

/** Expected SPF for send.bestie.mx (Resend/SES return-path). */
export const EXPECTED_SEND_SPF_INCLUDE = "include:amazonses.com";

const SEND_SPF_HOST = "send.bestie.mx";
const FORWARD_ALERT_COOLDOWN_MS = 15 * 60 * 1000;

type InboundProbeState = {
  receivingProbeOk: boolean | null;
  receivingProbeError: string | null;
  receivingProbedAt: string | null;
  spfOk: boolean | null;
  spfTxt: string | null;
  spfProbedAt: string | null;
};

const probeState: InboundProbeState = {
  receivingProbeOk: null,
  receivingProbeError: null,
  receivingProbedAt: null,
  spfOk: null,
  spfTxt: null,
  spfProbedAt: null,
};

let lastForwardAlertAt = 0;

function resendClient(): Resend | null {
  const key = getResendReceivingApiKey();
  if (!key) return null;
  return new Resend(key);
}

/**
 * Keys allowed for receiving/forward APIs.
 * Never use RESEND_API_KEY here — production sending keys are often sending-only and return 401 on forward.
 */
export function getResendReceivingApiKey(): string | undefined {
  return (
    cleanEnv(process.env.RESEND_RECEIVING_API_KEY) ||
    cleanEnv(process.env.RESEND_ADMIN_API_KEY) ||
    undefined
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

/** True when Svix webhook secret is present (no secret value exposed). */
export function resendWebhookConfigured(): boolean {
  return Boolean(cleanEnv(process.env.RESEND_WEBHOOK_SECRET));
}

/** True when a full_access key usable for receiving/forward APIs is present. */
export function resendReceivingConfigured(): boolean {
  return Boolean(getResendReceivingApiKey());
}

/** Public inbound status for `/api/health` (booleans only — no secrets). */
export function getResendInboundDiagnostics(): {
  webhookConfigured: boolean;
  receivingKeyConfigured: boolean;
  receivingProbeOk: boolean | null;
  receivingProbeError: string | null;
  receivingProbedAt: string | null;
  spfOk: boolean | null;
  spfTxt: string | null;
  spfProbedAt: string | null;
  forwardTo: string;
  inboundAddresses: string[];
} {
  return {
    webhookConfigured: resendWebhookConfigured(),
    receivingKeyConfigured: resendReceivingConfigured(),
    receivingProbeOk: probeState.receivingProbeOk,
    receivingProbeError: probeState.receivingProbeError,
    receivingProbedAt: probeState.receivingProbedAt,
    spfOk: probeState.spfOk,
    spfTxt: probeState.spfTxt,
    spfProbedAt: probeState.spfProbedAt,
    forwardTo: resolveContactForwardTo(),
    inboundAddresses: [CONTACT_INBOUND_ADDRESS],
  };
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

/** True when any recipient should be forwarded to the contact inbox (contacto@ only). */
export function shouldForwardInbound(recipients: string[] | undefined): boolean {
  return matchesInboundAddress(recipients, CONTACT_INBOUND_ADDRESS);
}

async function probeSpfDns(): Promise<void> {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${SEND_SPF_HOST}&type=TXT`,
      { headers: { accept: "application/dns-json" } },
    );
    const body = (await res.json()) as {
      Answer?: Array<{ data?: string }>;
    };
    const answers = Array.isArray(body.Answer)
      ? body.Answer.map((a) => String(a.data ?? "").replace(/^"|"$/g, ""))
      : [];
    const joined = answers.join(" | ") || null;
    const ok = answers.some((t) => t.includes(EXPECTED_SEND_SPF_INCLUDE));
    probeState.spfTxt = joined;
    probeState.spfOk = ok;
    probeState.spfProbedAt = new Date().toISOString();
    if (ok) {
      console.log(`[resend] SPF ${SEND_SPF_HOST} OK`);
    } else {
      console.error(
        `[resend] SPF ${SEND_SPF_HOST} FAILED — expected ${EXPECTED_SEND_SPF_INCLUDE}; got ${joined ?? "(none)"}`,
      );
    }
  } catch (e) {
    probeState.spfOk = false;
    probeState.spfTxt = null;
    probeState.spfProbedAt = new Date().toISOString();
    probeState.receivingProbeError = null;
    console.error(
      `[resend] SPF probe failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200),
    );
  }
}

async function probeReceivingKey(): Promise<void> {
  const key = getResendReceivingApiKey();
  if (!key) {
    probeState.receivingProbeOk = null;
    probeState.receivingProbeError = "receiving_key_missing";
    probeState.receivingProbedAt = new Date().toISOString();
    console.warn(
      "[resend] receiving key missing — set RESEND_RECEIVING_API_KEY (full_access) on Railway; do not use sending-only RESEND_API_KEY for inbound",
    );
    return;
  }
  try {
    const client = new Resend(key);
    const { error } = await client.emails.receiving.list({ limit: 1 });
    if (error) {
      probeState.receivingProbeOk = false;
      probeState.receivingProbeError = error.message.slice(0, 200);
      probeState.receivingProbedAt = new Date().toISOString();
      console.error(`[resend] receiving key probe FAILED: ${probeState.receivingProbeError}`);
      return;
    }
    probeState.receivingProbeOk = true;
    probeState.receivingProbeError = null;
    probeState.receivingProbedAt = new Date().toISOString();
    console.log("[resend] receiving key probe OK");
  } catch (e) {
    probeState.receivingProbeOk = false;
    probeState.receivingProbeError = (e instanceof Error ? e.message : String(e)).slice(0, 200);
    probeState.receivingProbedAt = new Date().toISOString();
    console.error(`[resend] receiving key probe FAILED: ${probeState.receivingProbeError}`);
  }
}

/** Boot / periodic probes for SPF + receiving key (safe no-op when unset). */
export async function verifyResendInbound(): Promise<void> {
  await Promise.all([probeSpfDns(), probeReceivingKey()]);
}

async function alertForwardFailure(emailId: string, reason: string): Promise<void> {
  const now = Date.now();
  if (now - lastForwardAlertAt < FORWARD_ALERT_COOLDOWN_MS) return;
  lastForwardAlertAt = now;
  const to = resolveContactForwardTo();
  try {
    const ok = await sendTransactionalEmail({
      to,
      subject: "[Bestie] Falló el reenvío de correo entrante (contacto@)",
      text: `El webhook de Resend no pudo reenviar un correo a ${to}.\n\nemail_id=${emailId}\nerror=${reason.slice(0, 300)}\n\nRevisa Railway RESEND_RECEIVING_API_KEY y npm run resend:reforward.`,
      html: `<p>El webhook de Resend no pudo reenviar un correo a <strong>${to}</strong>.</p><p><code>email_id=${emailId}</code><br/><code>error=${reason.slice(0, 300)}</code></p><p>Revisa <code>RESEND_RECEIVING_API_KEY</code> en Railway y <code>npm run resend:reforward</code>.</p>`,
      tags: [{ name: "category", value: "inbound_forward_alert" }],
    });
    if (ok) {
      console.warn(`[resend] forward-failure alert sent to=${to}`);
    } else {
      console.warn("[resend] forward-failure alert skipped (outbound mail not configured)");
    }
  } catch (e) {
    console.warn(
      `[resend] forward-failure alert failed: ${e instanceof Error ? e.message : String(e)}`.slice(
        0,
        200,
      ),
    );
  }
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
    `[resend] forwarded inbound email_id=${emailId} to=${resolveContactForwardTo()} forward_id=${data?.id ?? "unknown"}`,
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
    res.status(503).json({ error: "resend_receiving_key_not_configured" });
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
    const from = typeof data?.from === "string" ? data.from : undefined;
    const subject = typeof data?.subject === "string" ? data.subject : undefined;
    const domain =
      typeof data?.name === "string"
        ? data.name
        : typeof data?.domain === "string"
          ? data.domain
          : undefined;
    const parts: string[] = [event.type];
    if (emailId) parts.push(`email_id=${emailId}`);
    if (from) parts.push(`from=${from}`);
    if (to?.length) parts.push(`to=${to.join(",")}`);
    if (subject) parts.push(`subject=${subject.slice(0, 80)}`);
    if (domain) parts.push(`domain=${domain}`);
    console.log(`[resend] ${parts.join(" ")}`);

    if (event.type === "email.received") {
      recordEmailReceived(shouldForwardInbound(to) ? "contacto_forward" : "inbound_other");
    }

    if (event.type === "email.received" && emailId && shouldForwardInbound(to)) {
      try {
        await forwardContactEmail(client, emailId);
      } catch (forwardErr) {
        const msg = forwardErr instanceof Error ? forwardErr.message : String(forwardErr);
        console.warn(`[resend] forward failed email_id=${emailId}: ${msg.slice(0, 200)}`);
        void alertForwardFailure(emailId, msg);
        res.status(500).json({ error: "forward_failed" });
        return;
      }
    } else if (event.type === "email.received" && emailId) {
      console.log(
        `[resend] email.received not forwarded (only ${CONTACT_INBOUND_ADDRESS} is forwarded) email_id=${emailId} to=${(to ?? []).join(",")}`,
      );
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[resend] webhook failed: ${msg.slice(0, 200)}`);
    res.status(400).json({ error: "invalid_webhook" });
  }
}

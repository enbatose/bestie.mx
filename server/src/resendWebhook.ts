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

/**
 * Legacy default for `scripts/resend-reforward-inbound.mjs` only. The live webhook path no longer
 * sends "as" contacto@bestie.mx for forwards — composed forwards use the normal no-reply@bestie.mx
 * sender so the visible From never disguises an external message as coming from Bestie itself.
 */
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

/** True when the address is on bestie.mx (no-reply, contacto, any subdomain). */
export function isBestieOwnedAddress(value: string | undefined): boolean {
  if (!value) return false;
  const email = normalizeEmailAddress(value);
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const host = email.slice(at + 1);
  return host === "bestie.mx" || host.endsWith(".bestie.mx");
}

/**
 * Forward external mail to contacto@ → Gmail.
 * Do not forward Bestie-originated mail (ops alerts, ARCO BCC): those stay in the
 * Resend contacto@ inbox as the Bestie evidence copy and must not consume a second send.
 */
export function shouldForwardInbound(
  recipients: string[] | undefined,
  from?: string,
): boolean {
  if (!matchesInboundAddress(recipients, CONTACT_INBOUND_ADDRESS)) return false;
  if (isBestieOwnedAddress(from)) return false;
  return true;
}

export function inboundReceivedDimension(
  recipients: string[] | undefined,
  from?: string,
): string {
  if (!matchesInboundAddress(recipients, CONTACT_INBOUND_ADDRESS)) return "inbound_other";
  if (isBestieOwnedAddress(from)) return "contacto_bestie_outbound";
  return "contacto_forward";
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

/** Escape untrusted (attacker-controlled) text before embedding it in the forwarded HTML banner. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Best-effort fetch of the received email's HTML/text body (from/subject already come from the webhook event). */
async function fetchReceivedEmailBody(
  apiKey: string,
  emailId: string,
): Promise<{ html: string | null; text: string | null; from?: string; subject?: string }> {
  try {
    const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !body) {
      console.warn(`[resend] fetch received body failed email_id=${emailId} status=${res.status}`);
      return { html: null, text: null };
    }
    return {
      html: typeof body.html === "string" ? body.html : null,
      text: typeof body.text === "string" ? body.text : null,
      from: typeof body.from === "string" ? body.from : undefined,
      subject: typeof body.subject === "string" ? body.subject : undefined,
    };
  } catch (e) {
    console.warn(
      `[resend] fetch received body error email_id=${emailId}: ${e instanceof Error ? e.message : String(e)}`.slice(
        0,
        200,
      ),
    );
    return { html: null, text: null };
  }
}

/**
 * Forward inbound contacto@ mail as a NEW composed message (not Resend's raw `receiving.forward`),
 * so the real external sender is always visible — never disguised as coming from bestie.mx itself.
 * This is what would have made the "Meta suspension" phishing obvious immediately: the subject and
 * body clearly show the attacker's real address instead of showing `Bestie Contacto <contacto@bestie.mx>`.
 */
async function forwardContactEmail(
  apiKey: string,
  emailId: string,
  eventFrom: string | undefined,
  eventSubject: string | undefined,
): Promise<void> {
  const body = await fetchReceivedEmailBody(apiKey, emailId);
  const fromDisplay = (eventFrom ?? body.from ?? "").trim() || "(remitente desconocido)";
  const subjectDisplay =
    (eventSubject ?? body.subject ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 150) || "(sin asunto)";

  const bannerHtml =
    `<div style="font-family:Arial,sans-serif;border:2px solid #d93025;background:#fff3f2;` +
    `padding:12px 16px;margin-bottom:16px;border-radius:6px;color:#1c1e21;font-size:14px;line-height:1.5">` +
    `<strong>⚠️ Mensaje EXTERNO recibido en contacto@bestie.mx</strong><br/>` +
    `No fue enviado por Bestie ni por Meta — llegó de una dirección externa y se reenvía automáticamente.<br/>` +
    `<strong>Remitente original:</strong> ${escapeHtml(fromDisplay)}<br/>` +
    `<strong>Asunto original:</strong> ${escapeHtml(subjectDisplay)}</div>`;
  const bannerText =
    `⚠️ MENSAJE EXTERNO recibido en contacto@bestie.mx — no fue enviado por Bestie ni por Meta.\n` +
    `Remitente original: ${fromDisplay}\n` +
    `Asunto original: ${subjectDisplay}\n${"-".repeat(48)}\n\n`;

  const fallbackNote = "(no se pudo cargar el contenido del mensaje; revisa resend.com/emails)";
  const ok = await sendTransactionalEmail({
    to: resolveContactForwardTo(),
    subject: `[Externo: ${fromDisplay}] ${subjectDisplay}`.slice(0, 250),
    html: `${bannerHtml}${body.html ?? `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(body.text ?? fallbackNote)}</pre>`}`,
    text: `${bannerText}${body.text ?? fallbackNote}`,
    tags: [{ name: "category", value: "inbound_forward" }],
  });

  if (!ok) {
    throw new Error("send_failed");
  }

  console.log(
    `[resend] forwarded inbound email_id=${emailId} to=${resolveContactForwardTo()} from=${fromDisplay}`,
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
      recordEmailReceived(inboundReceivedDimension(to, from));
    }

    if (event.type === "email.received" && emailId && shouldForwardInbound(to, from)) {
      try {
        const apiKey = getResendReceivingApiKey();
        if (!apiKey) throw new Error("receiving_key_missing");
        await forwardContactEmail(apiKey, emailId, from, subject);
      } catch (forwardErr) {
        const msg = forwardErr instanceof Error ? forwardErr.message : String(forwardErr);
        console.warn(`[resend] forward failed email_id=${emailId}: ${msg.slice(0, 200)}`);
        void alertForwardFailure(emailId, msg);
        res.status(500).json({ error: "forward_failed" });
        return;
      }
    } else if (event.type === "email.received" && emailId) {
      if (matchesInboundAddress(to, CONTACT_INBOUND_ADDRESS) && isBestieOwnedAddress(from)) {
        console.log(
          `[resend] email.received kept in ${CONTACT_INBOUND_ADDRESS} (no Gmail forward for @bestie.mx From) email_id=${emailId} from=${from}`,
        );
      } else {
        console.log(
          `[resend] email.received not forwarded (only ${CONTACT_INBOUND_ADDRESS} is forwarded) email_id=${emailId} to=${(to ?? []).join(",")}`,
        );
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[resend] webhook failed: ${msg.slice(0, 200)}`);
    res.status(400).json({ error: "invalid_webhook" });
  }
}

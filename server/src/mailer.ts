import nodemailer from "nodemailer";
import { Resend } from "resend";

export type SmtpDiagnostics = {
  configured: boolean;
  verifiedAt: string | null;
  verifyOk: boolean | null;
  verifyError: string | null;
};

/** Shown in `GET /api/health` when outbound mail is off (no secrets). */
export const OUTBOUND_SMTP_SETUP_HINT =
  "Optional: set RESEND_API_KEY + EMAIL_FROM (recommended), or GMAIL_USER + GMAIL_APP_PASSWORD / SMTP_URL, on the **Node/API** service — not on the static front-end build.";

const diagnostics: SmtpDiagnostics = {
  configured: false,
  verifiedAt: null,
  verifyOk: null,
  verifyError: null,
};

export function getSmtpDiagnostics(): SmtpDiagnostics {
  return {
    ...diagnostics,
    configured: smtpConfigured(),
  };
}

/** Trim + strip UTF-8 BOM (sometimes pasted into hosting env UIs). */
export function cleanEnv(v: string | undefined | null): string {
  if (v == null) return "";
  return String(v).replace(/^\uFEFF/, "").trim();
}

/** First non-empty connection URI (Nodemailer accepts these directly). */
export function getRawSmtpUrl(): string | undefined {
  const u =
    cleanEnv(process.env.SMTP_URL) ||
    cleanEnv(process.env.EMAIL_URL) ||
    cleanEnv(process.env.MAILER_DSN) ||
    cleanEnv(process.env.MAIL_URL);
  return u || undefined;
}

function tryParseUserFromSmtpUrl(): string | undefined {
  const url = getRawSmtpUrl();
  if (!url) return undefined;
  try {
    const u = new URL(url);
    if (u.username) return decodeURIComponent(u.username);
  } catch {
    /* ignore */
  }
  return undefined;
}

function tryParsePassFromSmtpUrl(): string {
  const url = getRawSmtpUrl();
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.password) return decodeURIComponent(u.password);
  } catch {
    /* ignore */
  }
  return "";
}

/** Resend HTTP API key (`re_…`). */
export function getResendApiKey(): string | undefined {
  return (
    cleanEnv(process.env.RESEND_API_KEY) ||
    cleanEnv(process.env.RESEND_KEY) ||
    undefined
  );
}

function isResendSmtpHost(hostOrUrl: string): boolean {
  return hostOrUrl.toLowerCase().includes("resend.com");
}

/** Sender shown to recipients (`Bestie <notifications@bestie.mx>`). Required for Resend. */
export function resolveFromAddress(): string | undefined {
  const explicit =
    cleanEnv(process.env.EMAIL_FROM) ||
    cleanEnv(process.env.SMTP_FROM) ||
    cleanEnv(process.env.RESEND_FROM);
  if (explicit) return explicit;
  const user = resolveSmtpUser();
  if (user && user.toLowerCase() !== "resend" && user.includes("@")) return user;
  return undefined;
}

/** Login / from address (supports common Railway-style `GMAIL_*` names and user embedded in `SMTP_URL`). */
export function resolveSmtpUser(): string | undefined {
  const u =
    cleanEnv(process.env.SMTP_USER) ||
    cleanEnv(process.env.GMAIL_USER) ||
    cleanEnv(process.env.GMAIL_ADDRESS) ||
    cleanEnv(process.env.GMAIL_EMAIL) ||
    tryParseUserFromSmtpUrl();
  return u || undefined;
}

/** Password or Google app password (spaces stripped); can come from `SMTP_URL` auth segment. */
export function resolveSmtpPass(): string | undefined {
  const raw =
    cleanEnv(process.env.SMTP_PASS) ||
    cleanEnv(process.env.GMAIL_APP_PASSWORD) ||
    cleanEnv(process.env.GMAIL_PASSWORD) ||
    cleanEnv(process.env.EMAIL_PASSWORD) ||
    cleanEnv(process.env.MAIL_PASSWORD) ||
    tryParsePassFromSmtpUrl();
  const n = normalizeSmtpPassword(raw);
  return n || undefined;
}

/** Use Gmail SMTP (implicit) when no `SMTP_HOST` but app-password style env is set or service says gmail. */
export function wantsImplicitGmail(): boolean {
  if ((getRawSmtpUrl()?.toLowerCase() ?? "").includes("gmail")) return true;
  const svc = cleanEnv(process.env.SMTP_SERVICE).toLowerCase();
  if (svc === "gmail" || svc === "google") return true;
  if (cleanEnv(process.env.GMAIL_APP_PASSWORD) || cleanEnv(process.env.GMAIL_PASSWORD)) return true;
  const u = resolveSmtpUser()?.toLowerCase() ?? "";
  if (u.endsWith("@gmail.com") || u.endsWith("@googlemail.com")) return true;
  return false;
}

/** For `/api/health` — how outbound mail is configured (no secrets). */
export function getSmtpMode():
  | "off"
  | "resend_api"
  | "resend_smtp"
  | "smtp_url"
  | "gmail_implicit"
  | "gmail_host"
  | "smtp_host" {
  if (!smtpConfigured()) return "off";
  if (getResendApiKey() && resolveFromAddress()) return "resend_api";
  const url = getRawSmtpUrl();
  if (url && isResendSmtpHost(url)) return "resend_smtp";
  if (url) return "smtp_url";
  const h = cleanEnv(process.env.SMTP_HOST).toLowerCase();
  if (isResendSmtpHost(h)) return "resend_smtp";
  if (h.includes("gmail.com")) return "gmail_host";
  if (cleanEnv(process.env.SMTP_HOST)) return "smtp_host";
  return "gmail_implicit";
}

/**
 * True when mail can be attempted:
 * - `RESEND_API_KEY` + `EMAIL_FROM` / `SMTP_FROM`, or
 * - `SMTP_URL` / `EMAIL_URL` / etc., or
 * - any `SMTP_HOST`, or
 * - Gmail-style credentials without host (`GMAIL_USER` + `GMAIL_APP_PASSWORD`, or `SMTP_SERVICE=gmail`, etc.).
 */
export function smtpConfigured(): boolean {
  if (getResendApiKey() && resolveFromAddress()) return true;
  if (getRawSmtpUrl()) return Boolean(resolveFromAddress());
  if (cleanEnv(process.env.SMTP_HOST)) return Boolean(resolveFromAddress() && resolveSmtpPass());
  const user = resolveSmtpUser();
  const pass = resolveSmtpPass();
  if (!user || !pass) return false;
  return wantsImplicitGmail();
}

function requireEnv(name: string): string {
  const v = cleanEnv(process.env[name]);
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

/** Google app passwords are shown with spaces; SMTP auth requires the 16 chars without spaces. */
export function normalizeSmtpPassword(pass: string): string {
  return pass.replace(/\s+/g, "").trim();
}

function sanitizeSmtpError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi, "[redacted]")
    .slice(0, 280);
}

function createGmailTransporter(): nodemailer.Transporter {
  const user = resolveSmtpUser();
  const pass = resolveSmtpPass();
  if (!user || !pass) {
    throw new Error("Missing SMTP_USER/GMAIL_USER or SMTP_PASS/GMAIL_APP_PASSWORD");
  }
  const authPass = normalizeSmtpPassword(pass);
  const rawPort = Number(process.env.SMTP_PORT);
  const port = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : 465;
  if (port === 465) {
    return nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass: authPass },
      connectionTimeout: 25_000,
      greetingTimeout: 20_000,
      socketTimeout: 40_000,
    });
  }
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass: authPass },
    connectionTimeout: 25_000,
    greetingTimeout: 20_000,
    socketTimeout: 40_000,
  });
}

function createGenericTransporter(): nodemailer.Transporter {
  const host = requireEnv("SMTP_HOST");
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = resolveSmtpUser();
  const pass = resolveSmtpPass();

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    ...(port === 587 ? { requireTLS: true } : {}),
    ...(user && pass ? { auth: { user, pass: normalizeSmtpPassword(pass) } } : {}),
    connectionTimeout: 25_000,
    greetingTimeout: 20_000,
    socketTimeout: 40_000,
  });
}

function createTransporter(): nodemailer.Transporter {
  const url = getRawSmtpUrl();
  if (url) {
    return nodemailer.createTransport(url);
  }
  const host = cleanEnv(process.env.SMTP_HOST);
  if (host && host.toLowerCase().includes("gmail.com")) {
    return createGmailTransporter();
  }
  if (host) {
    return createGenericTransporter();
  }
  if (wantsImplicitGmail()) {
    return createGmailTransporter();
  }
  throw new Error("SMTP transporter: missing configuration");
}

/** Log once at boot when SMTP is not configured (informational). */
export function logOutboundMailHintIfDisabled(): void {
  if (smtpConfigured()) return;
  console.warn(`[email] ${OUTBOUND_SMTP_SETUP_HINT}`);
}

/**
 * Verifies SMTP credentials at startup. Safe to call when SMTP is not configured (no-op).
 * Updates {@link getSmtpDiagnostics}.
 */
export async function verifySmtpConnection(): Promise<void> {
  diagnostics.configured = smtpConfigured();
  if (!smtpConfigured()) {
    diagnostics.verifyOk = null;
    diagnostics.verifyError = null;
    diagnostics.verifiedAt = null;
    return;
  }
  if (getResendApiKey() && resolveFromAddress()) {
    diagnostics.verifiedAt = new Date().toISOString();
    diagnostics.verifyOk = true;
    diagnostics.verifyError = null;
    console.log("[email] Resend API configured");
    return;
  }
  try {
    const t = createTransporter();
    await t.verify();
    diagnostics.verifiedAt = new Date().toISOString();
    diagnostics.verifyOk = true;
    diagnostics.verifyError = null;
    console.log("[email] SMTP verify OK");
  } catch (e) {
    diagnostics.verifiedAt = new Date().toISOString();
    diagnostics.verifyOk = false;
    diagnostics.verifyError = sanitizeSmtpError(e);
    console.error(`[email] SMTP verify FAILED: ${diagnostics.verifyError}`);
  }
}

export type SendTransactionalEmailOpts = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

async function sendViaResendApi(from: string, opts: SendTransactionalEmailOpts): Promise<boolean> {
  const key = getResendApiKey();
  if (!key) return false;
  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    ...(opts.text ? { text: opts.text } : {}),
  });
  if (error) {
    console.error(`[email] Resend send failed: ${sanitizeSmtpError(error)}`);
    return false;
  }
  if (data?.id) {
    console.log(`[email] Resend sent id=${data.id}`);
  }
  return true;
}

/** Send one outbound message when mail is configured; otherwise logs and returns false. */
export async function sendTransactionalEmail(opts: SendTransactionalEmailOpts): Promise<boolean> {
  if (!smtpConfigured()) {
    console.warn("[email] send skipped: outbound mail not configured");
    return false;
  }
  const from = resolveFromAddress();
  if (!from) {
    console.warn("[email] send skipped: no from address (set EMAIL_FROM or SMTP_FROM)");
    return false;
  }
  try {
    if (getResendApiKey()) {
      return await sendViaResendApi(from, opts);
    }
    const t = createTransporter();
    await t.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(opts.text ? { text: opts.text } : {}),
    });
    return true;
  } catch (e) {
    console.error(`[email] send failed: ${sanitizeSmtpError(e)}`);
    return false;
  }
}

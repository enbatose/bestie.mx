import nodemailer from "nodemailer";

/** Outcome of attempting to send the verification email (never throws for "no SMTP"). */
export type EmailDispatchStatus = "sent" | "skipped_no_smtp" | "failed";

export type SendVerificationResult = {
  status: EmailDispatchStatus;
  /** Short, sanitized reason for logs / optional API field (no secrets). */
  detail?: string;
};

export type SmtpDiagnostics = {
  configured: boolean;
  verifiedAt: string | null;
  verifyOk: boolean | null;
  verifyError: string | null;
  lastSendAt: string | null;
  lastSendStatus: EmailDispatchStatus | null;
  lastSendError: string | null;
};

/** Shown in `GET /api/health` when outbound mail is off (no secrets). */
export const OUTBOUND_SMTP_SETUP_HINT =
  "Set GMAIL_USER + GMAIL_APP_PASSWORD, or SMTP_URL (e.g. smtps://user:pass@smtp.gmail.com:465), on the **Node/API** service — not on the static front-end build.";

const diagnostics: SmtpDiagnostics = {
  configured: false,
  verifiedAt: null,
  verifyOk: null,
  verifyError: null,
  lastSendAt: null,
  lastSendStatus: null,
  lastSendError: null,
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
export function getSmtpMode(): "off" | "smtp_url" | "gmail_implicit" | "gmail_host" | "smtp_host" {
  if (!smtpConfigured()) return "off";
  if (getRawSmtpUrl()) return "smtp_url";
  const h = cleanEnv(process.env.SMTP_HOST).toLowerCase();
  if (h.includes("gmail.com")) return "gmail_host";
  if (cleanEnv(process.env.SMTP_HOST)) return "smtp_host";
  return "gmail_implicit";
}

/**
 * True when mail can be attempted:
 * - `SMTP_URL` / `EMAIL_URL` / etc., or
 * - any `SMTP_HOST`, or
 * - Gmail-style credentials without host (`GMAIL_USER` + `GMAIL_APP_PASSWORD`, or `SMTP_SERVICE=gmail`, etc.).
 */
export function smtpConfigured(): boolean {
  if (getRawSmtpUrl()) return true;
  if (cleanEnv(process.env.SMTP_HOST)) return true;
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

function isRetriableSmtpError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|ETLS|socket|GS01|452|451|450|4\.3\.2|try again/i.test(msg);
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

function resolveFromAddress(): string {
  const u = resolveSmtpUser();
  const gmailish = wantsImplicitGmail() || u?.toLowerCase().endsWith("@gmail.com");
  const fromDefault = u && gmailish ? `Bestie <${u}>` : "Bestie <no-reply@bestie.mx>";
  const explicit = cleanEnv(process.env.SMTP_FROM);
  return explicit || fromDefault;
}

/** Log once at boot when verification email cannot be sent (helps misconfigured PaaS env). */
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

async function sendWithRetry(send: () => Promise<void>): Promise<void> {
  const gaps = [0, 1_500, 4_000];
  let lastErr: unknown;
  for (let i = 0; i < gaps.length; i++) {
    if (gaps[i]! > 0) {
      await new Promise((r) => setTimeout(r, gaps[i]));
    }
    try {
      await send();
      return;
    } catch (e) {
      lastErr = e;
      if (!isRetriableSmtpError(e) || i === gaps.length - 1) {
        throw e;
      }
      console.warn(`[email] send retry ${i + 1}/${gaps.length}: ${sanitizeSmtpError(e)}`);
    }
  }
  throw lastErr;
}

export async function sendVerificationEmail(toEmail: string, verifyUrl: string): Promise<SendVerificationResult> {
  if (!smtpConfigured()) {
    diagnostics.lastSendAt = new Date().toISOString();
    diagnostics.lastSendStatus = "skipped_no_smtp";
    diagnostics.lastSendError = null;
    return { status: "skipped_no_smtp" };
  }

  const from = resolveFromAddress();
  const replyTo = cleanEnv(process.env.SMTP_REPLY_TO) || resolveSmtpUser();

  const subject = "Confirma tu correo — Bestie";
  const text =
    `Hola,\n\n` +
    `Para confirmar tu correo y activar tu cuenta, abre este enlace:\n\n` +
    `${verifyUrl}\n\n` +
    `Si tú no pediste este registro, puedes ignorar este mensaje.\n`;

  const html =
    `<p>Hola,</p>` +
    `<p>Para confirmar tu correo y activar tu cuenta, abre este enlace:</p>` +
    `<p><a href="${verifyUrl}">${verifyUrl}</a></p>` +
    `<p>Si tú no pediste este registro, puedes ignorar este mensaje.</p>`;

  try {
    await sendWithRetry(async () => {
      const transporter = createTransporter();
      await transporter.sendMail({
        from,
        to: toEmail,
        ...(replyTo ? { replyTo } : {}),
        subject,
        text,
        html,
        headers: {
          "X-Entity-Ref-ID": "bestie-verify",
        },
      });
    });
    diagnostics.lastSendAt = new Date().toISOString();
    diagnostics.lastSendStatus = "sent";
    diagnostics.lastSendError = null;
    console.log(`[email] verification sent to ${toEmail.replace(/(.{2}).*(@.*)/, "$1…$2")}`);
    return { status: "sent" };
  } catch (e) {
    const detail = sanitizeSmtpError(e);
    diagnostics.lastSendAt = new Date().toISOString();
    diagnostics.lastSendStatus = "failed";
    diagnostics.lastSendError = detail;
    console.error(`[email] verification send FAILED to=${toEmail.replace(/(.{2}).*(@.*)/, "$1…$2")}: ${detail}`);
    return { status: "failed", detail };
  }
}

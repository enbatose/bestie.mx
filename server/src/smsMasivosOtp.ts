/**
 * SMS Masivos OTP v2 — send/verify for Mexican (+52) numbers.
 * @see https://app.smsmasivos.com.mx/api-docs/otp
 */

const BASE = "https://api.smsmasivos.com.mx";
const COMPANY = "Bestie";
/** GSM-7, no accents. API requires both `{{code}}` and `{{company}}`. */
const MESSAGE = "{{code}} es tu codigo de {{company}}. No lo compartas.";

export type SmsMasivosSendResult =
  | { ok: true; sandbox: boolean; code?: string; resendAvailableIn?: number }
  | { ok: false; error: string; httpStatus?: number; resendAvailableIn?: number };

export type SmsMasivosVerifyResult =
  | { ok: true }
  | { ok: false; error: string; httpStatus?: number };

export function smsMasivosApiKey(): string {
  return process.env.SMSMASIVOS_API_KEY?.trim() ?? "";
}

export function smsMasivosConfigured(): boolean {
  return Boolean(smsMasivosApiKey());
}

export function smsMasivosSandboxEnabled(): boolean {
  return process.env.SMSMASIVOS_SANDBOX === "1";
}

function nationalFromE164(phoneE164: string): string | null {
  const d = phoneE164.replace(/\D/g, "");
  if (d.startsWith("52") && d.length === 12) return d.slice(2);
  if (d.length === 10) return d;
  return null;
}

export function smsMasivosNationalNumber(phoneE164: string): string | null {
  return nationalFromE164(phoneE164);
}

function expirationInTenMinutes(): string {
  const d = new Date(Date.now() + 10 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

async function postJson(path: string, body: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> }> {
  const key = smsMasivosApiKey();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}

export async function smsMasivosSendOtp(
  phoneE164: string,
  opts?: { rotate?: boolean },
): Promise<SmsMasivosSendResult> {
  if (!smsMasivosConfigured()) {
    return { ok: false, error: "smsmasivos_not_configured" };
  }
  const phone_number = nationalFromE164(phoneE164);
  if (!phone_number) {
    return { ok: false, error: "invalid_mx_phone" };
  }
  const sandbox = smsMasivosSandboxEnabled();
  const payload: Record<string, unknown> = {
    phone_number,
    country_code: "52",
    company: COMPANY,
    message: MESSAGE,
    channel: "sms",
    code_length: 6,
    code_format: "numeric",
    expiration_date: expirationInTenMinutes(),
  };
  if (opts?.rotate) payload.code_rotate = true;
  if (sandbox) {
    payload.sandbox = true;
    payload.code_in_response = true;
  }
  try {
    const { status, json } = await postJson("/v2/otp", payload);
    const resend =
      typeof json.resend_available_in === "number" ? json.resend_available_in : undefined;
    if (status === 201 || (status === 200 && json.success === true)) {
      const code = typeof json.code === "string" ? json.code : undefined;
      return { ok: true, sandbox, ...(code ? { code } : {}), resendAvailableIn: resend };
    }
    const error =
      (typeof json.error === "string" && json.error) ||
      (typeof json.message === "string" && json.message) ||
      `smsmasivos_http_${status}`;
    return { ok: false, error, httpStatus: status, resendAvailableIn: resend };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "smsmasivos_network" };
  }
}

export async function smsMasivosVerifyOtp(phoneE164: string, code: string): Promise<SmsMasivosVerifyResult> {
  if (!smsMasivosConfigured()) {
    return { ok: false, error: "smsmasivos_not_configured" };
  }
  const phone_number = nationalFromE164(phoneE164);
  if (!phone_number) {
    return { ok: false, error: "invalid_mx_phone" };
  }
  try {
    const { status, json } = await postJson("/v2/otp/verify", {
      phone_number,
      country_code: "52",
      code,
    });
    if (status === 200 && json.success !== false) {
      return { ok: true };
    }
    if (status === 409) {
      return { ok: true };
    }
    const error =
      (typeof json.error === "string" && json.error) ||
      (typeof json.message === "string" && json.message) ||
      `smsmasivos_http_${status}`;
    return { ok: false, error, httpStatus: status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "smsmasivos_network" };
  }
}

export type SmsMasivosSmsResult =
  | { ok: true; sandbox: boolean }
  | { ok: false; error: string; httpStatus?: number };

/** Transactional SMS (not OTP). Listing first-seeker notices must be ≤160 chars (SMS Masivos account cap). ARCO may be longer. */
export async function smsMasivosSendSms(
  phoneE164: string,
  message: string,
): Promise<SmsMasivosSmsResult> {
  if (!smsMasivosConfigured()) {
    return { ok: false, error: "smsmasivos_not_configured" };
  }
  const phone_number = nationalFromE164(phoneE164);
  if (!phone_number) {
    return { ok: false, error: "invalid_mx_phone" };
  }
  const text = message.trim().slice(0, 1600);
  if (!text) {
    return { ok: false, error: "empty_message" };
  }
  const sandbox = smsMasivosSandboxEnabled();
  const payload: Record<string, unknown> = {
    numbers: phone_number,
    message: text,
    country_code: "52",
  };
  if (sandbox) payload.sandbox = 1;
  try {
    const { status, json } = await postJson("/sms/send", payload);
    if (status >= 200 && status < 300 && json.success !== false) {
      return { ok: true, sandbox };
    }
    const error =
      (typeof json.error === "string" && json.error) ||
      (typeof json.message === "string" && json.message) ||
      `smsmasivos_http_${status}`;
    return { ok: false, error, httpStatus: status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "smsmasivos_network" };
  }
}

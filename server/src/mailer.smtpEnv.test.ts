import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TRANSACTIONAL_FROM,
  getRawSmtpUrl,
  getResendApiKey,
  getSmtpMode,
  normalizeTransactionalFrom,
  resolveFromAddress,
  resolveSmtpPass,
  resolveSmtpUser,
  smtpConfigured,
} from "./mailer.js";

describe("mailer SMTP env detection", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("treats SMTP_URL as configured (PaaS connection string)", () => {
    vi.stubEnv("SMTP_URL", "smtps://u%40gmail.com:secretpass@smtp.gmail.com:465");
    vi.stubEnv("SMTP_HOST", "");
    expect(smtpConfigured()).toBe(true);
    expect(getRawSmtpUrl()).toContain("smtp.gmail.com");
    expect(getSmtpMode()).toBe("smtp_url");
    expect(resolveSmtpUser()).toBe("u@gmail.com");
    expect(resolveSmtpPass()).toBe("secretpass");
  });

  it("treats GMAIL_USER + GMAIL_APP_PASSWORD as configured without SMTP_HOST", () => {
    vi.stubEnv("SMTP_URL", "");
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_SERVICE", "");
    vi.stubEnv("GMAIL_USER", "sender@gmail.com");
    vi.stubEnv("GMAIL_APP_PASSWORD", "abcd efgh ijkl mnop");
    expect(smtpConfigured()).toBe(true);
    expect(getSmtpMode()).toBe("gmail_implicit");
    expect(resolveSmtpUser()).toBe("sender@gmail.com");
    expect(resolveSmtpPass()).toBe("abcdefghijklmnop");
  });

  it("SMTP_SERVICE=gmail with SMTP_USER and SMTP_PASS (no host)", () => {
    vi.stubEnv("SMTP_URL", "");
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_SERVICE", "gmail");
    vi.stubEnv("SMTP_USER", "u@gmail.com");
    vi.stubEnv("SMTP_PASS", "aaaabbbbccccdddd");
    expect(smtpConfigured()).toBe(true);
    expect(getSmtpMode()).toBe("gmail_implicit");
  });

  it("not configured when only user is set", () => {
    vi.stubEnv("SMTP_URL", "");
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("GMAIL_USER", "x@gmail.com");
    vi.stubEnv("GMAIL_APP_PASSWORD", "");
    vi.stubEnv("SMTP_PASS", "");
    expect(smtpConfigured()).toBe(false);
    expect(getSmtpMode()).toBe("off");
  });

  it("treats RESEND_API_KEY + EMAIL_FROM as configured (API mode)", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "Bestie <notifications@bestie.mx>");
    expect(smtpConfigured()).toBe(true);
    expect(getSmtpMode()).toBe("resend_api");
    expect(getResendApiKey()).toBe("re_test_key");
    expect(resolveFromAddress()).toBe("Bestie <no-reply@bestie.mx>");
  });

  it("defaults From to Bestie MX no-reply when RESEND_API_KEY is set without EMAIL_FROM", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "");
    vi.stubEnv("SMTP_FROM", "");
    vi.stubEnv("RESEND_FROM", "");
    expect(smtpConfigured()).toBe(true);
    expect(getSmtpMode()).toBe("resend_api");
    expect(resolveFromAddress()).toBe(DEFAULT_TRANSACTIONAL_FROM);
  });

  it("normalizes Bestie-domain senders to no-reply@bestie.mx", () => {
    expect(normalizeTransactionalFrom("Bestie MX <notifications@bestie.mx>")).toBe(
      "Bestie MX <no-reply@bestie.mx>",
    );
    expect(normalizeTransactionalFrom("contacto@bestie.mx")).toBe(
      "Bestie MX <no-reply@bestie.mx>",
    );
    expect(normalizeTransactionalFrom("Me <me@gmail.com>")).toBe("Me <me@gmail.com>");
  });

  it("detects Resend SMTP host", () => {
    vi.stubEnv("SMTP_HOST", "smtp.resend.com");
    vi.stubEnv("SMTP_USER", "resend");
    vi.stubEnv("SMTP_PASS", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "Bestie <notifications@bestie.mx>");
    expect(smtpConfigured()).toBe(true);
    expect(getSmtpMode()).toBe("resend_smtp");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { getSmtpMode, resolveSmtpPass, resolveSmtpUser, smtpConfigured } from "./mailer.js";

describe("mailer SMTP env detection", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("treats GMAIL_USER + GMAIL_APP_PASSWORD as configured without SMTP_HOST", () => {
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
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_SERVICE", "gmail");
    vi.stubEnv("SMTP_USER", "u@gmail.com");
    vi.stubEnv("SMTP_PASS", "aaaabbbbccccdddd");
    expect(smtpConfigured()).toBe(true);
    expect(getSmtpMode()).toBe("gmail_implicit");
  });

  it("not configured when only user is set", () => {
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("GMAIL_USER", "x@gmail.com");
    vi.stubEnv("GMAIL_APP_PASSWORD", "");
    vi.stubEnv("SMTP_PASS", "");
    expect(smtpConfigured()).toBe(false);
    expect(getSmtpMode()).toBe("off");
  });
});

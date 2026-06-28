import { afterEach, describe, expect, it, vi } from "vitest";
import { formatResendSendError, logResendSendError } from "./mailer.js";

describe("Resend send error logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("flags daily quota exceeded", () => {
    const f = formatResendSendError({
      name: "daily_quota_exceeded",
      statusCode: 429,
      message: "You have reached your daily email quota.",
    });
    expect(f.isQuotaOrRateLimit).toBe(true);
    expect(f.code).toBe("daily_quota_exceeded");
  });

  it("flags monthly quota exceeded", () => {
    const f = formatResendSendError({
      name: "monthly_quota_exceeded",
      statusCode: 429,
      message: "You have reached your monthly email quota.",
    });
    expect(f.isQuotaOrRateLimit).toBe(true);
    expect(f.code).toBe("monthly_quota_exceeded");
  });

  it("logs daily quota with guidance", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    logResendSendError({
      name: "daily_quota_exceeded",
      statusCode: 429,
      message: "You have reached your daily email quota.",
    });
    expect(err).toHaveBeenCalledWith(
      expect.stringContaining("[email] Resend daily quota exceeded HTTP 429"),
    );
    expect(err.mock.calls[0]?.[0]).toContain("100/day");
  });

  it("logs generic failures without quota wording", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    logResendSendError({
      name: "validation_error",
      statusCode: 422,
      message: "Invalid from address",
    });
    expect(err).toHaveBeenCalledWith(
      expect.stringContaining("[email] Resend send failed HTTP 422 (validation_error)"),
    );
  });
});

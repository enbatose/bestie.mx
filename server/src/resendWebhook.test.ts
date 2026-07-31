import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONTACT_INBOUND_ADDRESS,
  DEFAULT_CONTACT_FORWARD_TO,
  getResendInboundDiagnostics,
  getResendReceivingApiKey,
  matchesInboundAddress,
  normalizeEmailAddress,
  resolveContactForwardFrom,
  resolveContactForwardTo,
  shouldForwardInbound,
} from "./resendWebhook.js";

describe("resendWebhook inbound routing", () => {
  it("normalizes display-name addresses", () => {
    expect(normalizeEmailAddress("Bestie Contacto <contacto@bestie.mx>")).toBe(
      "contacto@bestie.mx",
    );
    expect(normalizeEmailAddress("  CONTACTO@bestie.mx  ")).toBe("contacto@bestie.mx");
  });

  it("matches contacto@bestie.mx in recipient lists", () => {
    expect(matchesInboundAddress(["contacto@bestie.mx"], CONTACT_INBOUND_ADDRESS)).toBe(true);
    expect(
      matchesInboundAddress(["Bestie <contacto@bestie.mx>"], CONTACT_INBOUND_ADDRESS),
    ).toBe(true);
    expect(matchesInboundAddress(["support@bestie.mx"], CONTACT_INBOUND_ADDRESS)).toBe(false);
  });

  it("forwards only contacto@bestie.mx", () => {
    expect(shouldForwardInbound(["contacto@bestie.mx"])).toBe(true);
    expect(shouldForwardInbound(["Bestie <contacto@bestie.mx>"])).toBe(true);
    expect(shouldForwardInbound(["Bestie <soporte@bestie.mx>"])).toBe(false);
    expect(shouldForwardInbound(["privacy@bestie.mx"])).toBe(false);
    expect(shouldForwardInbound(["support@bestie.mx"])).toBe(false);
    expect(shouldForwardInbound(["random@bestie.mx"])).toBe(false);
    expect(shouldForwardInbound(["someone@gmail.com"])).toBe(false);
  });

  it("defaults forward target and from address", () => {
    expect(resolveContactForwardTo()).toBe(DEFAULT_CONTACT_FORWARD_TO);
    expect(resolveContactForwardFrom()).toBe(`Bestie Contacto <${CONTACT_INBOUND_ADDRESS}>`);
  });

  it("uses receiving or admin keys, never sending-only RESEND_API_KEY", () => {
    vi.stubEnv("RESEND_RECEIVING_API_KEY", "");
    vi.stubEnv("RESEND_ADMIN_API_KEY", "");
    vi.stubEnv("RESEND_API_KEY", "re_sending_key");
    expect(getResendReceivingApiKey()).toBeUndefined();

    vi.stubEnv("RESEND_ADMIN_API_KEY", "re_admin_key");
    expect(getResendReceivingApiKey()).toBe("re_admin_key");

    vi.stubEnv("RESEND_RECEIVING_API_KEY", "re_receiving_key");
    expect(getResendReceivingApiKey()).toBe("re_receiving_key");
  });

  it("exposes inbound diagnostics without secrets", () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "whsec_test");
    vi.stubEnv("RESEND_RECEIVING_API_KEY", "re_receiving_key");
    vi.stubEnv("RESEND_CONTACT_FORWARD_TO", "ops@example.com");
    const d = getResendInboundDiagnostics();
    expect(d.webhookConfigured).toBe(true);
    expect(d.receivingKeyConfigured).toBe(true);
    expect(d.forwardTo).toBe("ops@example.com");
    expect(d.inboundAddresses).toEqual([CONTACT_INBOUND_ADDRESS]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });
});

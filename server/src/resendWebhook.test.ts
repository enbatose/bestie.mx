import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONTACT_INBOUND_ADDRESS,
  DEFAULT_CONTACT_FORWARD_TO,
  EXTRA_INBOUND_FORWARD_ADDRESSES,
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

  it("forwards contacto and support aliases", () => {
    expect(shouldForwardInbound(["contacto@bestie.mx"])).toBe(true);
    expect(shouldForwardInbound(["Bestie <soporte@bestie.mx>"])).toBe(true);
    expect(shouldForwardInbound(["privacy@bestie.mx"])).toBe(true);
    expect(shouldForwardInbound(["random@bestie.mx"])).toBe(false);
    expect(shouldForwardInbound(["someone@gmail.com"])).toBe(false);
    expect(EXTRA_INBOUND_FORWARD_ADDRESSES).toContain("soporte@bestie.mx");
  });

  it("defaults forward target and from address", () => {
    expect(resolveContactForwardTo()).toBe(DEFAULT_CONTACT_FORWARD_TO);
    expect(resolveContactForwardFrom()).toBe(`Bestie Contacto <${CONTACT_INBOUND_ADDRESS}>`);
  });

  it("prefers RESEND_RECEIVING_API_KEY over sending-only RESEND_API_KEY", () => {
    vi.stubEnv("RESEND_RECEIVING_API_KEY", "re_receiving_key");
    vi.stubEnv("RESEND_API_KEY", "re_sending_key");
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
    expect(d.inboundAddresses).toContain(CONTACT_INBOUND_ADDRESS);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });
});

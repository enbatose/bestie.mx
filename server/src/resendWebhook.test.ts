import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONTACT_INBOUND_ADDRESS,
  DEFAULT_CONTACT_FORWARD_TO,
  getResendReceivingApiKey,
  matchesInboundAddress,
  normalizeEmailAddress,
  resolveContactForwardFrom,
  resolveContactForwardTo,
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

  it("defaults forward target and from address", () => {
    expect(resolveContactForwardTo()).toBe(DEFAULT_CONTACT_FORWARD_TO);
    expect(resolveContactForwardFrom()).toBe(`Bestie Contacto <${CONTACT_INBOUND_ADDRESS}>`);
  });

  it("prefers RESEND_RECEIVING_API_KEY over sending-only RESEND_API_KEY", () => {
    vi.stubEnv("RESEND_RECEIVING_API_KEY", "re_receiving_key");
    vi.stubEnv("RESEND_API_KEY", "re_sending_key");
    expect(getResendReceivingApiKey()).toBe("re_receiving_key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });
});

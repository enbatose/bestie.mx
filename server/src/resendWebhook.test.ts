import { describe, expect, it } from "vitest";
import {
  CONTACT_INBOUND_ADDRESS,
  DEFAULT_CONTACT_FORWARD_TO,
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
});

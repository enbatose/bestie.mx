import { describe, expect, it } from "vitest";
import {
  inferRegistrationSourceFromRow,
  REGISTRATION_SOURCE_LABELS,
} from "./registrationSource.js";
import {
  firstNameFromDisplayName,
  isWhatsAppPlaceholderDisplayName,
  parseWhatsAppProvidedName,
} from "./whatsappDisplayName.js";

describe("registrationSource", () => {
  it("infers channel from password markers and phone/email", () => {
    expect(inferRegistrationSourceFromRow({ password_hash: "wa-only-no-password" })).toBe("whatsapp");
    expect(inferRegistrationSourceFromRow({ password_hash: "google-oauth-no-password" })).toBe("google");
    expect(inferRegistrationSourceFromRow({ password_hash: "facebook-oauth-no-password" })).toBe(
      "facebook",
    );
    expect(
      inferRegistrationSourceFromRow({ password_hash: "x", phone_e164: "+523311111111", email: null }),
    ).toBe("phone");
    expect(
      inferRegistrationSourceFromRow({ password_hash: "x", phone_e164: null, email: "a@b.mx" }),
    ).toBe("email");
  });

  it("exposes admin labels", () => {
    expect(REGISTRATION_SOURCE_LABELS.whatsapp).toBe("WhatsApp");
    expect(REGISTRATION_SOURCE_LABELS.phone).toBe("Celular");
  });
});

describe("whatsappDisplayName", () => {
  it("detects placeholders and parses names", () => {
    expect(isWhatsAppPlaceholderDisplayName("Usuario WhatsApp")).toBe(true);
    expect(isWhatsAppPlaceholderDisplayName("Usuario de WhatsApp")).toBe(true);
    expect(isWhatsAppPlaceholderDisplayName("María")).toBe(false);
    expect(parseWhatsAppProvidedName("  María López  ")).toBe("María López");
    expect(parseWhatsAppProvidedName("saltar")).toBe(null);
    expect(firstNameFromDisplayName("María López")).toBe("María");
  });
});

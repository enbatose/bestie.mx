import { describe, expect, it } from "vitest";
import { buildArcoErasureEmail, buildArcoWhatsAppConfirmation } from "./arcoErasureEmail.js";

describe("arcoErasureEmail", () => {
  it("names ARCO and LFPDPPP, and invites the person back", () => {
    const mail = buildArcoErasureEmail({ displayName: "Alexa" });
    expect(mail.subject).toMatch(/ARCO/i);
    expect(mail.html).toContain("Alexa");
    expect(mail.html).toContain("LFPDPPP");
    expect(mail.html).toContain("cancelación");
    expect(mail.html).toContain("Acceso, Rectificación, Cancelación y Oposición");
    expect(mail.html).toContain("tenerte de vuelta");
    expect(mail.text).toContain("cuenta nueva");
    expect(mail.tags?.some((t) => t.name === "category" && t.value === "arco_erasure")).toBe(true);
  });

  it("builds a paste-ready WhatsApp confirmation", () => {
    const text = buildArcoWhatsAppConfirmation("Alexa Castelao");
    expect(text).toContain("Hola Alexa");
    expect(text).toContain("ARCO");
    expect(text).toContain("LFPDPPP");
    expect(text).toContain("cuenta nueva");
  });
});

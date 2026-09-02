import { describe, expect, it } from "vitest";
import { buildArcoErasureEmail, buildArcoSmsConfirmation, buildArcoWhatsAppConfirmation, ARCO_CONFIRMATION_BCC } from "./arcoErasureEmail.js";

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
    expect(mail.html).toContain("contacto@bestie.mx");
    expect(mail.text).toContain("contacto@bestie.mx");
    expect(mail.tags?.some((t) => t.name === "category" && t.value === "arco_erasure")).toBe(true);
  });

  it("builds a paste-ready WhatsApp confirmation", () => {
    const text = buildArcoWhatsAppConfirmation("Alexa Castelao");
    expect(text).toContain("Hola Alexa");
    expect(text).toContain("ARCO");
    expect(text).toContain("LFPDPPP");
    expect(text).toContain("cuenta nueva");
  });

  it("keeps the SMS confirmation short and ARCO-named", () => {
    const sms = buildArcoSmsConfirmation();
    expect(sms).toContain("ARCO");
    expect(sms).toContain("LFPDPPP");
    expect(sms).toContain("bestie.mx");
    expect(sms.length).toBeLessThan(320);
  });

  it("BCC goes to the operator inbox", () => {
    expect(ARCO_CONFIRMATION_BCC).toBe("contacto@bestie.mx");
  });
});

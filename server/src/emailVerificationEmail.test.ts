import { describe, expect, it } from "vitest";
import { emailVerificationSubject, buildEmailVerificationEmail } from "./emails/emailVerificationEmail.js";

describe("emailVerificationEmail", () => {
  it("uses a short subject with the 6-digit code for mobile preview", () => {
    const subject = emailVerificationSubject("482931");
    expect(subject).toBe("Bestie · código 482931");
    expect(subject.length).toBeLessThanOrEqual(24);
    expect(subject).toContain("482931");
  });

  it("includes copy links, brand chrome, preview text, and the code", () => {
    const mail = buildEmailVerificationEmail({ code: "123456", displayName: "Ana" });
    expect(mail.html).toContain("123456");
    expect(mail.text).toContain("123456");
    expect(mail.html).toContain("Copiar código");
    expect(mail.html).toContain("/verificar-correo?code=123456");
    expect(mail.html).toContain("copy=1");
    expect(mail.html).toContain("spam");
    expect(mail.html).toContain("#143D30");
    expect(mail.html).toContain("#84CC16");
    expect(mail.previewText).toContain("123456");
    expect(mail.replyTo).toBe("contacto@bestie.mx");
    expect(mail.subject).toBe("Bestie · código 123456");
  });
});

import { describe, expect, it } from "vitest";
import { buildPasswordResetEmail, passwordResetEmailSubject } from "./emails/passwordResetEmail.js";

describe("passwordResetEmail", () => {
  it("uses a concise subject", () => {
    expect(passwordResetEmailSubject()).toBe("Bestie · restablecer contraseña");
  });

  it("includes the profile edit reset link and brand chrome", () => {
    const url = "https://www.bestie.mx/perfil/editar?reset=abc123";
    const mail = buildPasswordResetEmail({ resetUrl: url, displayName: "Ana" });
    expect(mail.html).toContain(url);
    expect(mail.text).toContain(url);
    expect(mail.html).toContain("spam");
    expect(mail.html).toContain("#143D30");
    expect(mail.previewText.toLowerCase()).toContain("1 hora");
    expect(mail.replyTo).toBe("contacto@bestie.mx");
  });
});

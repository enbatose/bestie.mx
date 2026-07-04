import { describe, expect, it } from "vitest";
import { emailVerificationSubject, buildEmailVerificationEmail } from "./emails/emailVerificationEmail.js";

describe("emailVerificationEmail", () => {
  it("uses a short subject with the 6-digit code for mobile preview", () => {
    const subject = emailVerificationSubject("482931");
    expect(subject).toBe("Bestie · código 482931");
    expect(subject.length).toBeLessThanOrEqual(24);
    expect(subject).toContain("482931");
  });

  it("includes the code in html and text bodies", () => {
    const mail = buildEmailVerificationEmail({ code: "123456", displayName: "Ana" });
    expect(mail.html).toContain("123456");
    expect(mail.text).toContain("123456");
    expect(mail.html).toContain("spam");
    expect(mail.subject).toBe("Bestie · código 123456");
  });
});

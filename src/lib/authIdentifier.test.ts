import { describe, expect, it } from "vitest";
import { classifyAuthIdentifier, looksLikePhoneInput } from "@/lib/authIdentifier";

describe("classifyAuthIdentifier", () => {
  it("detects email", () => {
    expect(classifyAuthIdentifier("  Batani.enrique@gmail.com ")).toEqual({
      kind: "email",
      email: "batani.enrique@gmail.com",
    });
  });

  it("detects MX phone in several paste formats", () => {
    expect(classifyAuthIdentifier("3318632070")).toEqual({ kind: "phone", phone: "3318632070" });
    expect(classifyAuthIdentifier("+52 33 1863 2070")).toEqual({ kind: "phone", phone: "3318632070" });
    expect(classifyAuthIdentifier("52 3318632070")).toEqual({ kind: "phone", phone: "3318632070" });
  });

  it("stays undetermined until the value is complete", () => {
    expect(classifyAuthIdentifier("")).toEqual({ kind: "undetermined" });
    expect(classifyAuthIdentifier("user@")).toEqual({ kind: "undetermined" });
    expect(classifyAuthIdentifier("331")).toEqual({ kind: "undetermined" });
  });
});

describe("looksLikePhoneInput", () => {
  it("is true for digit-leading values without @", () => {
    expect(looksLikePhoneInput("331")).toBe(true);
    expect(looksLikePhoneInput("+52")).toBe(true);
    expect(looksLikePhoneInput("(33) 1863 2070")).toBe(true);
    expect(looksLikePhoneInput("user@x.com")).toBe(false);
  });
});

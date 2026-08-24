import { describe, expect, it } from "vitest";
import {
  extractFirstMxPhoneFromText,
  normalizeMxNationalDigits,
  phoneDigitsForStorage,
} from "@/lib/mxPhone";

describe("mxPhone", () => {
  it("normalizes 10-digit MX national numbers", () => {
    expect(normalizeMxNationalDigits("33 1234 5678")).toBe("3312345678");
    expect(normalizeMxNationalDigits("+52 33 1234 5678")).toBe("3312345678");
    expect(normalizeMxNationalDigits("5213312345678")).toBe("3312345678");
  });

  it("stores as 52 + 10 digits", () => {
    expect(phoneDigitsForStorage("3312345678")).toBe("523312345678");
  });

  it("extracts the first labeled or bare phone from paste text", () => {
    const text = "Renta 4500\nWhatsApp: 33-9876-5432\nOtro 5511112222";
    expect(extractFirstMxPhoneFromText(text)).toBe("523398765432");
  });
});

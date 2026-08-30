import { describe, expect, it } from "vitest";
import {
  extractFirstMxPhoneFromText,
  normalizeMxNationalDigits,
  parseListingPhoneParts,
  phoneDigitsForStorage,
  whatsAppMeHref,
} from "@/lib/mxPhone";

describe("mxPhone", () => {
  it("normalizes 10-digit MX national numbers", () => {
    expect(normalizeMxNationalDigits("33 1234 5678")).toBe("3312345678");
    expect(normalizeMxNationalDigits("+52 33 1234 5678")).toBe("3312345678");
    expect(normalizeMxNationalDigits("5213312345678")).toBe("3312345678");
  });

  it("does not treat a leaked 52 as a 10-digit MX national number", () => {
    expect(normalizeMxNationalDigits("5252331863")).toBeNull();
    expect(phoneDigitsForStorage("5252331863")).toBe("5252331863");
    expect(phoneDigitsForStorage("3312345678")).toBe("523312345678");
  });

  it("splits listing phone parts without stuffing 52 into the national field", () => {
    expect(parseListingPhoneParts("523312345678")).toEqual({
      dial: "52",
      national: "3312345678",
      nationalLen: 10,
    });
    expect(parseListingPhoneParts("5252331863")).toEqual({
      dial: "52",
      national: "52331863",
      nationalLen: 10,
    });
    expect(parseListingPhoneParts("525252331863")).toEqual({
      dial: "52",
      national: "52331863",
      nationalLen: 10,
    });
    expect(parseListingPhoneParts("3312345678")).toEqual({
      dial: "52",
      national: "3312345678",
      nationalLen: 10,
    });
    expect(parseListingPhoneParts("12125551234").dial).toBe("1");
    expect(parseListingPhoneParts("12125551234").national).toBe("2125551234");
  });

  it("extracts the first labeled or bare phone from paste text", () => {
    const text = "Renta 4500\nWhatsApp: 33-9876-5432\nOtro 5511112222";
    expect(extractFirstMxPhoneFromText(text)).toBe("523398765432");
  });

  it("builds a wa.me chat URL with a leading plus", () => {
    expect(whatsAppMeHref("3329306218")).toBe("https://wa.me/+523329306218");
    expect(whatsAppMeHref("+52 33 2930 6218")).toBe("https://wa.me/+523329306218");
    expect(whatsAppMeHref("")).toBeNull();
  });
});

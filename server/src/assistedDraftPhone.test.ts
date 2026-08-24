import { describe, expect, it } from "vitest";
import { resolveAssistedDraftContactPhone } from "./assistedDraftGemini.js";

describe("resolveAssistedDraftContactPhone", () => {
  it("prefers high-confidence Gemini phone", () => {
    expect(
      resolveAssistedDraftContactPhone({
        contactPhoneField: { value: "33 1234 5678", confidence: 90 },
        sourceText: "WhatsApp 55 9999 8888",
      }),
    ).toBe("523312345678");
  });

  it("falls back to first phone in pasted text", () => {
    expect(
      resolveAssistedDraftContactPhone({
        sourceText: "Renta 4k\nCel: 3311112222\nOtro 5599998888",
      }),
    ).toBe("523311112222");
  });

  it("falls back to model raw text for image-only OCR", () => {
    expect(
      resolveAssistedDraftContactPhone({
        modelRawText: '{"contactPhone":{"value":"5598765432","confidence":35}}',
      }),
    ).toBe("525598765432");
  });
});

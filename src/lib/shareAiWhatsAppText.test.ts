import { describe, expect, it } from "vitest";
import { toWhatsAppSafeShareText } from "./shareAiWhatsAppText";

describe("toWhatsAppSafeShareText", () => {
  it("remaps colorful share emojis to BMP marks", () => {
    const colorful = [
      "Hola \u{1F3E0}",
      "\u{1F440} Vigilancia",
      "\u{1F373} Cocina equipada",
      "\u{1F517} https://dev.bestie.mx/anuncio/AA45570DB",
    ].join("\n");
    const safe = toWhatsAppSafeShareText(colorful);
    expect(safe).toContain("Hola \u{2605}");
    expect(safe).toContain("\u{25C9} Vigilancia");
    expect(safe).toContain("\u{2615} Cocina equipada");
    expect(safe).toContain("\u{27A1} https://dev.bestie.mx/anuncio/AA45570DB");
    expect([...safe].every((ch) => (ch.codePointAt(0) ?? 0) <= 0xffff)).toBe(true);
  });
});

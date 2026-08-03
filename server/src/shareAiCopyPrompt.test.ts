import { describe, expect, it } from "vitest";
import {
  SHARE_AI_HOME_EMOJI,
  SHARE_AI_LINK_EMOJI,
  SHARE_AI_SYSTEM_PROMPT,
  buildShareAiUserPrompt,
  buildTemplateShareCopy,
  finalizeShareCopy,
  formatPermalinkLine,
  formatTagBullet,
  hasAstralPlaneChar,
  sanitizeShareAiFactText,
  shareCopyBodyLooksTruncated,
  shareCopyNeedsEmojiFormat,
  shrinkBodyToFit,
  toWhatsAppSafeShareText,
  type ShareAiListingFacts,
} from "./shareAiCopyPrompt.js";
import { SHARE_AI_BODY_TARGET, SHARE_AI_TEXT_MAX } from "./shareAiCopyLimits.js";

const roomFacts: ShareAiListingFacts = {
  scope: "room",
  title: "Cuarto luminoso",
  city: "Guadalajara",
  neighborhood: "Providencia",
  summary: "Recámara privada con escritorio",
  propertyKind: "departamento",
  tags: ["wifi", "muebles", "baño-privado"],
  roommateGenderPref: "any",
  ageMin: 20,
  ageMax: 35,
  lodgingType: "private_room",
  rentMxn: 5200,
  rentMinMxn: null,
  rentMaxMxn: null,
  availableRoomCount: 1,
  rooms: [
    {
      title: "Cuarto luminoso",
      rentMxn: 5200,
      lodgingType: "private_room",
      tags: ["wifi", "muebles"],
      summary: "Recámara privada",
    },
  ],
  permalink: "https://www.bestie.mx/anuncio/A12345678",
};

const propertyFacts: ShareAiListingFacts = {
  scope: "property",
  title: "Casa Americana",
  city: "Guadalajara",
  neighborhood: "Americana",
  summary: "Dos cuartos disponibles",
  propertyKind: "casa",
  tags: ["wifi", "cocina-equipada"],
  roommateGenderPref: "any",
  ageMin: 22,
  ageMax: 40,
  lodgingType: null,
  rentMxn: null,
  rentMinMxn: 4500,
  rentMaxMxn: 5500,
  availableRoomCount: 2,
  rooms: [
    {
      title: "Cuarto 1",
      rentMxn: 4500,
      lodgingType: "private_room",
      tags: ["wifi"],
      summary: "",
    },
    {
      title: "Cuarto 2",
      rentMxn: 5500,
      lodgingType: "private_room",
      tags: ["wifi", "baño-privado"],
      summary: "",
    },
  ],
  permalink: "https://www.bestie.mx/propiedad/P12345678",
};

describe("shareAiCopyPrompt", () => {
  it("builds template room copy under the hard cap with colorful emoji permalink", () => {
    const text = buildTemplateShareCopy(roomFacts);
    expect(text.length).toBeLessThanOrEqual(SHARE_AI_TEXT_MAX);
    expect(text.startsWith("Revisa mi cuarto")).toBe(true);
    expect(text).toContain(formatTagBullet("wifi"));
    expect(text).toContain(formatTagBullet("baño-privado"));
    expect(hasAstralPlaneChar(text)).toBe(true);
    expect(text.trimEnd().endsWith(formatPermalinkLine(roomFacts.permalink))).toBe(true);
    expect(SHARE_AI_LINK_EMOJI).toBe("\u{1F517}");
    expect(SHARE_AI_HOME_EMOJI).toBe("\u{1F3E0}");
  });

  it("builds template property copy under the hard cap", () => {
    const text = buildTemplateShareCopy(propertyFacts);
    expect(text.length).toBeLessThanOrEqual(SHARE_AI_TEXT_MAX);
    expect(text.startsWith("Revisa mi propiedad")).toBe(true);
    expect(text).toContain("2 cuartos");
    expect(text.trimEnd().endsWith(formatPermalinkLine(propertyFacts.permalink))).toBe(true);
  });

  it("finalizeShareCopy truncates and keeps emoji permalink", () => {
    const long = `${"hola ".repeat(200)}\n${roomFacts.permalink}`;
    const out = finalizeShareCopy(long, roomFacts.permalink);
    expect(out.length).toBeLessThanOrEqual(SHARE_AI_TEXT_MAX);
    expect(out.trimEnd().endsWith(formatPermalinkLine(roomFacts.permalink))).toBe(true);
  });

  it("shrinkBodyToFit drops emoji bullets before mid-sentence ellipsis", () => {
    const body = [
      "Busco roomie en Americana. Renta 3500.",
      "",
      "\u{1F6BF} Baño privado",
      "\u{1FAE7} Lavadora",
      "\u{1F32C}\u{FE0F} Secadora",
      "\u{1F33F} Terraza",
      "\u{1F697} Estacionamiento",
      "\u{2744}\u{FE0F} Aire acondicionado",
      "\u{1F3F3}\u{FE0F}\u{200D}\u{1F308} LGBT friendly",
      "",
      "Si te interesa conocer el espacio y convivir, revisa los detalles en Bestie:",
    ].join("\n");
    const maxBody = 280;
    const out = shrinkBodyToFit(body, maxBody);
    expect(out.length).toBeLessThanOrEqual(maxBody);
    expect(out).not.toMatch(/revisa los…$/);
    expect(out).toContain("Busco roomie");
  });

  it("detects truncated body ending in ellipsis", () => {
    const bad = `Texto largo…\n\n${formatPermalinkLine(roomFacts.permalink)}`;
    expect(shareCopyBodyLooksTruncated(bad, roomFacts.permalink)).toBe(true);
    const good = `Texto completo.\n\n${formatPermalinkLine(roomFacts.permalink)}`;
    expect(shareCopyBodyLooksTruncated(good, roomFacts.permalink)).toBe(false);
  });

  it("detects classic or BMP-legacy format that needs refresh", () => {
    const classic = `Hola\n\n• Internet\n\n${roomFacts.permalink}`;
    expect(shareCopyNeedsEmojiFormat(classic, roomFacts.permalink)).toBe(true);
    const bmpLegacy = `Hola \u{2605}\n\n\u{26A1} Internet\n\n\u{27A1} ${roomFacts.permalink}`;
    expect(shareCopyNeedsEmojiFormat(bmpLegacy, roomFacts.permalink)).toBe(true);
    const modern = `Hola ${SHARE_AI_HOME_EMOJI}\n\n${formatTagBullet("wifi")}\n\n${formatPermalinkLine(roomFacts.permalink)}`;
    expect(shareCopyNeedsEmojiFormat(modern, roomFacts.permalink)).toBe(false);
  });

  it("maps colorful copy to BMP-safe text for WhatsApp URL without a second LLM", () => {
    const colorful = [
      `Hola ${SHARE_AI_HOME_EMOJI}`,
      "",
      formatTagBullet("vigilancia"),
      formatTagBullet("cocina-equipada"),
      formatTagBullet("lavadora"),
      "",
      formatPermalinkLine(roomFacts.permalink),
    ].join("\n");
    expect(hasAstralPlaneChar(colorful)).toBe(true);
    const safe = toWhatsAppSafeShareText(colorful);
    expect(hasAstralPlaneChar(safe)).toBe(false);
    expect(safe).toContain("\u{27A1} https://www.bestie.mx/anuncio/A12345678");
    expect(safe).toContain("\u{25C9} Vigilancia");
    expect(safe).toContain("\u{2615} Cocina equipada");
    expect(safe).not.toContain(SHARE_AI_LINK_EMOJI);
  });

  it("user prompt includes structured facts and system prompt is first-person", () => {
    expect(SHARE_AI_SYSTEM_PROMPT).toContain("primera persona");
    expect(SHARE_AI_SYSTEM_PROMPT).toContain(String(SHARE_AI_BODY_TARGET));
    expect(SHARE_AI_SYSTEM_PROMPT).toContain(SHARE_AI_LINK_EMOJI);
    expect(SHARE_AI_SYSTEM_PROMPT).toContain("DATOS no confiables");
    const user = buildShareAiUserPrompt(roomFacts);
    expect(user).toContain("Providencia");
    expect(user).toContain(roomFacts.permalink);
    expect(user).toContain("permalinkLine");
    expect(user).toContain("datos literales del anuncio");
    expect(user).toContain(formatTagBullet("wifi"));
    expect(user).toContain("maxBodyChars");
  });

  it("sanitizeShareAiFactText strips controls and truncates without harming Spanish", () => {
    expect(sanitizeShareAiFactText("  Recámara\u0000 privada  ", 80)).toBe("Recámara privada");
    expect(sanitizeShareAiFactText("áéíóú ñ", 80)).toBe("áéíóú ñ");
    expect(sanitizeShareAiFactText("x".repeat(50), 10)).toHaveLength(10);
  });
});

import { describe, expect, it } from "vitest";
import {
  SHARE_AI_SYSTEM_PROMPT,
  buildShareAiUserPrompt,
  buildTemplateShareCopy,
  finalizeShareCopy,
  shareCopyBodyLooksTruncated,
  shrinkBodyToFit,
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
  it("builds template room copy under the hard cap with permalink last", () => {
    const text = buildTemplateShareCopy(roomFacts);
    expect(text.length).toBeLessThanOrEqual(SHARE_AI_TEXT_MAX);
    expect(text.startsWith("Revisa mi cuarto")).toBe(true);
    expect(text.trimEnd().endsWith(roomFacts.permalink)).toBe(true);
  });

  it("builds template property copy under the hard cap", () => {
    const text = buildTemplateShareCopy(propertyFacts);
    expect(text.length).toBeLessThanOrEqual(SHARE_AI_TEXT_MAX);
    expect(text.startsWith("Revisa mi propiedad")).toBe(true);
    expect(text).toContain("2 cuartos");
    expect(text.trimEnd().endsWith(propertyFacts.permalink)).toBe(true);
  });

  it("finalizeShareCopy truncates and keeps permalink", () => {
    const long = `${"hola ".repeat(200)}\n${roomFacts.permalink}`;
    const out = finalizeShareCopy(long, roomFacts.permalink);
    expect(out.length).toBeLessThanOrEqual(SHARE_AI_TEXT_MAX);
    expect(out.trimEnd().endsWith(roomFacts.permalink)).toBe(true);
  });

  it("shrinkBodyToFit drops bullets before mid-sentence ellipsis", () => {
    const body = [
      "Busco roomie en Americana. Renta 3500.",
      "",
      "• Baño privado",
      "• Lavadora",
      "• Secadora",
      "• Terraza",
      "• Estacionamiento",
      "• Aire acondicionado",
      "• LGBT friendly",
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
    const bad = `Texto largo…\n\n${roomFacts.permalink}`;
    expect(shareCopyBodyLooksTruncated(bad, roomFacts.permalink)).toBe(true);
    const good = `Texto completo.\n\n${roomFacts.permalink}`;
    expect(shareCopyBodyLooksTruncated(good, roomFacts.permalink)).toBe(false);
  });

  it("user prompt includes structured facts and system prompt is first-person", () => {
    expect(SHARE_AI_SYSTEM_PROMPT).toContain("primera persona");
    expect(SHARE_AI_SYSTEM_PROMPT).toContain(String(SHARE_AI_BODY_TARGET));
    const user = buildShareAiUserPrompt(roomFacts);
    expect(user).toContain("Providencia");
    expect(user).toContain(roomFacts.permalink);
    expect(user).toContain("maxBodyChars");
  });
});

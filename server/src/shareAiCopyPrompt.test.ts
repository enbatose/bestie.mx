import { describe, expect, it } from "vitest";
import {
  SHARE_AI_SYSTEM_PROMPT,
  buildShareAiUserPrompt,
  buildTemplateShareCopy,
  finalizeShareCopy,
  type ShareAiListingFacts,
} from "./shareAiCopyPrompt.js";
import { SHARE_AI_TEXT_MAX } from "./shareAiCopyLimits.js";

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

  it("user prompt includes structured facts and system prompt is first-person", () => {
    expect(SHARE_AI_SYSTEM_PROMPT).toContain("primera persona");
    const user = buildShareAiUserPrompt(roomFacts);
    expect(user).toContain("Providencia");
    expect(user).toContain(roomFacts.permalink);
  });
});

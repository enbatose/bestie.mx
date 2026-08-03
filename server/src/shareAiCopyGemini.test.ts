import { afterEach, describe, expect, it, vi } from "vitest";
import { generateShareAiText } from "./shareAiCopyGemini.js";
import type { ShareAiListingFacts } from "./shareAiCopyPrompt.js";

const facts: ShareAiListingFacts = {
  scope: "room",
  title: "Cuarto test",
  city: "Guadalajara",
  neighborhood: "Centro",
  summary: "Resumen corto",
  propertyKind: "departamento",
  tags: ["wifi"],
  roommateGenderPref: "any",
  ageMin: 20,
  ageMax: 40,
  lodgingType: "private_room",
  rentMxn: 4000,
  rentMinMxn: null,
  rentMaxMxn: null,
  availableRoomCount: 1,
  rooms: [
    {
      title: "Cuarto test",
      rentMxn: 4000,
      lodgingType: "private_room",
      tags: ["wifi"],
      summary: "Resumen corto",
    },
  ],
  permalink: "https://www.bestie.mx/anuncio/A12345678",
};

describe("shareAiCopyGemini", () => {
  const prevKey = process.env.GEMINI_API_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (prevKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevKey;
  });

  it("sends Gemini API key via x-goog-api-key header, not the URL", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key-not-real";
    const fetchMock = vi.fn(async () =>
      Response.json({
        candidates: [{ content: { parts: [{ text: "Revisa mi cuarto en Centro 🏠\n\nCuarto listo." }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateShareAiText(facts);
    expect(result.source).toBe("gemini");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("generativelanguage.googleapis.com");
    expect(String(url)).not.toContain("key=");
    expect(String(url)).not.toContain("test-gemini-key");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe("test-gemini-key-not-real");
  });
});

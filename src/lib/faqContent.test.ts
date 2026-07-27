import { describe, expect, it } from "vitest";
import { FAQ_ITEMS, filterFaqItems } from "@/lib/faqContent";

describe("filterFaqItems", () => {
  it("returns all items when query is empty", () => {
    expect(filterFaqItems(FAQ_ITEMS, "")).toHaveLength(FAQ_ITEMS.length);
    expect(filterFaqItems(FAQ_ITEMS, "   ")).toHaveLength(FAQ_ITEMS.length);
  });

  it("matches accent-insensitive question text", () => {
    const hits = filterFaqItems(FAQ_ITEMS, "comision");
    expect(hits.map((h) => h.id)).toContain("comision");
  });

  it("matches synonym keywords (costo → comisión)", () => {
    const hits = filterFaqItems(FAQ_ITEMS, "costo");
    expect(hits.map((h) => h.id)).toEqual(["comision"]);
  });

  it("matches synonym keywords (denunciar → reportar)", () => {
    const hits = filterFaqItems(FAQ_ITEMS, "denunciar");
    expect(hits.map((h) => h.id)).toEqual(["reportar"]);
  });

  it("matches how-it-works style queries", () => {
    const hits = filterFaqItems(FAQ_ITEMS, "como funciona");
    expect(hits.map((h) => h.id)).toEqual(
      expect.arrayContaining(["que-es", "como-buscar", "como-publicar"]),
    );
  });

  it("returns empty when nothing matches", () => {
    expect(filterFaqItems(FAQ_ITEMS, "xyzzy-no-match")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { mergeExtractionWithHints } from "./assistedDraftMerge.js";

describe("mergeExtractionWithHints", () => {
  it("lets the model fill tags when the user left chips off", () => {
    const { extraction, conflicts } = mergeExtractionWithHints(
      { tags: ["mascotas", "muebles"] },
      { tagsOn: [] },
      "Se aceptan mascotitas",
    );
    expect(extraction.tags).toEqual(["mascotas", "muebles"]);
    expect(conflicts).toEqual([]);
  });

  it("keeps user-on tags even when the post says no pets", () => {
    const { extraction, conflicts } = mergeExtractionWithHints(
      { tags: [], deniedTags: ["mascotas"] },
      { tagsOn: ["mascotas"] },
      "No se aceptan mascotas ni perros",
    );
    expect(extraction.tags).toContain("mascotas");
    expect(conflicts.some((c) => c.field === "mascotas")).toBe(true);
  });

  it("detects no-pets from Spanish text without deniedTags", () => {
    const { conflicts } = mergeExtractionWithHints(
      { tags: [] },
      { tagsOn: ["mascotas"] },
      "Cuarto amplio. No perros.",
    );
    expect(conflicts.some((c) => c.field === "mascotas")).toBe(true);
  });

  it("forces lodging type and records a clash", () => {
    const { extraction, conflicts } = mergeExtractionWithHints(
      { lodgingType: "shared_room" },
      { lodgingType: "private_room" },
    );
    expect(extraction.lodgingType).toBe("private_room");
    expect(conflicts.some((c) => c.field === "lodgingType")).toBe(true);
  });

  it("defaults lodging to private_room when neither user nor model set it", () => {
    const { extraction } = mergeExtractionWithHints({}, {});
    expect(extraction.lodgingType).toBe("private_room");
  });

  it("forces loft when the loft chip is on", () => {
    const { extraction } = mergeExtractionWithHints(
      { propertyKind: "apartment" },
      { loft: true },
    );
    expect(extraction.propertyKind).toBe("loft");
  });

  it("keeps user gender over an opposite extraction", () => {
    const { extraction, conflicts } = mergeExtractionWithHints(
      { roommateGenderPref: "male" },
      { gender: "female" },
      "Solo chicos",
    );
    expect(extraction.roommateGenderPref).toBe("female");
    expect(conflicts.some((c) => c.field === "roommateGenderPref")).toBe(true);
  });
});

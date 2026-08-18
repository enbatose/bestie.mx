import { describe, expect, it } from "vitest";
import { mergeExtractionWithHints, planComposeRooms, sanitizeHintsForPostMode } from "./assistedDraftMerge.js";

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

  it("plans two rentable rooms and one occupied stub from inventory chips", () => {
    const planned = planComposeRooms({
      postMode: "property",
      roomsForRent: 2,
      roomsOccupied: 1,
      extraction: { rentMxn: 5500, roomSummary: "Recámara iluminada" },
      nowIso: "2026-08-16T00:00:00.000Z",
    });
    expect(planned).toHaveLength(3);
    expect(planned[0]?.occupancyStatus).toBe("available");
    expect(planned[0]?.rentMxn).toBe(5500);
    expect(planned[1]?.occupancyStatus).toBe("available");
    expect(planned[1]?.rentMxn).toBe(0);
    expect(planned[2]?.occupancyStatus).toBe("occupied");
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

  it("drops room-only chips when composing a property", () => {
    const hints = sanitizeHintsForPostMode(
      {
        lodgingType: "private_room",
        tagsOn: ["mascotas", "baño-privado", "estacionamiento", "muebles", "lgbt-friendly"],
        gender: "female",
      },
      "property",
    );
    expect(hints.lodgingType).toBeNull();
    expect(hints.gender).toBeNull();
    expect(hints.tagsOn).toEqual(["mascotas", "lgbt-friendly"]);
  });

  it("keeps room chips when composing a single room", () => {
    const hints = sanitizeHintsForPostMode(
      {
        lodgingType: "shared_room",
        tagsOn: ["baño-privado", "muebles"],
        gender: "male",
      },
      "room",
    );
    expect(hints.lodgingType).toBe("shared_room");
    expect(hints.gender).toBe("male");
    expect(hints.tagsOn).toEqual(["baño-privado", "muebles"]);
  });
});

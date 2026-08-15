import { describe, expect, it } from "vitest";
import {
  listingReferenceId,
  parsePropertyReferenceSuffix,
  parseRoomReferenceSuffix,
  propertyReferenceCode,
  roomReferenceCode,
} from "./listingReference.js";

describe("listingReference", () => {
  it("derives stable 8-char suffix from room and property ids", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    expect(listingReferenceId(uuid)).toBe("550E8400");
    expect(roomReferenceCode(uuid)).toBe("A550E8400");
    expect(propertyReferenceCode(`prp__${uuid}`)).toBe("P550E8400");
    expect(propertyReferenceCode(`prp__adraft_${uuid.replace(/-/g, "")}`)).toBe("P550E8400");
    expect(roomReferenceCode(`adraft_room__${uuid.replace(/-/g, "")}`)).toBe("A550E8400");
  });

  it("parses short reference slugs", () => {
    expect(parseRoomReferenceSuffix("A550E8400")).toBe("550E8400");
    expect(parseRoomReferenceSuffix("a550e8400")).toBe("550E8400");
    expect(parseRoomReferenceSuffix("P550E8400")).toBeNull();
    expect(parsePropertyReferenceSuffix("P550E8400")).toBe("550E8400");
  });

  it("still parses legacy BES-A/BES-P slugs", () => {
    expect(parseRoomReferenceSuffix("BES-A-550E8400")).toBe("550E8400");
    expect(parsePropertyReferenceSuffix("BES-P-550E8400")).toBe("550E8400");
  });

  it("does not double-prefix an already-short room code", () => {
    const uuid = "313d1c64-e29b-41d4-a716-446655440000";
    expect(roomReferenceCode(uuid)).toBe("A313D1C64");
    expect(roomReferenceCode("A313D1C64")).toBe("A313D1C64");
    expect(roomReferenceCode("BES-A-313D1C64")).toBe("A313D1C64");
  });

  it("keeps AA when the room UUID itself starts with A", () => {
    const uuid = "a313d1c6-e29b-41d4-a716-446655440000";
    expect(roomReferenceCode(uuid)).toBe("AA313D1C6");
    expect(roomReferenceCode("AA313D1C6")).toBe("AA313D1C6");
  });
});

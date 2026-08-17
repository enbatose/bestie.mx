import { describe, expect, it } from "vitest";
import { resolveClaimSaveRoomTargets } from "./claimSaveRoomMatch.js";

describe("resolveClaimSaveRoomTargets", () => {
  const existing = ["room-a", "room-b", "room-c"];

  it("keeps matching ids", () => {
    expect(resolveClaimSaveRoomTargets(existing, ["room-a", "room-b", "room-c"])).toEqual([
      { existingId: "room-a" },
      { existingId: "room-b" },
      { existingId: "room-c" },
    ]);
  });

  it("falls back to sort order when every client id is unknown", () => {
    expect(resolveClaimSaveRoomTargets(existing, ["local-1", "local-2", "local-3"])).toEqual([
      { existingId: "room-a" },
      { existingId: "room-b" },
      { existingId: "room-c" },
    ]);
  });

  it("still maps a single-room draft whose id drifted", () => {
    expect(resolveClaimSaveRoomTargets(["only"], ["local-uuid"])).toEqual([{ existingId: "only" }]);
  });

  it("marks extra patches as inserts", () => {
    expect(resolveClaimSaveRoomTargets(["only"], ["a", "b"])).toEqual([
      { existingId: "only" },
      { existingId: null },
    ]);
  });
});

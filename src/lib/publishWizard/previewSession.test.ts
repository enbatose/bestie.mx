import { describe, expect, it } from "vitest";
import { forgetManualRoomCreateChoice } from "./previewSession";

describe("forgetManualRoomCreateChoice", () => {
  it("resets a manual single-room path back to AI", () => {
    expect(forgetManualRoomCreateChoice({ roomCreateFlow: "manual" as const })).toEqual({
      roomCreateFlow: "ai",
    });
  });

  it("leaves an AI path unchanged", () => {
    const draft = { roomCreateFlow: "ai" as const };
    expect(forgetManualRoomCreateChoice(draft)).toBe(draft);
  });
});

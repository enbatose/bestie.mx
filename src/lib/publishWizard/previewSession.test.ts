import { describe, expect, it } from "vitest";
import { forgetManualRoomCreateChoice, publishWizardLastStepIndex } from "./previewSession";

describe("publishWizardLastStepIndex", () => {
  it("uses the 2-step AI path for property posts", () => {
    expect(publishWizardLastStepIndex("property", "ai")).toBe(2);
  });

  it("keeps the long wizard when filling a property by hand", () => {
    expect(publishWizardLastStepIndex("property", "manual")).toBe(4);
  });
});

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

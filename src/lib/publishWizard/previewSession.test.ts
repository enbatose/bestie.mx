import { describe, expect, it } from "vitest";
import {
  forgetManualRoomCreateChoice,
  isAiRoomCreateFlow,
  publishWizardLastStepIndex,
  roomCreateFlowFromHydratedListing,
} from "./previewSession";

describe("publishWizardLastStepIndex", () => {
  it("uses the 2-step AI path for property posts", () => {
    expect(publishWizardLastStepIndex("property", "ai")).toBe(2);
  });

  it("keeps the long wizard when filling a property by hand", () => {
    expect(publishWizardLastStepIndex("property", "manual")).toBe(4);
  });
});

describe("isAiRoomCreateFlow", () => {
  it("keeps AI when autosave added ?edit= to a draft URL", () => {
    expect(isAiRoomCreateFlow({ roomCreateFlow: "ai" })).toBe(true);
  });

  it("disables AI while editing a live listing", () => {
    expect(isAiRoomCreateFlow({ roomCreateFlow: "ai" }, { liveEdit: true })).toBe(false);
  });
});

describe("roomCreateFlowFromHydratedListing", () => {
  it("resumes early drafts on the AI path", () => {
    expect(roomCreateFlowFromHydratedListing({ status: "draft", wizardStep: 1 })).toBe("ai");
  });

  it("keeps published listings on the long wizard", () => {
    expect(roomCreateFlowFromHydratedListing({ status: "published", wizardStep: 1 })).toBe(
      "manual",
    );
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

import { describe, expect, it } from "vitest";
import {
  CLAIM_ALREADY_CLAIMED_BY_OTHER_MESSAGE,
  CLAIM_ALREADY_CLAIMED_MESSAGE,
  claimWriteBlock,
} from "./assistedDraftClaimAccess.js";

describe("claimWriteBlock", () => {
  it("allows unclaimed tokens without a session", () => {
    expect(claimWriteBlock(null, null)).toBeNull();
    expect(claimWriteBlock("", "user-a")).toBeNull();
  });

  it("allows the user who already claimed the draft", () => {
    expect(claimWriteBlock("user-a", "user-a")).toBeNull();
  });

  it("blocks a claimed token when nobody is signed in", () => {
    expect(claimWriteBlock("user-a", null)).toEqual({
      error: "already_claimed",
      status: 409,
      message: CLAIM_ALREADY_CLAIMED_MESSAGE,
    });
  });

  it("blocks a different account and explains that changing the listing phone does not transfer it", () => {
    const blocked = claimWriteBlock("user-a", "user-b");
    expect(blocked?.error).toBe("already_claimed_by_other");
    expect(blocked?.message).toBe(CLAIM_ALREADY_CLAIMED_BY_OTHER_MESSAGE);
    expect(blocked?.message).toContain("Cambiar el teléfono del anuncio no transfiere");
  });
});

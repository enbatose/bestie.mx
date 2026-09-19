import { describe, expect, it } from "vitest";
import { listingPhotoSlotsRemaining, SELF_SERVE_MAX_PHOTOS } from "./assistedDraftLimits.js";
import { LISTING_IMAGE_COUNT_MAX } from "./validation.js";

describe("listing photo slots", () => {
  it("matches the published gallery max", () => {
    expect(SELF_SERVE_MAX_PHOTOS).toBe(LISTING_IMAGE_COUNT_MAX);
    expect(LISTING_IMAGE_COUNT_MAX).toBe(12);
  });

  it("shrinks space-photo slots when infographics take gallery room", () => {
    expect(listingPhotoSlotsRemaining(0)).toBe(12);
    expect(listingPhotoSlotsRemaining(1)).toBe(11);
    expect(listingPhotoSlotsRemaining(2)).toBe(10);
    expect(listingPhotoSlotsRemaining(99)).toBe(10);
  });
});

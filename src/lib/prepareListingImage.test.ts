import { describe, expect, it } from "vitest";
import { isPreparedListingImage, isProbablyImageFile } from "./prepareListingImage";

describe("prepareListingImage helpers", () => {
  it("treats missing or image MIME as a probable photo", () => {
    expect(isProbablyImageFile(new File([], "foto.jpg", { type: "image/jpeg" }))).toBe(true);
    expect(isProbablyImageFile(new File([], "foto", { type: "" }))).toBe(true);
    expect(isProbablyImageFile(new File([], "doc.pdf", { type: "application/pdf" }))).toBe(false);
  });

  it("does not mark raw picker files as already compressed", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "foto.jpg", { type: "image/jpeg" });
    expect(isPreparedListingImage(file)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  imageFilesFromClipboard,
  isClipboardImageFile,
  shouldAcceptClipboardImagePaste,
} from "./clipboardImages";

function png(name = "image.png") {
  return new File([new Uint8Array([137, 80, 78, 71])], name, { type: "image/png" });
}

describe("clipboardImages", () => {
  it("treats image MIME and image extensions as photos", () => {
    expect(isClipboardImageFile(png())).toBe(true);
    expect(isClipboardImageFile(new File([], "foto.HEIC", { type: "" }))).toBe(true);
    expect(isClipboardImageFile(new File([], "nota.pdf", { type: "application/pdf" }))).toBe(false);
  });

  it("reads screenshot items from the clipboard", () => {
    const file = png();
    const files = imageFilesFromClipboard({
      items: [
        { kind: "file", type: "image/png", getAsFile: () => file },
        { kind: "string", type: "text/plain", getAsFile: () => null },
      ],
    });
    expect(files).toEqual([file]);
  });

  it("collects every image item in one paste", () => {
    const a = png("a.png");
    const b = png("b.png");
    expect(
      imageFilesFromClipboard({
        items: [
          { kind: "file", type: "image/png", getAsFile: () => a },
          { kind: "file", type: "image/jpeg", getAsFile: () => b },
        ],
      }),
    ).toEqual([a, b]);
  });

  it("falls back to clipboard files when items have no image", () => {
    const file = png("desde-explorador.jpg");
    const files = imageFilesFromClipboard({
      items: [{ kind: "string", type: "text/html", getAsFile: () => null }],
      files: [file],
    });
    expect(files).toEqual([file]);
  });

  it("returns nothing for text-only paste", () => {
    expect(
      imageFilesFromClipboard({
        items: [{ kind: "string", type: "text/plain", getAsFile: () => null }],
        files: [],
      }),
    ).toEqual([]);
  });

  it("routes paste to the hovered widget when several are enabled", () => {
    const targets = [
      { id: "a", enabled: true, pointerOver: false, focused: false },
      { id: "b", enabled: true, pointerOver: true, focused: false },
    ];
    expect(shouldAcceptClipboardImagePaste(targets, "a")).toBe(false);
    expect(shouldAcceptClipboardImagePaste(targets, "b")).toBe(true);
  });

  it("lets the only enabled widget take a global paste", () => {
    const targets = [
      { id: "a", enabled: false, pointerOver: false, focused: false },
      { id: "b", enabled: true, pointerOver: false, focused: false },
    ];
    expect(shouldAcceptClipboardImagePaste(targets, "b")).toBe(true);
    expect(shouldAcceptClipboardImagePaste(targets, "a")).toBe(false);
  });
});

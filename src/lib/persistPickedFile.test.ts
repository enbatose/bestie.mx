import { describe, expect, it } from "vitest";
import { isFilePermissionError } from "./persistPickedFile";

describe("isFilePermissionError", () => {
  it("detects Chrome Android file-access revocation message", () => {
    expect(
      isFilePermissionError(
        "The requested file could not be read, typically due to permission problems that have occurred after a reference to a file was acquired.",
      ),
    ).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isFilePermissionError("No se pudo preparar esa imagen.")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { classifyFileName, classifyImageError } from "./imageUploadDiagnostics";

describe("imageUploadDiagnostics", () => {
  it("classifies Chrome Android permission errors", () => {
    expect(
      classifyImageError(
        new Error(
          "The requested file could not be read, typically due to permission problems that have occurred after a reference to a file was acquired.",
        ),
      ),
    ).toBe("file_permission");
  });

  it("classifies HEIC and upload HTTP errors", () => {
    expect(classifyImageError(new Error("HEIC/HEIF"))).toBe("heic_unsupported");
    expect(classifyImageError(new Error("upload_http_400: invalid_mimetype"))).toBe("upload_http");
  });

  it("classifies filename kinds without storing full names", () => {
    expect(classifyFileName("17851172374824252210736568791050.jpg")).toEqual({
      nameExt: "jpg",
      nameKind: "numeric",
    });
    expect(classifyFileName("WhatsApp Image 2026-07-26 at 15.54.43.jpeg").nameKind).toBe("whatsapp");
    expect(classifyFileName("IMG_1234.HEIC").nameKind).toBe("heic");
  });
});

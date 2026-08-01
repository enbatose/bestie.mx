import { describe, expect, it } from "vitest";
import {
  normalizeDeclaredImageMime,
  resolveUploadMime,
  sniffImageMime,
} from "./imageMime.js";

describe("server imageMime", () => {
  it("accepts image/jpg alias as jpeg", () => {
    expect(normalizeDeclaredImageMime("image/jpg")).toBe("image/jpeg");
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(resolveUploadMime("image/jpg", jpeg)).toBe("image/jpeg");
  });

  it("sniffs JPEG when MIME is empty (WhatsApp / Android gallery)", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(sniffImageMime(jpeg)).toBe("image/jpeg");
    expect(resolveUploadMime("", jpeg)).toBe("image/jpeg");
    expect(resolveUploadMime("application/octet-stream", jpeg)).toBe("image/jpeg");
  });

  it("rejects SVG declared MIME without raster magic bytes", () => {
    const fake = Buffer.from("not-an-image-payload!!");
    expect(resolveUploadMime("image/svg+xml", fake)).toBeNull();
  });
});

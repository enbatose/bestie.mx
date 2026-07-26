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

  it("rejects HEIC (no server-side convert)", () => {
    const heic = Buffer.alloc(12);
    heic.writeUInt32BE(0x18, 0);
    heic.write("ftyp", 4);
    heic.write("heic", 8);
    expect(sniffImageMime(heic)).toBe("image/heic");
    expect(resolveUploadMime("image/heic", heic)).toBeNull();
  });
});

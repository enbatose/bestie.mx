import { describe, expect, it } from "vitest";
import {
  normalizeDeclaredImageMime,
  resolveImageMime,
  sniffImageMime,
} from "./imageMime";

describe("imageMime", () => {
  it("normalizes mobile JPEG aliases", () => {
    expect(normalizeDeclaredImageMime("image/jpg")).toBe("image/jpeg");
    expect(normalizeDeclaredImageMime("image/pjpeg")).toBe("image/jpeg");
    expect(normalizeDeclaredImageMime("image/jpeg; charset=utf-8")).toBe("image/jpeg");
    expect(normalizeDeclaredImageMime("")).toBe("");
  });

  it("sniffs JPEG magic bytes (WhatsApp photos often arrive as .png name or empty type)", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(sniffImageMime(jpeg)).toBe("image/jpeg");
  });

  it("sniffs PNG and WebP", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(sniffImageMime(png)).toBe("image/png");

    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(sniffImageMime(webp)).toBe("image/webp");
  });

  it("sniffs HEIC ftyp brand", () => {
    const heic = new Uint8Array(12);
    heic.set([0x00, 0x00, 0x00, 0x18], 0);
    heic.set([0x66, 0x74, 0x79, 0x70], 4); // ftyp
    heic.set([0x68, 0x65, 0x69, 0x63], 8); // heic
    expect(sniffImageMime(heic)).toBe("image/heic");
  });

  it("resolves empty WhatsApp-style MIME via sniff then extension", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(resolveImageMime("", "WhatsApp Image 2026-07-26 at 15.54.43.jpeg", jpeg)).toBe("image/jpeg");
    expect(resolveImageMime("application/octet-stream", "foto.jpg", jpeg)).toBe("image/jpeg");
    expect(resolveImageMime("image/jpg", "foto.jpg")).toBe("image/jpeg");
    expect(resolveImageMime("", "foto.heic")).toBe("image/heic");
  });
});

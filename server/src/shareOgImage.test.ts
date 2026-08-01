import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  composeBrandedShareImage,
  coverUploadFilename,
  shareOgImagePublicPath,
  uploadFilenameFromListingPath,
} from "./shareOgImage.js";

describe("shareOgImage", () => {
  it("parses upload filenames from listing paths", () => {
    expect(uploadFilenameFromListingPath("/api/uploads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg")).toBe(
      "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg",
    );
    expect(
      uploadFilenameFromListingPath(
        "https://dev.bestie.mx/api/uploads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg",
      ),
    ).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg");
    expect(uploadFilenameFromListingPath("/api/uploads/../secret.jpg")).toBeNull();
  });

  it("picks cover upload by post mode", () => {
    const listing = {
      propertyImageUrls: ["/api/uploads/prop.png"],
      roomImageUrls: ["/api/uploads/room.jpg"],
    };
    expect(coverUploadFilename(listing, "room")).toBe("room.jpg");
    expect(coverUploadFilename(listing, "property")).toBe("prop.png");
    expect(coverUploadFilename({ propertyImageUrls: [], roomImageUrls: [] }, "room")).toBeNull();
  });

  it("builds share-og public paths", () => {
    expect(shareOgImagePublicPath("anuncio", "AABCDEF12")).toBe("/api/share-og/anuncio/AABCDEF12.jpg");
    expect(shareOgImagePublicPath("propiedad", "PABCDEF12.jpg")).toBe(
      "/api/share-og/propiedad/PABCDEF12.jpg",
    );
  });

  it("composites Bestie lockup onto a JPEG", async () => {
    const source = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 180, g: 200, b: 220 },
      },
    })
      .jpeg()
      .toBuffer();

    const out = await composeBrandedShareImage(source);
    expect(out.length).toBeGreaterThan(1000);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(600);
  });
});

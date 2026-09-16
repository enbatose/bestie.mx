import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { openDb } from "./db.js";
import { LISTING_IMAGE_MAX_EDGE, optimizeListingImageBuffer } from "./optimizeListingImage.js";
import { persistListingImageBuffer } from "./uploadsRouter.js";

async function raster(width: number, height: number, format: "jpeg" | "png"): Promise<Buffer> {
  const img = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 40, g: 80, b: 120 },
    },
  });
  return format === "png" ? img.png().toBuffer() : img.jpeg({ quality: 95 }).toBuffer();
}

describe("optimizeListingImageBuffer", () => {
  it("downscales camera-sized photos to the wizard max edge and JPEG", async () => {
    const src = await raster(3000, 2000, "jpeg");
    const out = await optimizeListingImageBuffer(src);
    expect(out).not.toBeNull();
    expect(out!.mime).toBe("image/jpeg");
    expect(Math.max(out!.width, out!.height)).toBe(LISTING_IMAGE_MAX_EDGE);
    expect(out!.buffer.length).toBeLessThan(src.length);
    const meta = await sharp(out!.buffer).metadata();
    expect(meta.format).toBe("jpeg");
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(LISTING_IMAGE_MAX_EDGE);
  });

  it("does not enlarge a small PNG and converts it to JPEG", async () => {
    const src = await raster(800, 600, "png");
    const out = await optimizeListingImageBuffer(src);
    expect(out).not.toBeNull();
    expect(out!.mime).toBe("image/jpeg");
    expect(out!.width).toBe(800);
    expect(out!.height).toBe(600);
  });

  it("returns null for non-image bytes", async () => {
    expect(await optimizeListingImageBuffer(Buffer.from("not-an-image"))).toBeNull();
  });
});

describe("persistListingImageBuffer (chat upload path)", () => {
  let dir: string;
  let db: DatabaseSync;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-chat-img-"));
    db = openDb(join(dir, "uploads.db"));
  });

  afterAll(() => {
    db.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  it("stores the optimized JPEG used by WhatsApp (and later Messenger)", async () => {
    const src = await raster(2500, 2500, "png");
    const url = await persistListingImageBuffer(db, dir, src, "image/png");
    expect(url).toMatch(/^\/api\/uploads\/[\da-f-]+\.jpg$/i);
    const name = url!.slice("/api/uploads/".length);
    const stored = readFileSync(join(dir, name));
    const meta = await sharp(stored).metadata();
    expect(meta.format).toBe("jpeg");
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(LISTING_IMAGE_MAX_EDGE);
    const row = db
      .prepare(`SELECT mime_type FROM upload_blobs WHERE filename = ?`)
      .get(name) as { mime_type?: string } | undefined;
    expect(row?.mime_type).toBe("image/jpeg");
  });
});

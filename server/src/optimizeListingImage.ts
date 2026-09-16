import sharp from "sharp";

/**
 * Same cap as the site wizard (`src/lib/prepareListingImage.ts` `MAX_EDGE`).
 * Chat inbound (WhatsApp now, Messenger later) has no browser canvas, so we
 * apply it here before writing `/api/uploads`.
 */
export const LISTING_IMAGE_MAX_EDGE = 1920;
const JPEG_QUALITY = 85;

export type OptimizedListingImage = {
  buffer: Buffer;
  mime: "image/jpeg";
  width: number;
  height: number;
};

/**
 * Downscale to max 1920px on the long edge, auto-orient EXIF, flatten
 * transparency, and re-encode JPEG 85 — same job as `prepareListingImage`.
 * Returns null if the bytes are not a decodable raster image.
 */
export async function optimizeListingImageBuffer(buffer: Buffer): Promise<OptimizedListingImage | null> {
  if (!buffer?.length) return null;
  try {
    const pipeline = sharp(buffer, { failOn: "none", animated: false }).rotate();
    const meta = await pipeline.metadata();
    const srcW = meta.width ?? 0;
    const srcH = meta.height ?? 0;
    if (!srcW || !srcH) return null;

    const out = await pipeline
      .clone()
      .resize(LISTING_IMAGE_MAX_EDGE, LISTING_IMAGE_MAX_EDGE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

    if (!out.data.length || !out.info.width || !out.info.height) return null;
    return {
      buffer: out.data,
      mime: "image/jpeg",
      width: out.info.width,
      height: out.info.height,
    };
  } catch {
    return null;
  }
}

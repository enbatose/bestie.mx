import {
  WEB_SAFE_UPLOAD_TYPES,
  extensionForImageMime,
  isHeicLikeMime,
  resolveImageMime,
  sniffImageMime,
} from "@/lib/imageMime";

const MAX_SKIP_BYTES = 500_000;
const MAX_EDGE = 1920;

export const PREPARE_IMAGE_HEIC_MESSAGE =
  "Esta foto está en formato HEIC/HEIF (común en iPhone). Guárdala como JPG o PNG, o toma la foto desde la cámara de Bestie.";

export const PREPARE_IMAGE_FAIL_MESSAGE =
  "No se pudo preparar esa imagen. Intenta con otra foto o guárdala como JPG/PNG.";

export const PREPARE_IMAGE_EMPTY_MESSAGE =
  "No se pudo leer esa foto (a veces pasa si aún está en iCloud). Ábrela en Fotos para descargarla e intenta de nuevo.";

export type PreparedListingImage = {
  outFile: File;
  inputW: number;
  inputH: number;
  outputW: number;
  outputH: number;
  skipped: boolean;
  outputType: string;
};

function supportsWebpCanvas(): boolean {
  try {
    if (typeof document === "undefined") return false;
    const c = document.createElement("canvas");
    return c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

function clampResize(w: number, h: number, maxEdge: number): { w: number; h: number } {
  const edge = Math.max(w, h);
  if (edge <= maxEdge) return { w, h };
  const s = maxEdge / edge;
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

function baseName(fileName: string): string {
  const raw = (fileName || "foto").replace(/\.[^.]+$/i, "");
  return raw && raw !== "image" && raw !== "unnamed" ? raw : "foto";
}

/**
 * Rewrap gallery picks that arrive with empty, aliased, or mislabeled MIME.
 * Magic bytes win over the declared type (phones often label HEIC as jpeg).
 */
export async function ensureTypedImageFile(file: File): Promise<File> {
  if (!file.size) throw new Error(PREPARE_IMAGE_EMPTY_MESSAGE);

  const head = await file.slice(0, 64).arrayBuffer();
  const mime = resolveImageMime(file.type, file.name, head);
  if (!mime) return file;
  if (file.type === mime && file.name) return file;

  const ext = extensionForImageMime(mime);
  const name = file.name && /\.[^.]+$/i.test(file.name)
    ? file.name.replace(/\.[^.]+$/i, `.${ext}`)
    : `${baseName(file.name)}.${ext}`;
  return new File([file], name, { type: mime, lastModified: file.lastModified });
}

type DecodedImage = {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  close: () => void;
};

function bitmapToDecoded(bmp: ImageBitmap): DecodedImage {
  return {
    width: bmp.width,
    height: bmp.height,
    draw: (ctx, w, h) => {
      ctx.drawImage(bmp, 0, 0, w, h);
    },
    close: () => bmp.close(),
  };
}

/** Prefer downscaling during decode so 12MP+ camera photos don't OOM on mobile. */
async function decodeViaImageBitmap(file: File): Promise<DecodedImage> {
  const full = await createImageBitmap(file);
  const { w, h } = clampResize(full.width, full.height, MAX_EDGE);
  if (w === full.width && h === full.height) return bitmapToDecoded(full);

  try {
    full.close();
    const scaled = await createImageBitmap(file, {
      resizeWidth: w,
      resizeHeight: h,
      resizeQuality: "high",
    });
    return bitmapToDecoded(scaled);
  } catch {
    // resize options unsupported — fall back to full bitmap (caller draws scaled).
    const again = await createImageBitmap(file);
    return bitmapToDecoded(again);
  }
}

async function decodeViaHtmlImage(file: File): Promise<DecodedImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("html_image_decode_failed"));
    });
    img.src = url;
    await loaded;
    if (typeof img.decode === "function") {
      try {
        await img.decode();
      } catch {
        /* onload already succeeded */
      }
    }
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) throw new Error("html_image_zero_size");
    return {
      width,
      height,
      draw: (ctx, w, h) => {
        ctx.drawImage(img, 0, 0, w, h);
      },
      close: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      return await decodeViaImageBitmap(file);
    } catch {
      /* fall through — empty MIME / older WebViews often need <img> */
    }
  }
  return decodeViaHtmlImage(file);
}

/** Dynamic HEIC→JPEG for browsers without native HEIC (Chrome Android, etc.). */
async function convertHeicWithLibrary(file: File): Promise<File> {
  const mod = await import("heic2any");
  const heic2any = mod.default;
  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.85,
  });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  if (!(blob instanceof Blob) || blob.size <= 0) throw new Error("heic_convert_empty");
  return new File([blob], `${baseName(file.name)}.jpg`, {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}

async function encodeCanvas(
  canvas: HTMLCanvasElement,
  nameBase: string,
): Promise<{ file: File; type: string }> {
  // Prefer JPEG on mobile upload path — widest decoder/proxy support.
  const attempts: { type: string; quality: number; ext: string }[] = [
    { type: "image/jpeg", quality: 0.85, ext: "jpg" },
    ...(supportsWebpCanvas() ? [{ type: "image/webp", quality: 0.82, ext: "webp" }] : []),
  ];

  for (const attempt of attempts) {
    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), attempt.type, attempt.quality);
    });
    if (blob && blob.size > 0) {
      return {
        file: new File([blob], `${nameBase}.${attempt.ext}`, { type: attempt.type }),
        type: attempt.type,
      };
    }
  }
  throw new Error("encode_failed");
}

async function decodeWithHeicFallback(file: File): Promise<{ decoded: DecodedImage; source: File }> {
  try {
    return { decoded: await decodeImage(file), source: file };
  } catch (first) {
    const head = await file.slice(0, 64).arrayBuffer();
    const sniffed = sniffImageMime(head);
    const maybeHeic =
      isHeicLikeMime(file.type) ||
      isHeicLikeMime(sniffed ?? "") ||
      /\.hei[cf]$/i.test(file.name);
    if (!maybeHeic) {
      throw first instanceof Error ? first : new Error(PREPARE_IMAGE_FAIL_MESSAGE);
    }
    try {
      const jpeg = await convertHeicWithLibrary(file);
      return { decoded: await decodeImage(jpeg), source: jpeg };
    } catch {
      throw new Error(PREPARE_IMAGE_HEIC_MESSAGE);
    }
  }
}

/** Normalize, optionally recompress, and return an API-safe upload File. */
export async function prepareListingImage(file: File): Promise<PreparedListingImage> {
  const typed = await ensureTypedImageFile(file);
  const heicLike = isHeicLikeMime(typed.type);

  let decoded: DecodedImage;
  let source = typed;
  try {
    const result = await decodeWithHeicFallback(typed);
    decoded = result.decoded;
    source = result.source;
  } catch (e) {
    if (e instanceof Error && (e.message === PREPARE_IMAGE_HEIC_MESSAGE || e.message === PREPARE_IMAGE_EMPTY_MESSAGE)) {
      throw e;
    }
    if (heicLike) throw new Error(PREPARE_IMAGE_HEIC_MESSAGE);
    throw new Error(PREPARE_IMAGE_FAIL_MESSAGE);
  }

  try {
    const inputW = decoded.width;
    const inputH = decoded.height;
    const { w: outputW, h: outputH } = clampResize(inputW, inputH, MAX_EDGE);

    // Never skip re-encode for HEIC — the API does not accept it.
    if (
      !heicLike &&
      !isHeicLikeMime(source.type) &&
      WEB_SAFE_UPLOAD_TYPES.has(source.type) &&
      source.size <= MAX_SKIP_BYTES &&
      outputW === inputW &&
      outputH === inputH
    ) {
      return {
        outFile: source,
        inputW,
        inputH,
        outputW,
        outputH,
        skipped: true,
        outputType: source.type || "unknown",
      };
    }

    if (typeof document === "undefined") throw new Error("canvas_unavailable");
    const canvas = document.createElement("canvas");
    canvas.width = outputW;
    canvas.height = outputH;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("canvas_2d_unavailable");
    decoded.draw(ctx, outputW, outputH);

    const encoded = await encodeCanvas(canvas, baseName(source.name));
    return {
      outFile: encoded.file,
      inputW,
      inputH,
      outputW,
      outputH,
      skipped: false,
      outputType: encoded.type,
    };
  } finally {
    decoded.close();
  }
}

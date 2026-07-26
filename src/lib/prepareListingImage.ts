import {
  WEB_SAFE_UPLOAD_TYPES,
  extensionForImageMime,
  isHeicLikeMime,
  resolveImageMime,
} from "@/lib/imageMime";

const MAX_SKIP_BYTES = 500_000;
const MAX_EDGE = 1920;

export const PREPARE_IMAGE_HEIC_MESSAGE =
  "Esta foto está en formato HEIC/HEIF (común en iPhone). Guárdala como JPG o PNG, o toma la foto desde la cámara de Bestie.";

export const PREPARE_IMAGE_FAIL_MESSAGE =
  "No se pudo preparar esa imagen. Intenta con otra foto o guárdala como JPG/PNG.";

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
  return (fileName || "foto").replace(/\.[^.]+$/i, "") || "foto";
}

/**
 * Rewrap gallery / WhatsApp picks that arrive with empty or aliased MIME.
 * HEIC is allowed through: iOS Safari/WebKit can decode it, then we re-encode to JPG/WebP.
 */
export async function ensureTypedImageFile(file: File): Promise<File> {
  const head = await file.slice(0, 64).arrayBuffer();
  const mime = resolveImageMime(file.type, file.name, head);
  if (!mime) return file;
  if (file.type === mime) return file;

  const ext = extensionForImageMime(mime);
  const name = /\.[^.]+$/i.test(file.name)
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

async function decodeViaImageBitmap(file: File): Promise<DecodedImage> {
  const bmp = await createImageBitmap(file);
  return {
    width: bmp.width,
    height: bmp.height,
    draw: (ctx, w, h) => {
      ctx.drawImage(bmp, 0, 0, w, h);
    },
    close: () => bmp.close(),
  };
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

async function encodeCanvas(
  canvas: HTMLCanvasElement,
  nameBase: string,
): Promise<{ file: File; type: string }> {
  const attempts: { type: string; quality: number; ext: string }[] = supportsWebpCanvas()
    ? [
        { type: "image/webp", quality: 0.82, ext: "webp" },
        { type: "image/jpeg", quality: 0.85, ext: "jpg" },
      ]
    : [{ type: "image/jpeg", quality: 0.85, ext: "jpg" }];

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

/** Normalize, optionally recompress, and return an API-safe upload File. */
export async function prepareListingImage(file: File): Promise<PreparedListingImage> {
  const typed = await ensureTypedImageFile(file);
  const heicLike = isHeicLikeMime(typed.type);

  let decoded: DecodedImage;
  try {
    decoded = await decodeImage(typed);
  } catch {
    // Gallery HEIC on browsers without native decode (e.g. Chrome Android).
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
      WEB_SAFE_UPLOAD_TYPES.has(typed.type) &&
      typed.size <= MAX_SKIP_BYTES &&
      outputW === inputW &&
      outputH === inputH
    ) {
      return {
        outFile: typed,
        inputW,
        inputH,
        outputW,
        outputH,
        skipped: true,
        outputType: typed.type || "unknown",
      };
    }

    if (typeof document === "undefined") throw new Error("canvas_unavailable");
    const canvas = document.createElement("canvas");
    canvas.width = outputW;
    canvas.height = outputH;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("canvas_2d_unavailable");
    decoded.draw(ctx, outputW, outputH);

    const encoded = await encodeCanvas(canvas, baseName(typed.name));
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

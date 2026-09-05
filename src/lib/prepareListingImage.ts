import {
  extensionForImageMime,
  isHeicLikeMime,
  normalizeDeclaredImageMime,
  resolveImageMime,
  sniffImageMime,
} from "@/lib/imageMime";
import type { ImageDecodePath } from "@/lib/imageUploadDiagnostics";
import { persistPickedFile } from "@/lib/persistPickedFile";

const MAX_EDGE = 1920;

/** Files already run through `prepareListingImage` — skip a second JPEG encode. */
const preparedListingFiles = new WeakSet<File>();

export function isPreparedListingImage(file: File): boolean {
  return preparedListingFiles.has(file);
}

export type PreparedImagePayload = {
  mimeType: string;
  data: string;
  preview: string;
};

function alreadyPreparedResult(file: File): PreparedListingImage {
  return {
    outFile: file,
    inputW: 0,
    inputH: 0,
    outputW: 0,
    outputH: 0,
    skipped: true,
    outputType: file.type || "image/jpeg",
    diagnostics: {
      declaredMime: file.type || "unknown",
      sniffedMime: null,
      decodePath: "skipped",
      heicConverted: false,
    },
  };
}

export function isProbablyImageFile(file: File): boolean {
  return !file.type || file.type.startsWith("image/");
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string" && reader.result.startsWith("data:")) resolve(reader.result);
      else reject(new Error("filereader_bad_result"));
    };
    reader.onerror = () => reject(new Error("filereader_failed"));
    reader.readAsDataURL(blob);
  });
}

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
  diagnostics: {
    declaredMime: string;
    sniffedMime: string | null;
    decodePath: ImageDecodePath;
    heicConverted: boolean;
  };
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

function elementToDecoded(img: CanvasImageSource, width: number, height: number, close: () => void): DecodedImage {
  if (!width || !height) throw new Error("image_zero_size");
  return {
    width,
    height,
    draw: (ctx, w, h) => {
      ctx.drawImage(img, 0, 0, w, h);
    },
    close,
  };
}

async function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = "async";
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("html_image_decode_failed"));
  });
  img.src = src;
  await loaded;
  if (typeof img.decode === "function") {
    try {
      await img.decode();
    } catch {
      /* onload already succeeded */
    }
  }
  return img;
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

async function decodeViaObjectUrl(file: File): Promise<DecodedImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadHtmlImage(url);
    return elementToDecoded(img, img.naturalWidth || img.width, img.naturalHeight || img.height, () => {
      URL.revokeObjectURL(url);
    });
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/**
 * Android Chrome gallery picks sometimes fail createImageBitmap + blob: URLs
 * but still decode via FileReader data URLs.
 */
async function decodeViaFileReader(file: File): Promise<DecodedImage> {
  const head = await file.slice(0, 64).arrayBuffer().catch(() => null);
  const mime =
    (head ? resolveImageMime(file.type, file.name, head) : normalizeDeclaredImageMime(file.type)) ||
    "image/jpeg";
  const forRead =
    file.type === mime
      ? file
      : new File([file], file.name || `foto.${extensionForImageMime(mime)}`, {
          type: mime,
          lastModified: file.lastModified,
        });

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string" && reader.result.startsWith("data:")) resolve(reader.result);
      else reject(new Error("filereader_bad_result"));
    };
    reader.onerror = () => reject(new Error("filereader_failed"));
    reader.readAsDataURL(forRead);
  });
  // Some Android picks produce data URLs with an empty/octet MIME that <img> rejects.
  const normalizedDataUrl = dataUrl.replace(/^data:[^;,]*/, `data:${mime}`);
  const img = await loadHtmlImage(normalizedDataUrl);
  return elementToDecoded(img, img.naturalWidth || img.width, img.naturalHeight || img.height, () => {
    /* data URL — nothing to revoke */
  });
}

async function decodeImage(file: File): Promise<{ decoded: DecodedImage; path: ImageDecodePath }> {
  if (typeof createImageBitmap === "function") {
    try {
      return { decoded: await decodeViaImageBitmap(file), path: "bitmap" };
    } catch {
      /* fall through */
    }
  }
  try {
    return { decoded: await decodeViaObjectUrl(file), path: "objectUrl" };
  } catch {
    return { decoded: await decodeViaFileReader(file), path: "fileReader" };
  }
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

function looksLikeHeic(file: File, sniffed: string | null): boolean {
  return (
    isHeicLikeMime(file.type) ||
    isHeicLikeMime(sniffed ?? "") ||
    /\.hei[cf]$/i.test(file.name)
  );
}

async function decodeWithHeicFallback(
  file: File,
): Promise<{ decoded: DecodedImage; source: File; path: ImageDecodePath; heicConverted: boolean }> {
  try {
    const r = await decodeImage(file);
    return { decoded: r.decoded, source: file, path: r.path, heicConverted: false };
  } catch (first) {
    const head = await file.slice(0, 64).arrayBuffer();
    const sniffed = sniffImageMime(head);
    const maybeHeic = looksLikeHeic(file, sniffed);

    try {
      const jpeg = await convertHeicWithLibrary(file);
      const r = await decodeImage(jpeg);
      return { decoded: r.decoded, source: jpeg, path: "heic2any", heicConverted: true };
    } catch {
      if (maybeHeic) throw new Error(PREPARE_IMAGE_HEIC_MESSAGE);
      throw first instanceof Error ? first : new Error(PREPARE_IMAGE_FAIL_MESSAGE);
    }
  }
}

/** Normalize, optionally recompress, and return an API-safe upload File. */
export async function prepareListingImage(file: File): Promise<PreparedListingImage> {
  if (preparedListingFiles.has(file)) return alreadyPreparedResult(file);

  const typed = await ensureTypedImageFile(file);
  const heicLike = isHeicLikeMime(typed.type);
  const head = await typed.slice(0, 64).arrayBuffer().catch(() => null);
  const sniffedMime = head ? sniffImageMime(head) : null;
  const declaredMime = typed.type || "unknown";

  let decoded: DecodedImage;
  let source = typed;
  let decodePath: ImageDecodePath = "unknown";
  let heicConverted = false;
  try {
    const result = await decodeWithHeicFallback(typed);
    decoded = result.decoded;
    source = result.source;
    decodePath = result.path;
    heicConverted = result.heicConverted;
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

    // Always re-encode to a clean JPEG/WebP. Skipping let mislabeled gallery bytes
    // (WhatsApp/Android) reach the server and fail with invalid_mimetype.
    if (typeof document === "undefined") throw new Error("canvas_unavailable");
    const canvas = document.createElement("canvas");
    canvas.width = outputW;
    canvas.height = outputH;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("canvas_2d_unavailable");
    decoded.draw(ctx, outputW, outputH);

    const encoded = await encodeCanvas(canvas, baseName(source.name));
    preparedListingFiles.add(encoded.file);
    return {
      outFile: encoded.file,
      inputW,
      inputH,
      outputW,
      outputH,
      skipped: false,
      outputType: encoded.type,
      diagnostics: {
        declaredMime,
        sniffedMime,
        decodePath,
        heicConverted,
      },
    };
  } finally {
    decoded.close();
  }
}

/** Persist picker bytes if needed, then compress. Safe to call twice on the same File. */
export async function prepareListingImageForUpload(file: File): Promise<File> {
  if (preparedListingFiles.has(file)) return file;
  const durable = await persistPickedFile(file);
  return (await prepareListingImage(durable)).outFile;
}

/** Compress a picked/pasted photo into JSON-safe base64 (outreach + AI compose). */
export async function fileToPreparedImagePayload(file: File): Promise<PreparedImagePayload> {
  const outFile = await prepareListingImageForUpload(file);
  const preview = await blobToDataUrl(outFile);
  const idx = preview.indexOf(",");
  const header = preview.slice(0, idx);
  const data = preview.slice(idx + 1);
  const mimeType = header.split(":")[1]?.split(";")[0] || outFile.type || "image/jpeg";
  return { mimeType, data, preview };
}

/** Rebuild a File from in-memory preview/base64 so it can go through `POST /api/uploads`. */
export async function preparedPayloadToFile(
  payload: { mimeType?: string; data?: string; preview?: string },
  name = "foto.jpg",
): Promise<File> {
  const mimeType = payload.mimeType || "image/jpeg";
  const src =
    payload.preview && payload.preview.startsWith("data:")
      ? payload.preview
      : payload.data
        ? `data:${mimeType};base64,${payload.data}`
        : "";
  if (!src) throw new Error(PREPARE_IMAGE_EMPTY_MESSAGE);
  const blob = await (await fetch(src)).blob();
  if (!blob.size) throw new Error(PREPARE_IMAGE_EMPTY_MESSAGE);
  const ext = mimeType.includes("webp") ? "webp" : mimeType.includes("png") ? "png" : "jpg";
  const fileName = /\.[a-z0-9]+$/i.test(name) ? name : `${name}.${ext}`;
  return new File([blob], fileName, { type: blob.type || mimeType });
}

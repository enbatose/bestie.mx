/** Declared MIME aliases mobile galleries / WhatsApp often send instead of the IANA type. */
const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-jpeg": "image/jpeg",
  "image/jfif": "image/jpeg",
  "image/x-png": "image/png",
  "image/x-webp": "image/webp",
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jfif: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  bmp: "image/bmp",
  heic: "image/heic",
  heif: "image/heif",
};

/** MIME types the listing upload API accepts without client re-encode. */
export const WEB_SAFE_UPLOAD_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export function normalizeDeclaredImageMime(type: string | undefined | null): string {
  const raw = (type ?? "").trim().toLowerCase();
  if (!raw) return "";
  // Strip parameters: "image/jpeg; charset=utf-8"
  const base = raw.split(";", 1)[0]?.trim() ?? raw;
  return MIME_ALIASES[base] ?? base;
}

function asciiAt(bytes: Uint8Array, offset: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    const c = bytes[offset + i];
    if (c == null) return s;
    s += String.fromCharCode(c);
  }
  return s;
}

/** Sniff image MIME from magic bytes (JPEG/PNG/WebP/GIF/BMP/AVIF/HEIC). */
export function sniffImageMime(input: ArrayBuffer | ArrayBufferView): string | null {
  const bytes =
    input instanceof ArrayBuffer
      ? new Uint8Array(input)
      : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  if (bytes.length < 12) return null;

  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  // GIF
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  // BMP
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    asciiAt(bytes, 8, 4) === "WEBP"
  ) {
    return "image/webp";
  }
  // ISO BMFF (HEIC/HEIF/AVIF): ....ftypXXXX
  if (asciiAt(bytes, 4, 4) === "ftyp") {
    const brand = asciiAt(bytes, 8, 4).toLowerCase();
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (
      brand === "heic" ||
      brand === "heif" ||
      brand === "mif1" ||
      brand === "msf1" ||
      brand === "heix" ||
      brand === "hevc"
    ) {
      return "image/heic";
    }
  }
  return null;
}

export function mimeFromFileName(name: string | undefined | null): string | null {
  if (!name) return null;
  const m = /\.([^.]+)$/.exec(name.trim());
  if (!m) return null;
  return EXT_TO_MIME[m[1].toLowerCase()] ?? null;
}

export function isHeicLikeMime(mime: string): boolean {
  const m = normalizeDeclaredImageMime(mime);
  return m === "image/heic" || m === "image/heif";
}

/**
 * Resolve the best MIME for a picked file: declared alias → magic bytes → extension.
 * Returns empty string when unknown.
 */
export function resolveImageMime(
  declaredType: string | undefined | null,
  name: string | undefined | null,
  headBytes?: ArrayBuffer | ArrayBufferView | null,
): string {
  const declared = normalizeDeclaredImageMime(declaredType);
  if (declared === "application/octet-stream" || declared === "binary/octet-stream") {
    // fall through to sniff
  } else if (declared.startsWith("image/")) {
    return declared;
  }

  if (headBytes) {
    const sniffed = sniffImageMime(headBytes);
    if (sniffed) return sniffed;
  }

  return mimeFromFileName(name) ?? "";
}

export function extensionForImageMime(mime: string): string {
  const m = normalizeDeclaredImageMime(mime);
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  if (m === "image/avif") return "avif";
  if (m === "image/bmp") return "bmp";
  if (m === "image/heic" || m === "image/heif") return "heic";
  return "jpg";
}

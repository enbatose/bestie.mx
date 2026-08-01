/** Declared MIME aliases mobile clients often send instead of the IANA type. */
const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-jpeg": "image/jpeg",
  "image/jfif": "image/jpeg",
  "image/x-png": "image/png",
  "image/x-webp": "image/webp",
};

export const UPLOAD_ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  // SVG intentionally excluded — same-origin scriptable content (stored XSS).
  "image/bmp",
]);

export function normalizeDeclaredImageMime(type: string | undefined | null): string {
  const raw = (type ?? "").trim().toLowerCase();
  if (!raw) return "";
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

/** Sniff image MIME from magic bytes. */
export function sniffImageMime(buf: Buffer | Uint8Array): string | null {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (bytes.length < 12) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    asciiAt(bytes, 8, 4) === "WEBP"
  ) {
    return "image/webp";
  }
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

/**
 * Resolve a storeable upload MIME: magic bytes first (phones mislabel HEIC/JPEG),
 * then declared alias. Returns null when the bytes are not an allowed image.
 */
export function resolveUploadMime(declared: string | undefined | null, buffer: Buffer | Uint8Array): string | null {
  const sniffed = sniffImageMime(buffer);
  if (sniffed && UPLOAD_ALLOWED_MIMES.has(sniffed)) return sniffed;

  const normalized = normalizeDeclaredImageMime(declared);
  // Never accept SVG via declared MIME fallback (no reliable magic-byte sniff).
  if (normalized === "image/svg+xml") return null;
  if (UPLOAD_ALLOWED_MIMES.has(normalized)) return normalized;
  return null;
}

export function extForUploadMime(m: string): string {
  if (m === "image/jpeg") return ".jpg";
  if (m === "image/png") return ".png";
  if (m === "image/webp") return ".webp";
  if (m === "image/gif") return ".gif";
  if (m === "image/avif") return ".avif";
  if (m === "image/bmp") return ".bmp";
  return ".bin";
}

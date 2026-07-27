import { sniffImageMime } from "@/lib/imageMime";
import { isFilePermissionError } from "@/lib/persistPickedFile";

export type ImageUploadSource = "gallery" | "camera" | "drop" | "unknown";
export type ImageDecodePath = "bitmap" | "objectUrl" | "fileReader" | "heic2any" | "skipped" | "unknown";

export type ImageErrorCode =
  | "file_permission"
  | "file_empty"
  | "heic_unsupported"
  | "prepare_failed"
  | "upload_http"
  | "upload_too_large"
  | "upload_mimetype"
  | "persist_failed"
  | "unknown";

/** Coarse filename class for audits — never log the full name. */
export function classifyFileName(name: string | undefined | null): {
  nameExt: string;
  nameKind: "numeric" | "timestamp" | "whatsapp" | "heic" | "image" | "unnamed" | "other";
} {
  const raw = (name ?? "").trim();
  const extMatch = /\.([^.]+)$/.exec(raw);
  const nameExt = (extMatch?.[1] ?? "").toLowerCase().slice(0, 12) || "none";
  const base = raw.replace(/\.[^.]+$/i, "");
  if (!base || base === "foto" || base === "image" || base === "unnamed") {
    return { nameExt, nameKind: base === "unnamed" ? "unnamed" : "image" };
  }
  if (/^whatsapp/i.test(base) || /WA\d+/i.test(base)) return { nameExt, nameKind: "whatsapp" };
  if (/\.(hei[cf])$/i.test(raw) || /hei[cf]/i.test(nameExt)) return { nameExt, nameKind: "heic" };
  if (/^\d{10,}$/.test(base)) return { nameExt, nameKind: "numeric" };
  if (/^\d{8}[_-]\d{6}/.test(base) || /^IMG_\d+/i.test(base) || /^PXL_/i.test(base)) {
    return { nameExt, nameKind: "timestamp" };
  }
  return { nameExt, nameKind: "other" };
}

export function classifyImageError(err: unknown): ImageErrorCode {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (!raw) return "unknown";
  if (isFilePermissionError(raw)) return "file_permission";
  if (/iCloud|empty|zero.?byte|no se pudo leer esa foto/i.test(raw)) return "file_empty";
  if (/heic|heif/i.test(raw)) return "heic_unsupported";
  if (raw.includes("file_too_large") || raw.includes("LIMIT_FILE_SIZE")) return "upload_too_large";
  if (raw.startsWith("upload_http_")) return "upload_http";
  if (raw.includes("invalid_mimetype") || raw.includes("unsupported_image")) return "upload_mimetype";
  if (/prepare|convert|decode|encode|JPG\/PNG|jpg\/png/i.test(raw)) return "prepare_failed";
  if (/persist|arraybuffer/i.test(raw)) return "persist_failed";
  return "unknown";
}

export async function sampleImageHead(file: File): Promise<{
  declaredMime: string;
  sniffedMime: string | null;
  inputBytes: number;
  nameExt: string;
  nameKind: ReturnType<typeof classifyFileName>["nameKind"];
}> {
  const { nameExt, nameKind } = classifyFileName(file.name);
  let sniffedMime: string | null = null;
  try {
    const head = await file.slice(0, 64).arrayBuffer();
    sniffedMime = sniffImageMime(head);
  } catch {
    sniffedMime = null;
  }
  return {
    declaredMime: file.type || "unknown",
    sniffedMime,
    inputBytes: file.size,
    nameExt,
    nameKind,
  };
}

export function clientUploadEnv(): {
  mobileLike: boolean;
  coarsePointer: boolean;
  language: string;
  platform: string;
} {
  if (typeof navigator === "undefined") {
    return { mobileLike: false, coarsePointer: false, language: "", platform: "" };
  }
  const ua = navigator.userAgent || "";
  const mobileLike = /Android|iPhone|iPad|Mobile/i.test(ua);
  let coarsePointer = false;
  try {
    coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  } catch {
    coarsePointer = false;
  }
  return {
    mobileLike,
    coarsePointer,
    language: (navigator.language || "").slice(0, 16),
    platform: (navigator.platform || "").slice(0, 32),
  };
}

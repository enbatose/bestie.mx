/** Clipboard / OS file names that are images even when MIME is empty. */
const IMAGE_NAME_RE = /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)$/i;

export function isClipboardImageFile(file: File): boolean {
  return file.type.startsWith("image/") || IMAGE_NAME_RE.test(file.name);
}

type ClipboardFileSource = {
  items?: ArrayLike<{ kind?: string; type: string; getAsFile: () => File | null }>;
  files?: ArrayLike<File>;
};

/**
 * Images from a paste/drop DataTransfer: screenshot items first, then OS file copies.
 * Call synchronously during the paste event — `getAsFile()` is empty after it returns.
 */
export function imageFilesFromClipboard(data: ClipboardFileSource | null | undefined): File[] {
  if (!data) return [];
  const seen = new Set<File>();
  const out: File[] = [];

  const add = (file: File | null | undefined) => {
    if (!file || seen.has(file) || !isClipboardImageFile(file)) return;
    seen.add(file);
    out.push(file);
  };

  for (const item of Array.from(data.items ?? [])) {
    if (item.kind && item.kind !== "file") continue;
    if (item.type && !item.type.startsWith("image/")) continue;
    add(item.getAsFile());
  }
  if (out.length) return out;

  for (const file of Array.from(data.files ?? [])) add(file);
  return out;
}

export type ClipboardPasteTargetState = {
  id: string;
  enabled: boolean;
  pointerOver: boolean;
  focused: boolean;
};

/** Which drop zone should receive Ctrl+V when several photo widgets are on screen. */
export function shouldAcceptClipboardImagePaste(
  targets: ClipboardPasteTargetState[],
  candidateId: string,
): boolean {
  const self = targets.find((t) => t.id === candidateId);
  if (!self?.enabled) return false;
  if (self.pointerOver || self.focused) return true;
  const enabled = targets.filter((t) => t.enabled);
  return enabled.length === 1;
}

export function isTypingPasteTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return false;
  const typing = el.closest("input, textarea, [contenteditable='true']");
  if (!typing) return false;
  if (typeof HTMLInputElement !== "undefined" && typing instanceof HTMLInputElement) {
    const type = typing.type;
    if (
      type === "file" ||
      type === "hidden" ||
      type === "button" ||
      type === "submit" ||
      type === "reset" ||
      type === "checkbox" ||
      type === "radio"
    ) {
      return false;
    }
  }
  return true;
}

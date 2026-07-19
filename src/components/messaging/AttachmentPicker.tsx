import { useRef } from "react";

export const ATTACHMENT_MAX_FILES = 5;
export const ATTACHMENT_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ATTACHMENT_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function AttachIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 10.5V17a4 4 0 01-4 4H8a5 5 0 01-5-5V7a4 4 0 014-4h7.5A2.5 2.5 0 0117 5.5V14a2.5 2.5 0 01-5 0V7"
      />
    </svg>
  );
}

/** Validates a batch of newly-picked files against the shared attachment limits. */
export function validatePickedFiles(
  existing: File[],
  picked: File[],
  maxFiles: number = ATTACHMENT_MAX_FILES,
): { accepted: File[]; error: string | null } {
  const room = Math.max(0, maxFiles - existing.length);
  if (room <= 0) {
    return { accepted: [], error: `Puedes adjuntar hasta ${maxFiles} imágenes.` };
  }
  const accepted: File[] = [];
  let error: string | null = null;
  for (const file of picked) {
    if (!ATTACHMENT_ALLOWED_TYPES.has(file.type)) {
      error = "Solo se permiten imágenes (JPG, PNG, WEBP o GIF).";
      continue;
    }
    if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
      error = "Cada imagen debe pesar máximo 5 MB.";
      continue;
    }
    accepted.push(file);
    if (accepted.length >= room) break;
  }
  return { accepted, error };
}

export function AttachmentPicker({
  files,
  onFilesChange,
  disabled = false,
  maxFiles = ATTACHMENT_MAX_FILES,
  onError,
  className = "",
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  onError?: (message: string) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePicked = (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    const { accepted, error } = validatePickedFiles(files, Array.from(picked), maxFiles);
    if (accepted.length > 0) onFilesChange([...files, ...accepted]);
    if (error) onError?.(error);
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          handlePicked(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled || files.length >= maxFiles}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-body transition hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900"
      >
        <AttachIcon />
        Adjuntar imagen
      </button>

      {files.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`} className="relative">
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="size-16 rounded-lg border border-border object-cover"
              />
              <button
                type="button"
                disabled={disabled}
                aria-label={`Quitar ${file.name}`}
                onClick={() => onFilesChange(files.filter((_, idx) => idx !== i))}
                className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-error text-[11px] font-bold text-white shadow-sm"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

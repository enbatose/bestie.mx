import { useCallback, useRef, useState } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import {
  PREPARE_IMAGE_FAIL_MESSAGE,
  fileToPreparedImagePayload,
  isProbablyImageFile,
} from "@/lib/prepareListingImage";
import { useClipboardImagePaste } from "@/hooks/useClipboardImagePaste";

export type AiLocalImage = {
  mimeType: string;
  data?: string;
  preview: string;
  url?: string;
};

export function toComposeImages(images: AiLocalImage[]) {
  return images.map((img) =>
    img.data
      ? { mimeType: img.mimeType, data: img.data }
      : { url: img.url, mimeType: img.mimeType },
  );
}

/** Fetch URL-only images (Autopoblar `/admin-seed/…`) so compose can persist `/api/uploads/…`. */
export async function hydrateLocalImagesForCompose(images: AiLocalImage[]): Promise<AiLocalImage[]> {
  const out: AiLocalImage[] = [];
  for (const img of images) {
    if (img.data) {
      out.push(img);
      continue;
    }
    if (img.url?.startsWith("/api/uploads/")) {
      out.push(img);
      continue;
    }
    const src = img.preview || img.url;
    if (!src) {
      out.push(img);
      continue;
    }
    try {
      const res = await fetch(src);
      if (!res.ok) {
        out.push(img);
        continue;
      }
      const blob = await res.blob();
      const file = new File([blob], "foto.jpg", { type: blob.type || "image/jpeg" });
      out.push(await fileToPreparedImagePayload(file));
    } catch {
      out.push(img);
    }
  }
  return out;
}

type Props = {
  images: AiLocalImage[];
  onImages: (next: AiLocalImage[]) => void;
  label: string;
  hint: string;
  maxCount: number;
  showCamera?: boolean;
};

export function AiImageDropZone({
  images,
  onImages,
  label,
  hint,
  maxCount,
  showCamera = false,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const remaining = Math.max(0, maxCount - images.length);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      if (remaining <= 0 || busyRef.current) return;
      const arr = Array.from(files).filter(isProbablyImageFile).slice(0, remaining);
      if (!arr.length) return;
      busyRef.current = true;
      setErr(null);
      const next: AiLocalImage[] = [];
      try {
        for (let i = 0; i < arr.length; i++) {
          setBusy(arr.length === 1 ? "Optimizando foto…" : `Optimizando ${i + 1}/${arr.length}…`);
          try {
            next.push(await fileToPreparedImagePayload(arr[i]!));
          } catch (e) {
            setErr(e instanceof Error ? e.message : PREPARE_IMAGE_FAIL_MESSAGE);
          }
        }
        if (next.length) onImages([...images, ...next]);
      } finally {
        busyRef.current = false;
        setBusy(null);
      }
    },
    [images, onImages, remaining],
  );

  const { zoneRef, zonePasteProps } = useClipboardImagePaste({
    enabled: remaining > 0 && !busy,
    onFiles: (files) => {
      void addFiles(files);
    },
  });

  return (
    <div
      ref={zoneRef}
      {...zonePasteProps}
      className={`relative rounded-xl border-2 border-dashed p-4 outline-none transition focus-visible:ring-2 focus-visible:ring-accent/40 ${
        dragging ? "border-secondary bg-secondary/5" : "border-border bg-bg-light"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void addFiles(e.dataTransfer.files);
      }}
      role="region"
      aria-label={label}
    >
      <p className="mb-1 text-sm font-semibold text-body">{label}</p>
      <p className="mb-3 text-xs text-muted">{hint}</p>
      {busy ? (
        <p className="mb-3 text-xs font-medium text-body" role="status">
          {busy}
        </p>
      ) : null}
      {err ? (
        <p className="mb-3 min-w-0 break-words text-xs text-error" role="alert">
          {err}
        </p>
      ) : null}

      {images.length === 0 ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={Boolean(busy)}
            className="flex w-full flex-col items-center gap-2 rounded-lg border border-border bg-surface py-6 text-muted hover:bg-surface-elevated disabled:opacity-50"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus size={24} className="opacity-50" />
            <span className="text-xs">Pegar · Soltar aquí · Elegir archivo</span>
          </button>
          {showCamera ? (
            <button
              type="button"
              disabled={Boolean(busy)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-body hover:bg-surface-elevated disabled:opacity-50"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera size={16} aria-hidden />
              Tomar foto
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {images.map((img, i) => (
            <div key={`${img.preview}-${i}`} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border">
              <img src={img.preview} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="Eliminar imagen"
                className="absolute right-1 top-1 inline-flex size-8 items-center justify-center rounded-full bg-black/70 text-white"
                onClick={() => onImages(images.filter((_, j) => j !== i))}
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </div>
          ))}
          {remaining > 0 ? (
            <button
              type="button"
              disabled={Boolean(busy)}
              className="flex h-20 w-20 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-muted hover:bg-surface-elevated disabled:opacity-50"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Agregar más imágenes"
            >
              <ImagePlus size={20} />
            </button>
          ) : null}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple={maxCount > 1}
        accept="image/*"
        disabled={Boolean(busy)}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {showCamera ? (
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          disabled={Boolean(busy)}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      ) : null}
    </div>
  );
}

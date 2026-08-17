import { useCallback, useRef, useState } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";

export type AiLocalImage = {
  mimeType: string;
  data?: string;
  preview: string;
  url?: string;
};

async function fileToLocalImage(file: File): Promise<AiLocalImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(",");
      const header = result.slice(0, idx);
      const data = result.slice(idx + 1);
      const mimeType = header.split(":")[1]?.split(";")[0] ?? "image/jpeg";
      resolve({ mimeType, data, preview: result });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function toComposeImages(images: AiLocalImage[]) {
  return images.map((img) =>
    img.data
      ? { mimeType: img.mimeType, data: img.data }
      : { url: img.url, mimeType: img.mimeType },
  );
}

/** Fetch URL-only images (Autopoblar `/admin-seed/…`) so compose can persist `/api/uploads/…`. */
export async function hydrateLocalImagesForCompose(images: AiLocalImage[]): Promise<AiLocalImage[]> {
  return Promise.all(
    images.map(async (img) => {
      if (img.data) return img;
      if (img.url?.startsWith("/api/uploads/")) return img;
      const src = img.preview || img.url;
      if (!src) return img;
      try {
        const res = await fetch(src);
        if (!res.ok) return img;
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const idx = dataUrl.indexOf(",");
        if (idx < 0) return img;
        return {
          ...img,
          mimeType: blob.type || img.mimeType || "image/jpeg",
          data: dataUrl.slice(idx + 1),
        };
      } catch {
        return img;
      }
    }),
  );
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const remaining = Math.max(0, maxCount - images.length);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      if (remaining <= 0) return;
      const arr = Array.from(files)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, remaining);
      if (!arr.length) return;
      const converted = await Promise.all(arr.map(fileToLocalImage));
      onImages([...images, ...converted]);
    },
    [images, onImages, remaining],
  );

  return (
    <div
      className={`relative rounded-xl border-2 border-dashed p-4 transition ${
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
      onPaste={(e) => {
        const items = Array.from(e.clipboardData?.items ?? []).filter((i) => i.type.startsWith("image/"));
        if (!items.length) return;
        const files = items.map((i) => i.getAsFile()).filter((f): f is File => f != null);
        void addFiles(files);
      }}
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      <p className="mb-1 text-sm font-semibold text-body">{label}</p>
      <p className="mb-3 text-xs text-muted">{hint}</p>

      {images.length === 0 ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="flex w-full flex-col items-center gap-2 rounded-lg border border-border bg-surface py-6 text-muted hover:bg-surface-elevated"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus size={24} className="opacity-50" />
            <span className="text-xs">Pegar · Soltar aquí · Elegir archivo</span>
          </button>
          {showCamera ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-body hover:bg-surface-elevated"
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
              className="flex h-20 w-20 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-muted hover:bg-surface-elevated"
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

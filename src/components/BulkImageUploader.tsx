import { useCallback, useMemo, useRef, useState } from "react";
import { Star } from "lucide-react";
import { apiAbsoluteUrl } from "@/lib/mediaUrl";
import { uploadListingImage } from "@/lib/listingsApi";
import { perfEnd, perfSampleImageInput, perfStart } from "@/lib/perf";
import { trackImagePipeline } from "@/lib/imageTelemetry";
import {
  PREPARE_IMAGE_EMPTY_MESSAGE,
  PREPARE_IMAGE_FAIL_MESSAGE,
  PREPARE_IMAGE_HEIC_MESSAGE,
  prepareListingImage,
} from "@/lib/prepareListingImage";
import {
  appendDraftImageUrl,
  removeDraftImage,
  setDraftImageCover,
  type DraftImage,
} from "@/lib/publishWizard/draftImages";

type Props = {
  /** Display label */
  title: string;
  /** Current uploaded images (cover flagged with `isCover`). */
  images: DraftImage[];
  /** Max number of images allowed */
  maxCount: number;
  /** Called when images change */
  onImagesChange: (next: DraftImage[]) => void;
  /** If false, shows an error instead of uploading */
  apiOn: boolean;
  /** Optional helper text */
  hint?: string;
  /** Called after a batch of files finishes uploading (or fails). */
  onBatchComplete?: () => void;
};

type BusyRow = {
  name: string;
  stage: "preparando" | "optimizando" | "subiendo";
};

function friendlyUploadError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  if (!raw) return "No se pudieron subir las imágenes.";
  if (raw.includes("invalid_mimetype") || raw.includes("unsupported_image")) {
    return "Formato de imagen no soportado. Intenta con JPG o PNG.";
  }
  if (raw.includes("file_too_large") || raw.includes("LIMIT_FILE_SIZE")) {
    return "La imagen supera el máximo de 12 MB.";
  }
  if (raw.startsWith("upload_http_")) {
    return "No se pudo subir la imagen. Revisa tu conexión e intenta de nuevo.";
  }
  return raw;
}

export function BulkImageUploader({ title, images, maxCount, onImagesChange, apiOn, hint, onBatchComplete }: Props) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyRow | null>(null);
  const batchIdRef = useRef<string>(
    globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now()),
  );
  const imagesRef = useRef(images);
  imagesRef.current = images;

  const remaining = Math.max(0, maxCount - images.length);
  const accept = useMemo(() => "image/*", []);

  const remove = useCallback(
    (ix: number) => {
      onImagesChange(removeDraftImage(images, ix));
    },
    [images, onImagesChange],
  );

  const setCover = useCallback(
    (url: string) => {
      onImagesChange(setDraftImageCover(images, url));
    },
    [images, onImagesChange],
  );

  const addFiles = useCallback(
    async (files: File[]) => {
      setErr(null);
      if (!apiOn) {
        setErr("Configura VITE_API_URL para subir imágenes al servidor.");
        return;
      }
      const take = files.slice(0, remaining);
      if (!take.length) return;

      const batchId = batchIdRef.current;
      const batchMark = perfStart("batch_full");
      try {
        let current = imagesRef.current;
        for (const f of take) {
          setBusy({ name: f.name || "foto", stage: "optimizando" });
          const m1 = perfStart("convert");
          let converted: Awaited<ReturnType<typeof prepareListingImage>>;
          try {
            converted = await prepareListingImage(f);
          } catch (e) {
            await trackImagePipeline({
              batchId,
              step: "convert",
              ms: perfEnd(m1).ms,
              ok: false,
              error: e instanceof Error ? e.message : "convert_error",
              ...perfSampleImageInput(f),
            });
            if (
              e instanceof Error &&
              (e.message === PREPARE_IMAGE_FAIL_MESSAGE ||
                e.message === PREPARE_IMAGE_HEIC_MESSAGE ||
                e.message === PREPARE_IMAGE_EMPTY_MESSAGE)
            ) {
              throw e;
            }
            throw new Error(PREPARE_IMAGE_FAIL_MESSAGE);
          }

          const convertSpan = perfEnd(m1);
          await trackImagePipeline({
            batchId,
            step: "convert",
            ms: convertSpan.ms,
            ok: true,
            inputBytes: f.size,
            outputBytes: converted.outFile.size,
            inputType: f.type || "unknown",
            outputType: converted.outputType,
            inputW: converted.inputW,
            inputH: converted.inputH,
            outputW: converted.outputW,
            outputH: converted.outputH,
          });

          setBusy({ name: f.name || "foto", stage: "subiendo" });
          const m2 = perfStart("upload");
          let url: string;
          try {
            url = await uploadListingImage(converted.outFile);
          } catch (uploadErr) {
            await trackImagePipeline({
              batchId,
              step: "upload",
              ms: perfEnd(m2).ms,
              ok: false,
              error: uploadErr instanceof Error ? uploadErr.message : "upload_error",
              outputBytes: converted.outFile.size,
              outputType: converted.outputType,
            });
            throw uploadErr;
          }
          const uploadSpan = perfEnd(m2);
          await trackImagePipeline({
            batchId,
            step: "upload",
            ms: uploadSpan.ms,
            ok: true,
            outputBytes: converted.outFile.size,
            outputType: converted.outputType,
            outputW: converted.outputW,
            outputH: converted.outputH,
          });

          current = appendDraftImageUrl(current, url, maxCount);
          onImagesChange(current);
        }
      } catch (e) {
        const raw = e instanceof Error ? e.message : "";
        if (
          raw.startsWith("upload_http_") ||
          raw.includes("invalid_mimetype") ||
          raw.includes("unsupported_image") ||
          raw.includes("file_too_large") ||
          raw.includes("LIMIT_FILE_SIZE")
        ) {
          setErr(friendlyUploadError(e));
        } else if (raw) {
          setErr(raw);
        } else {
          setErr(PREPARE_IMAGE_FAIL_MESSAGE);
        }
      } finally {
        setBusy(null);
        const fullSpan = perfEnd(batchMark);
        await trackImagePipeline({
          batchId: batchIdRef.current,
          step: "full",
          ms: fullSpan.ms,
          ok: true,
          fileCount: take.length,
        }).catch(() => null);
        onBatchComplete?.();
      }
    },
    [apiOn, maxCount, onBatchComplete, onImagesChange, remaining],
  );

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-body">{title}</h3>
          <p className="mt-1 text-xs text-muted">
            {images.length}/{maxCount} fotos
            {hint ? ` · ${hint}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-body hover:bg-surface-elevated">
            <input
              type="file"
              accept={accept}
              multiple
              className="sr-only"
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                e.target.value = "";
                void addFiles(files);
              }}
            />
            Subir fotos
          </label>
          <label className="inline-flex cursor-pointer items-center rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-body hover:bg-surface-elevated">
            <input
              type="file"
              accept={accept}
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                e.target.value = "";
                void addFiles(files);
              }}
            />
            Tomar foto
          </label>
        </div>
      </div>

      {err ? <p className="mt-3 text-sm text-error">{err}</p> : null}
      {busy ? (
        <p className="mt-3 text-xs text-muted" aria-live="polite">
          {busy.stage === "optimizando"
            ? `Optimizando ${busy.name}…`
            : busy.stage === "subiendo"
              ? `Subiendo ${busy.name}…`
              : `Preparando ${busy.name}…`}
        </p>
      ) : null}

      <div
        className="mt-3 rounded-xl border border-dashed border-border bg-bg-light p-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const files = Array.from(e.dataTransfer.files ?? []).filter(
            (f) => f.type.startsWith("image/") || /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)$/i.test(f.name),
          );
          void addFiles(files);
        }}
      >
        <p className="text-xs text-muted">Arrastra y suelta aquí para subir en bloque. Toca la estrella para elegir la portada.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {images.map((img, ix) => (
            <div
              key={`${img.url}-${ix}`}
              className={`relative h-24 w-24 overflow-hidden rounded-lg border bg-bg-light ${
                img.isCover ? "border-primary ring-2 ring-primary/40" : "border-border"
              }`}
            >
              <img src={apiAbsoluteUrl(img.url)} alt="" className="h-full w-full object-cover" />
              {img.isCover ? (
                <span className="absolute left-1 top-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-fg">
                  Portada
                </span>
              ) : null}
              <button
                type="button"
                className={`absolute bottom-1 left-1 rounded-full p-1 ${
                  img.isCover ? "bg-primary text-primary-fg" : "bg-black/60 text-white hover:bg-black/80"
                }`}
                onClick={() => setCover(img.url)}
                aria-label={img.isCover ? "Foto de portada" : "Hacer portada"}
                aria-pressed={img.isCover}
              >
                <Star className={`size-3.5 ${img.isCover ? "fill-current" : ""}`} aria-hidden />
              </button>
              <button
                type="button"
                className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-xs text-white"
                onClick={() => remove(ix)}
                aria-label="Quitar"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

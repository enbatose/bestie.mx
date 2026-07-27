import { useCallback, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Star } from "lucide-react";
import { apiAbsoluteUrl } from "@/lib/mediaUrl";
import { uploadListingImage } from "@/lib/listingsApi";
import { perfEnd, perfStart } from "@/lib/perf";
import { fileAuditFields, trackImagePipeline } from "@/lib/imageTelemetry";
import {
  PREPARE_IMAGE_FAIL_MESSAGE,
  prepareListingImage,
} from "@/lib/prepareListingImage";
import { classifyImageError, sampleImageHead, type ImageUploadSource } from "@/lib/imageUploadDiagnostics";
import { isFilePermissionError, persistPickedFiles } from "@/lib/persistPickedFile";
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
  if (isFilePermissionError(raw)) {
    return "No se pudo leer esa foto. Vuelve a seleccionarla e intenta de nuevo.";
  }
  if (raw.includes("invalid_mimetype") || raw.includes("unsupported_image")) {
    return "Formato de imagen no soportado. Intenta con JPG o PNG.";
  }
  if (raw.includes("file_too_large") || raw.includes("LIMIT_FILE_SIZE")) {
    return "La imagen supera el máximo de 12 MB.";
  }
  if (raw.startsWith("upload_http_")) {
    return "No se pudo subir la imagen. Revisa tu conexión e intenta de nuevo.";
  }
  if (/^[A-Za-z]/.test(raw) && raw.includes(" ")) {
    return PREPARE_IMAGE_FAIL_MESSAGE;
  }
  return raw;
}

function httpStatusFromUploadError(err: unknown): number | undefined {
  const raw = err instanceof Error ? err.message : "";
  const m = /^upload_http_(\d+)/.exec(raw);
  return m ? Number(m[1]) : undefined;
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
    async (files: File[], source: ImageUploadSource = "unknown") => {
      setErr(null);
      if (!apiOn) {
        setErr("Configura VITE_API_URL para subir imágenes al servidor.");
        return;
      }
      const take = files.slice(0, remaining);
      if (!take.length) return;

      const batchId = batchIdRef.current;
      const batchMark = perfStart("batch_full");
      const failures: string[] = [];
      let successCount = 0;
      try {
        let current = imagesRef.current;
        for (const f of take) {
          const label = f.name || "foto";
          const audit = fileAuditFields(f);
          let sniffedMime: string | null | undefined;
          try {
            sniffedMime = (await sampleImageHead(f)).sniffedMime;
          } catch {
            sniffedMime = null;
          }

          setBusy({ name: label, stage: "optimizando" });
          const m1 = perfStart("convert");
          let converted: Awaited<ReturnType<typeof prepareListingImage>>;
          try {
            converted = await prepareListingImage(f);
          } catch (e) {
            const raw = e instanceof Error ? e.message : "convert_error";
            await trackImagePipeline({
              batchId,
              step: "convert",
              ms: perfEnd(m1).ms,
              ok: false,
              surface: "publish_wizard",
              source,
              error: raw,
              errorCode: classifyImageError(e),
              sniffedMime,
              ...audit,
            });
            failures.push(friendlyUploadError(e));
            continue;
          }

          const convertSpan = perfEnd(m1);
          await trackImagePipeline({
            batchId,
            step: "convert",
            ms: convertSpan.ms,
            ok: true,
            surface: "publish_wizard",
            source,
            inputBytes: f.size,
            outputBytes: converted.outFile.size,
            inputType: f.type || "unknown",
            outputType: converted.outputType,
            declaredMime: converted.diagnostics.declaredMime,
            sniffedMime: converted.diagnostics.sniffedMime,
            decodePath: converted.diagnostics.decodePath,
            heicConverted: converted.diagnostics.heicConverted,
            inputW: converted.inputW,
            inputH: converted.inputH,
            outputW: converted.outputW,
            outputH: converted.outputH,
            ...audit,
          });

          setBusy({ name: label, stage: "subiendo" });
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
              surface: "publish_wizard",
              source,
              error: uploadErr instanceof Error ? uploadErr.message : "upload_error",
              errorCode: classifyImageError(uploadErr),
              httpStatus: httpStatusFromUploadError(uploadErr),
              outputBytes: converted.outFile.size,
              outputType: converted.outputType,
              decodePath: converted.diagnostics.decodePath,
              ...audit,
            });
            failures.push(friendlyUploadError(uploadErr));
            continue;
          }
          const uploadSpan = perfEnd(m2);
          await trackImagePipeline({
            batchId,
            step: "upload",
            ms: uploadSpan.ms,
            ok: true,
            surface: "publish_wizard",
            source,
            outputBytes: converted.outFile.size,
            outputType: converted.outputType,
            outputW: converted.outputW,
            outputH: converted.outputH,
            decodePath: converted.diagnostics.decodePath,
            ...audit,
          });

          current = appendDraftImageUrl(current, url, maxCount);
          onImagesChange(current);
          successCount += 1;
        }
        if (failures.length) {
          setErr(failures[failures.length - 1] ?? PREPARE_IMAGE_FAIL_MESSAGE);
        }
      } finally {
        setBusy(null);
        const fullSpan = perfEnd(batchMark);
        await trackImagePipeline({
          batchId: batchIdRef.current,
          step: "full",
          ms: fullSpan.ms,
          ok: failures.length === 0,
          surface: "publish_wizard",
          source,
          fileCount: take.length,
          successCount,
          failureCount: failures.length,
          error: failures[0],
          errorCode: failures.length ? classifyImageError(failures[0]) : undefined,
        }).catch(() => null);
        onBatchComplete?.();
      }
    },
    [apiOn, maxCount, onBatchComplete, onImagesChange, remaining],
  );

  const pickAndAdd = useCallback(
    (source: ImageUploadSource) => (e: ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const list = input.files ? Array.from(input.files) : [];
      void (async () => {
        const persistMark = perfStart("persist");
        try {
          const files = list.length ? await persistPickedFiles(list) : [];
          await trackImagePipeline({
            batchId: batchIdRef.current,
            step: "persist",
            ms: perfEnd(persistMark).ms,
            ok: true,
            surface: "publish_wizard",
            source,
            fileCount: files.length,
          });
          input.value = "";
          void addFiles(files, source);
        } catch (err) {
          await trackImagePipeline({
            batchId: batchIdRef.current,
            step: "persist",
            ms: perfEnd(persistMark).ms,
            ok: false,
            surface: "publish_wizard",
            source,
            error: err instanceof Error ? err.message : "persist_failed",
            errorCode: classifyImageError(err),
            fileCount: list.length,
          });
          input.value = "";
          setErr(friendlyUploadError(err));
        }
      })();
    },
    [addFiles],
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
            <input type="file" accept={accept} multiple className="sr-only" onChange={pickAndAdd("gallery")} />
            Subir fotos
          </label>
          <label className="inline-flex cursor-pointer items-center rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-body hover:bg-surface-elevated">
            <input
              type="file"
              accept={accept}
              capture="environment"
              className="sr-only"
              onChange={pickAndAdd("camera")}
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
          void (async () => {
            try {
              const durable = files.length ? await persistPickedFiles(files) : [];
              void addFiles(durable, "drop");
            } catch (dropErr) {
              setErr(friendlyUploadError(dropErr));
            }
          })();
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

import { useCallback, useMemo, useRef, useState } from "react";
import { apiAbsoluteUrl } from "@/lib/mediaUrl";
import { uploadListingImage } from "@/lib/listingsApi";
import { perfEnd, perfSampleImageInput, perfStart } from "@/lib/perf";
import { trackImagePipeline } from "@/lib/imageTelemetry";

type Props = {
  /** Display label */
  title: string;
  /** Current uploaded urls */
  urls: string[];
  /** Max number of images allowed */
  maxCount: number;
  /** Called when urls change */
  onChange: (next: string[]) => void;
  /** If false, shows an error instead of uploading */
  apiOn: boolean;
  /** Optional helper text */
  hint?: string;
};

type BusyRow = {
  name: string;
  stage: "preparando" | "optimizando" | "subiendo";
};

const MAX_SKIP_BYTES = 500_000;
const MAX_EDGE = 1920;
const WEB_SAFE_UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

function supportsWebpCanvas(): boolean {
  try {
    if (typeof document === "undefined") return false;
    const c = document.createElement("canvas");
    return c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

async function getImageDims(file: File): Promise<{ w: number; h: number }> {
  // Fast path: createImageBitmap is generally faster than HTMLImageElement.
  const bmp = await createImageBitmap(file);
  try {
    return { w: bmp.width, h: bmp.height };
  } finally {
    bmp.close();
  }
}

function clampResize(w: number, h: number, maxEdge: number): { w: number; h: number } {
  const edge = Math.max(w, h);
  if (edge <= maxEdge) return { w, h };
  const s = maxEdge / edge;
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

async function convertIfNeeded(file: File): Promise<{
  outFile: File;
  inputW: number;
  inputH: number;
  outputW: number;
  outputH: number;
  skipped: boolean;
  outputType: string;
}> {
  const { w: inputW, h: inputH } = await getImageDims(file);
  const { w: outputW, h: outputH } = clampResize(inputW, inputH, MAX_EDGE);

  // Skip recompress only for formats the API accepts and browsers render reliably.
  if (WEB_SAFE_UPLOAD_TYPES.has(file.type) && file.size <= MAX_SKIP_BYTES && outputW === inputW && outputH === inputH) {
    return {
      outFile: file,
      inputW,
      inputH,
      outputW,
      outputH,
      skipped: true,
      outputType: file.type || "unknown",
    };
  }

  const preferWebp = supportsWebpCanvas();
  const bitmap = await createImageBitmap(file, {
    resizeWidth: outputW,
    resizeHeight: outputH,
    resizeQuality: "high",
  });
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("canvas_2d_unavailable");
    ctx.drawImage(bitmap, 0, 0);

    const type = preferWebp ? "image/webp" : "image/jpeg";
    const quality = preferWebp ? 0.82 : 0.85;
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("encode_failed"))),
        type,
        quality,
      );
    });

    const nameBase = (file.name || "foto").replace(/\.[^.]+$/i, "");
    const ext = preferWebp ? "webp" : "jpg";
    const outFile = new File([blob], `${nameBase}.${ext}`, { type });
    return {
      outFile,
      inputW,
      inputH,
      outputW: bitmap.width,
      outputH: bitmap.height,
      skipped: false,
      outputType: type,
    };
  } finally {
    bitmap.close();
  }
}

export function BulkImageUploader({ title, urls, maxCount, onChange, apiOn, hint }: Props) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyRow | null>(null);
  const batchIdRef = useRef<string>(
    globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now()),
  );
  const urlsRef = useRef(urls);
  urlsRef.current = urls;

  const remaining = Math.max(0, maxCount - urls.length);
  const accept = useMemo(() => "image/*", []);

  const remove = useCallback(
    (ix: number) => {
      onChange(urls.filter((_, j) => j !== ix));
    },
    [onChange, urls],
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
        for (const f of take) {
          setBusy({ name: f.name || "foto", stage: "optimizando" });
          const m1 = perfStart("convert");
          let converted: Awaited<ReturnType<typeof convertIfNeeded>>;
          try {
            converted = await convertIfNeeded(f);
          } catch (e) {
            await trackImagePipeline({
              batchId,
              step: "convert",
              ms: perfEnd(m1).ms,
              ok: false,
              error: e instanceof Error ? e.message : "convert_error",
              ...perfSampleImageInput(f),
            });
            throw new Error("No se pudo preparar esa imagen. Intenta con otra foto o conviértela a JPG/PNG.");
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
          const url = await uploadListingImage(converted.outFile);
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

          const next = [...urlsRef.current, url].slice(0, maxCount);
          onChange(next);
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "No se pudieron subir las imágenes.");
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
      }
    },
    [apiOn, maxCount, onChange, remaining, urls],
  );

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-body">{title}</h3>
          <p className="mt-1 text-xs text-muted">
            {urls.length}/{maxCount} fotos
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
        <p className="text-xs text-muted">Arrastra y suelta aquí para subir en bloque.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {urls.map((u, ix) => (
            <div
              key={`${u}-${ix}`}
              className="relative h-24 w-24 overflow-hidden rounded-lg border border-border bg-bg-light"
            >
              <img src={apiAbsoluteUrl(u)} alt="" className="h-full w-full object-cover" />
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


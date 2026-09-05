import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import {
  PREPARE_IMAGE_FAIL_MESSAGE,
  prepareListingImageForUpload,
} from "@/lib/prepareListingImage";
import { imageFilesFromClipboard } from "@/lib/clipboardImages";

type Props = {
  busy: boolean;
  onPublish: (file: File, note?: string) => void | Promise<void>;
  /** Primary button label. */
  submitLabel?: string;
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

/** How many evidence forms are on screen — a single form can take Ctrl+V without a click. */
let mountedConsentForms = 0;

function firstImageFile(files: FileList | File[] | null | undefined): File | null {
  if (!files) return null;
  return Array.from(files).find((file) => file.type.startsWith("image/")) ?? null;
}

/**
 * Consent screenshot + optional note for publishing unclaimed admin-outreach drafts.
 * Evidence is stored privately — never as listing photos.
 * Accepts file picker, drag-and-drop, or clipboard paste (Ctrl+V).
 */
export function AdminConsentEvidenceForm({
  busy,
  onPublish,
  submitLabel = "Publicar sin dueño",
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [dragging, setDragging] = useState(false);
  const [pointerOver, setPointerOver] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepareErr, setPrepareErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const prepareGenRef = useRef(0);

  const applyFile = useCallback((next: File | null) => {
    if (!next) {
      prepareGenRef.current += 1;
      setFile(null);
      setPrepareErr(null);
      setPreparing(false);
      return;
    }
    const gen = ++prepareGenRef.current;
    setPreparing(true);
    setPrepareErr(null);
    void (async () => {
      try {
        const compressed = await prepareListingImageForUpload(next);
        if (gen !== prepareGenRef.current) return;
        setFile(compressed);
      } catch (e) {
        if (gen !== prepareGenRef.current) return;
        setFile(null);
        setPrepareErr(e instanceof Error ? e.message : PREPARE_IMAGE_FAIL_MESSAGE);
      } finally {
        if (gen === prepareGenRef.current) setPreparing(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    mountedConsentForms += 1;
    return () => {
      mountedConsentForms -= 1;
    };
  }, []);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (busy || preparing) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      const zone = zoneRef.current;
      const inZone = Boolean(zone && target && zone.contains(target));
      const zoneFocused = Boolean(
        zone && (document.activeElement === zone || zone.contains(document.activeElement)),
      );
      const soleForm = mountedConsentForms <= 1;
      if (!inZone && !zoneFocused && !pointerOver && !soleForm) return;
      const next = imageFilesFromClipboard(event.clipboardData)[0] ?? null;
      if (!next) return;
      event.preventDefault();
      applyFile(next);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [applyFile, busy, pointerOver, preparing]);

  return (
    <div className="min-w-0 space-y-2 overflow-x-clip rounded-xl border border-primary/20 bg-primary/5 p-3">
      <p className="text-xs leading-snug text-body">
        Publicar sin dueño: adjunta una captura de consentimiento (no las fotos del anuncio). La
        evidencia no se muestra al público.
      </p>
      {preparing ? (
        <p className="text-xs font-medium text-body" role="status">
          Optimizando captura…
        </p>
      ) : null}
      {prepareErr ? (
        <p className="min-w-0 break-words text-xs text-error" role="alert">
          {prepareErr}
        </p>
      ) : null}
      <div
        ref={zoneRef}
        tabIndex={0}
        role="region"
        aria-label="Captura de consentimiento"
        onMouseEnter={() => setPointerOver(true)}
        onMouseLeave={() => setPointerOver(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (busy || preparing) return;
          const next = firstImageFile(event.dataTransfer.files);
          if (next) applyFile(next);
        }}
        className={`min-w-0 rounded-xl border-2 border-dashed p-3 outline-none transition ${
          dragging ? "border-secondary bg-secondary/5" : "border-border bg-bg-light"
        }`}
      >
        {file && previewUrl ? (
          <div className="flex min-w-0 flex-col gap-2">
            <div className="relative min-w-0 overflow-x-clip rounded-lg border border-border bg-surface">
              <img
                src={previewUrl}
                alt="Vista previa de la captura de consentimiento"
                className="mx-auto max-h-40 w-full max-w-full object-contain"
              />
              <button
                type="button"
                disabled={busy || preparing}
                aria-label="Quitar captura"
                onClick={() => applyFile(null)}
                className="absolute right-1.5 top-1.5 inline-flex size-8 items-center justify-center rounded-full bg-black/70 text-white disabled:opacity-50"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </div>
            <p className="min-w-0 break-all text-center text-[11px] text-muted">{file.name}</p>
            <button
              type="button"
              disabled={busy || preparing}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border bg-surface px-3 text-xs font-semibold text-body hover:bg-surface-elevated disabled:opacity-50"
            >
              Cambiar archivo
            </button>
          </div>
        ) : (
          <div className="flex w-full min-w-0 flex-col items-center gap-2 px-2 py-4 text-muted">
            <ImagePlus className="size-6 opacity-50" aria-hidden />
            <p className="text-center text-xs leading-snug">
              Pega una captura (Ctrl+V) o suéltala aquí
            </p>
            <button
              type="button"
              disabled={busy || preparing}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-11 w-full max-w-xs items-center justify-center rounded-full border border-border bg-surface px-3 text-xs font-semibold text-body hover:bg-surface-elevated disabled:opacity-50"
            >
              Seleccionar archivo
            </button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          disabled={busy || preparing}
          className="sr-only"
          onChange={(event) => {
            applyFile(firstImageFile(event.target.files));
            event.target.value = "";
          }}
        />
      </div>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 500))}
        placeholder="Nota opcional"
        disabled={busy || preparing}
        size={10}
        className="w-full min-w-0 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
      />
      <button
        type="button"
        disabled={busy || preparing || !file}
        onClick={() => {
          if (file) void onPublish(file, note);
        }}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-fg disabled:opacity-50 sm:w-auto"
      >
        {busy || preparing ? "…" : submitLabel}
      </button>
    </div>
  );
}

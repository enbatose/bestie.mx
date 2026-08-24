import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Check, ImagePlus, Trash2, Wand2, Link2 } from "lucide-react";
import {
  adminExtractAssistedDraft,
  adminCreateAssistedDraft,
  type AssistedDraftExtraction,
} from "@/lib/assistedDraftApi";
import { ListingPhoneCaptureFields } from "@/components/publish/ListingPhoneCaptureFields";
import { formatMxPhoneDisplay, normalizeMxNationalDigits, phoneDigitsForStorage } from "@/lib/mxPhone";

const CITIES = ["Guadalajara", "Mérida", "Puerto Vallarta", "Sayulita", "Bucerías"] as const;

type ImageItem = { mimeType: string; data: string; preview: string };

async function fileToBase64(file: File): Promise<ImageItem> {
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

function confColor(c: number | undefined): string {
  if (!c || c < 60) return "text-muted";
  if (c >= 80) return "text-secondary";
  return "text-warning-fg";
}

function confBadge(c: number | undefined): string {
  if (!c || c < 60) return "bg-bg-light text-muted";
  if (c >= 80) return "bg-secondary/10 text-secondary border border-secondary/30";
  return "bg-warning/10 text-warning-fg border border-warning/40";
}

function ConfidenceBadge({ c, label }: { c: number | undefined; label: string }) {
  const pct = c ?? 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${confBadge(c)}`}>
      <span className={confColor(c)}>{label}</span>
      <span className="opacity-60">{pct}%</span>
    </span>
  );
}


function ImageDropZone({
  images,
  onImages,
  label,
  hint,
}: {
  images: ImageItem[];
  onImages: (imgs: ImageItem[]) => void;
  label: string;
  hint: string;
}) {
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (!arr.length) return;
      const converted = await Promise.all(arr.map(fileToBase64));
      onImages([...images, ...converted]);
    },
    [images, onImages],
  );

  return (
    <div
      className={`relative rounded-xl border-2 border-dashed transition ${dragging ? "border-secondary bg-secondary/5" : "border-border bg-bg-light"} p-4`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setDragging(false);
        await addFiles(e.dataTransfer.files);
      }}
      onPaste={async (e) => {
        const items = Array.from(e.clipboardData?.items ?? []).filter((i) =>
          i.type.startsWith("image/"),
        );
        if (!items.length) return;
        const files = items.map((i) => i.getAsFile()).filter((f): f is File => f != null);
        await addFiles(files);
      }}
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      <p className="mb-1 text-sm font-semibold text-body">{label}</p>
      <p className="mb-3 text-xs text-muted">{hint}</p>

      {images.length === 0 ? (
        <button
          type="button"
          className="flex w-full flex-col items-center gap-2 rounded-lg border border-border bg-surface py-6 text-muted hover:bg-surface-elevated"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus size={24} className="opacity-50" />
          <span className="text-xs">Pegar (Ctrl+V) · Soltar aquí · Seleccionar archivo</span>
        </button>
      ) : (
        <div className="flex flex-wrap gap-2">
          {images.map((img, i) => (
            <div key={i} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border">
              <img src={img.preview} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="Eliminar imagen"
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100"
                onClick={() => onImages(images.filter((_, j) => j !== i))}
              >
                <Trash2 size={16} className="text-white" />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="flex h-20 w-20 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-muted hover:bg-surface-elevated"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Agregar más imágenes"
          >
            <ImagePlus size={20} />
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="sr-only"
        onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }}
      />
    </div>
  );
}

const PROP_KIND_LABELS: Record<string, string> = {
  house: "Casa", apartment: "Departamento", loft: "Loft",
};
const LODGING_LABELS: Record<string, string> = {
  private_room: "Recámara privada", shared_room: "Recámara compartida",
};
const GENDER_LABELS: Record<string, string> = {
  any: "Sin preferencia", female: "Solo mujeres", male: "Solo hombres",
};
const DIM_LABELS: Record<string, string> = {
  small: "Pequeña", medium: "Mediana", large: "Grande",
};

function ExtractionPreview({
  ext,
}: { ext: AssistedDraftExtraction }) {
  const conf = ext.confidence ?? {};
  type Row = { label: string; value: string; key: string };
  const rows: Row[] = [];

  if (ext.propertyTitle) rows.push({ label: "Título", value: ext.propertyTitle, key: "propertyTitle" });
  if (ext.neighborhood) rows.push({ label: "Colonia / barrio", value: ext.neighborhood, key: "neighborhood" });
  if (ext.contactPhone) {
    rows.push({
      label: "Teléfono / móvil",
      value: formatMxPhoneDisplay(ext.contactPhone),
      key: "contactPhone",
    });
  }
  if (ext.propertyKind) rows.push({ label: "Tipo de propiedad", value: PROP_KIND_LABELS[ext.propertyKind] ?? ext.propertyKind, key: "propertyKind" });
  if (ext.lodgingType) rows.push({ label: "Tipo de espacio", value: LODGING_LABELS[ext.lodgingType] ?? ext.lodgingType, key: "lodgingType" });
  if (ext.rentMxn) rows.push({ label: "Renta mensual", value: `$${ext.rentMxn.toLocaleString("es-MX")} MXN`, key: "rentMxn" });
  if (ext.depositMxn) rows.push({ label: "Depósito", value: `$${ext.depositMxn.toLocaleString("es-MX")} MXN`, key: "depositMxn" });
  if (ext.roommateGenderPref) rows.push({ label: "Preferencia de roomie", value: GENDER_LABELS[ext.roommateGenderPref] ?? ext.roommateGenderPref, key: "roommateGenderPref" });
  if (ext.ageMin || ext.ageMax) rows.push({ label: "Rango de edad", value: `${ext.ageMin ?? 22}–${ext.ageMax ?? 45} años`, key: "ageMin" });
  if (ext.availableFrom) rows.push({ label: "Disponible desde", value: ext.availableFrom, key: "availableFrom" });
  if (ext.minimalStayMonths) rows.push({ label: "Estancia mínima", value: `${ext.minimalStayMonths} mes(es)`, key: "minimalStayMonths" });
  if (ext.roomDimension) rows.push({ label: "Dimensión del cuarto", value: DIM_LABELS[ext.roomDimension] ?? ext.roomDimension, key: "roomDimension" });
  if (ext.tags?.length) rows.push({ label: "Características", value: ext.tags.join(", "), key: "tags" });

  const loc = ext.location;
  if (loc) {
    const locLabel =
      loc.type === "precise"
        ? `Precisa: ${loc.address ?? ""} (lat ${loc.lat?.toFixed(4)}, lng ${loc.lng?.toFixed(4)})`
        : loc.type === "approximate"
          ? `Aprox. (radio ${loc.radiusMeters}m): ${loc.address ?? ""}`
          : "No disponible — campo obligatorio";
    rows.push({ label: "Ubicación", value: locLabel, key: "location" });
  }

  if (!rows.length && !ext.roomSummary) {
    return <p className="text-sm text-muted">Sin datos extraídos.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-border last:border-0">
                <td className="w-36 px-3 py-2 text-xs font-medium text-muted">{r.label}</td>
                <td className="px-3 py-2 text-body">{r.value}</td>
                <td className="px-3 py-2">
                  <ConfidenceBadge c={conf[r.key]} label="" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ext.roomSummary && (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted uppercase tracking-wide">Descripción generada por IA</p>
          <div className="rounded-xl border border-border bg-bg-light px-3 py-2">
            <p className="text-sm leading-relaxed text-body">{ext.roomSummary}</p>
          </div>
          <div className="mt-1 flex justify-end">
            <ConfidenceBadge c={conf.roomSummary} label="Descripción" />
          </div>
        </div>
      )}

      {loc?.type === "none" && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2">
          <span className="mt-0.5 text-warning-fg text-sm font-medium">⚠</span>
          <p className="text-xs text-warning-fg">
            No se encontró información de ubicación. El usuario deberá agregarla antes de publicar.
          </p>
        </div>
      )}
      {!ext.rentMxn && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2">
          <span className="mt-0.5 text-warning-fg text-sm font-medium">⚠</span>
          <p className="text-xs text-warning-fg">
            No se encontró el precio de renta. El usuario deberá ingresarlo antes de publicar.
          </p>
        </div>
      )}
      {!ext.contactPhone && (
        <div className="flex items-start gap-2 rounded-xl border border-border bg-bg-light px-3 py-2">
          <p className="text-xs text-muted">
            No se detectó teléfono en el texto/infográfico. Puedes agregarlo abajo antes de generar el
            enlace (opcional; el dueño también puede editarlo en la vista previa).
          </p>
        </div>
      )}
    </div>
  );
}

export function AdminAssistedDraftPanel() {
  const [city, setCity] = useState<string>("Guadalajara");
  const [text, setText] = useState("");
  const [infographicImages, setInfographicImages] = useState<ImageItem[]>([]);
  const [photoImages, setPhotoImages] = useState<ImageItem[]>([]);

  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<AssistedDraftExtraction | null>(null);
  const [extractErr, setExtractErr] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [claimUrl, setClaimUrl] = useState<string | null>(null);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [outreachPhone, setOutreachPhone] = useState("");
  const [outreachShowPhone, setOutreachShowPhone] = useState(true);

  useEffect(() => {
    if (!extraction) {
      setOutreachPhone("");
      setOutreachShowPhone(true);
      return;
    }
    const national = normalizeMxNationalDigits(extraction.contactPhone ?? "") ?? "";
    setOutreachPhone(national);
    setOutreachShowPhone(Boolean(national));
  }, [extraction]);

  const hasInput = text.trim() || infographicImages.length > 0;

  const handleExtract = async () => {
    if (!hasInput) return;
    setExtracting(true);
    setExtractErr(null);
    setExtraction(null);
    setClaimUrl(null);
    try {
      const result = await adminExtractAssistedDraft({
        text: text.trim() || undefined,
        images: infographicImages.length > 0 ? infographicImages.map(({ mimeType, data }) => ({ mimeType, data })) : undefined,
        city,
      });
      setExtraction(result);
    } catch (e) {
      setExtractErr(e instanceof Error ? e.message : "Error al analizar.");
    } finally {
      setExtracting(false);
    }
  };

  const handleCreate = async () => {
    if (!extraction) return;
    setCreating(true);
    setCreateErr(null);
    try {
      const digits = outreachPhone.trim() ? phoneDigitsForStorage(outreachPhone) : null;
      const result = await adminCreateAssistedDraft({
        city,
        extraction: {
          ...extraction,
          contactPhone: digits ?? undefined,
        },
        showWhatsApp: outreachShowPhone && Boolean(digits),
        photos: photoImages.map(({ mimeType, data }) => ({ mimeType, data })),
        infographicPhotos: infographicImages.map(({ mimeType, data }) => ({ mimeType, data })),
      });
      setClaimUrl(result.claimUrl);
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : "Error al crear el borrador.");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!claimUrl) return;
    try {
      await navigator.clipboard.writeText(claimUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback: select text
    }
  };

  const handleReset = () => {
    setText("");
    setInfographicImages([]);
    setPhotoImages([]);
    setExtraction(null);
    setClaimUrl(null);
    setExtractErr(null);
    setCreateErr(null);
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-lg font-bold text-body">Crear borrador asistido</h2>
        <p className="mt-1 text-sm text-muted">
          Analiza texto o imágenes de Facebook con IA y genera un enlace de reclamación que el propietario puede usar para publicar su anuncio.
        </p>
      </div>

      {/* City selector */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
          Ciudad del anuncio
        </label>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-full max-w-xs rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body focus:border-accent focus:outline-none"
        >
          {CITIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Zone 1: Text */}
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-body">
          1. Texto de la publicación
        </label>
        <p className="mb-2 text-xs text-muted">Pega aquí el texto de la publicación de Facebook o cualquier descripción del espacio.</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Pega aquí el texto de la publicación de Facebook..."
          rows={6}
          className="w-full rounded-xl border border-border bg-bg-light px-3 py-2.5 text-sm text-body placeholder:text-muted focus:border-accent focus:outline-none resize-y"
        />
      </div>

      {/* Zone 2: Infographic images */}
      <div>
        <p className="mb-2 text-sm font-semibold text-body">2. Infográficos del anuncio</p>
        <ImageDropZone
          images={infographicImages}
          onImages={setInfographicImages}
          label="Imágenes con información (infográficos, capturas con datos)"
          hint="La IA analizará estas imágenes para extraer información. Pega con Ctrl+V, arrastra o selecciona. Se usarán también como fotos del anuncio si no hay fotos adicionales."
        />
      </div>

      {/* Zone 3: Photos */}
      <div>
        <p className="mb-2 text-sm font-semibold text-body">3. Fotos del espacio</p>
        <ImageDropZone
          images={photoImages}
          onImages={setPhotoImages}
          label="Fotos del cuarto y propiedad"
          hint="Copia de Facebook y pega con Ctrl+V, o arrastra. Estas serán las fotos del anuncio (no se analizan con IA)."
        />
      </div>

      {/* Analyze button */}
      {!claimUrl && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!hasInput || extracting}
            onClick={() => void handleExtract()}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg hover:brightness-110 disabled:opacity-40"
          >
            <Wand2 size={16} />
            {extracting ? "Analizando…" : "Analizar con IA"}
          </button>
          {(extraction || text || infographicImages.length > 0 || photoImages.length > 0) && (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full border border-border bg-surface px-4 py-2.5 text-sm text-muted hover:bg-surface-elevated"
            >
              Limpiar
            </button>
          )}
        </div>
      )}

      {extractErr && (
        <div className="rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
          {extractErr}
        </div>
      )}

      {/* Extraction results */}
      {extraction && !claimUrl && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-body">Resultados de la extracción</h3>
            <button
              type="button"
              onClick={() => void handleExtract()}
              className="text-xs text-muted underline hover:text-body"
            >
              Re-analizar
            </button>
          </div>

          <ExtractionPreview ext={extraction} />

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Teléfono del anuncio (opcional)
            </h4>
            <p className="text-xs text-muted">
              Extraído del texto o infográfico cuando es posible. Misma edición que en la vista previa
              pública: número, mostrar/ocultar, y el dueño podrá ajustarlo al reclamar el borrador.
            </p>
            <ListingPhoneCaptureFields
              contactWhatsApp={outreachPhone}
              showWhatsApp={outreachShowPhone}
              onContactChange={setOutreachPhone}
              onShowChange={setOutreachShowPhone}
              saveToProfile={false}
              onSaveToProfileChange={() => {}}
              allowSaveToProfile={false}
              showPublisherSafety={false}
              compact
              audienceNote="publisher"
            />
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              disabled={creating}
              onClick={() => void handleCreate()}
              className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg hover:brightness-110 disabled:opacity-40"
            >
              <Link2 size={16} />
              {creating ? "Generando…" : "Generar enlace"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full border border-border bg-surface px-4 py-2.5 text-sm text-muted hover:bg-surface-elevated"
            >
              Limpiar
            </button>
          </div>

          {createErr && (
            <div className="rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
              {createErr}
            </div>
          )}
        </div>
      )}

      {/* Claim URL result */}
      {claimUrl && (
        <div className="rounded-2xl border border-secondary/40 bg-secondary/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Check size={18} className="text-secondary" />
            <p className="text-sm font-semibold text-body">Borrador creado — enlace listo para compartir</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-3">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-body">{claimUrl}</span>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-body hover:bg-surface-elevated"
              aria-label="Copiar enlace"
            >
              {copied ? <Check size={14} className="text-secondary" /> : <Copy size={14} />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Envía este enlace al propietario por WhatsApp o mensaje directo. Si no se reclama, el borrador se elimina automáticamente a los 7 días.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={claimUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-border bg-surface px-4 py-2 text-xs font-medium text-body hover:bg-surface-elevated"
            >
              Ver borrador
            </a>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full border border-border bg-surface px-4 py-2 text-xs font-medium text-muted hover:bg-surface-elevated"
            >
              Crear otro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

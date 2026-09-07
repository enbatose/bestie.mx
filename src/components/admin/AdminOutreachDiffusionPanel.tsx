import { useEffect, useMemo, useState } from "react";
import { Check, Copy, RefreshCw, RotateCcw, Wand2 } from "lucide-react";
import {
  ImageDropZone,
  type ImageItem,
} from "@/components/admin/AdminAssistedDraftPanel";
import { buildDiffusionFacebookComment } from "@/lib/outreachDiffusionComment";
import {
  absoluteShareUrl,
  adminCreateSharedSearch,
  adminExtractSharedSearch,
  adminSharedSearchDuplicateCheck,
  fetchSharedSearchMeta,
  type SharedSearchExtractResult,
} from "@/lib/sharedSearchesApi";

const CITIES = ["Guadalajara", "Mérida", "Puerto Vallarta", "Sayulita", "Bucerías"] as const;

function looksLikeSourceUrl(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 8) return false;
  return /^https?:\/\//i.test(t) || /facebook\.com|fb\.com|fb\.watch/i.test(t);
}

function qualityLabel(q: string): string {
  if (q === "alta") return "Alta";
  if (q === "media") return "Media";
  return "Baja";
}

export function AdminOutreachDiffusionPanel() {
  const [city, setCity] = useState<string>("Guadalajara");
  const [seekerName, setSeekerName] = useState("");
  const [seekerGender, setSeekerGender] = useState<"" | "female" | "male">("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [text, setText] = useState("");
  const [infographics, setInfographics] = useState<ImageItem[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<SharedSearchExtractResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sharePath, setSharePath] = useState<string | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const [zoneRule, setZoneRule] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedComment, setCopiedComment] = useState(false);
  const [commentVariantOffset, setCommentVariantOffset] = useState(0);
  const [exactCount, setExactCount] = useState<number | null>(null);
  const [similarCount, setSimilarCount] = useState<number | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [dupMatches, setDupMatches] = useState<
    Array<{ id: string; label: string; sharePath: string; createdAt: string; seekerName: string | null }>
  >([]);

  useEffect(() => {
    const url = facebookUrl.trim();
    if (!looksLikeSourceUrl(url) || sharePath) {
      setDupMatches([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void adminSharedSearchDuplicateCheck(url)
        .then((r) => {
          if (!cancelled) setDupMatches(r.facebookMatches);
        })
        .catch(() => {
          /* keep last */
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [facebookUrl, sharePath]);

  const hasInput = text.trim() || infographics.length > 0;
  const shareUrl = sharePath ? absoluteShareUrl(sharePath) : null;

  const facebookComment = useMemo(() => {
    if (!sharePath) return "";
    const extras =
      preview?.insights.filter((i) => !i.mapped).map((i) => i.text) ?? [];
    return buildDiffusionFacebookComment({
      sharePath,
      seekerName: seekerName.trim() || null,
      zoneRule,
      placeHint: caption,
      exactCount: exactCount ?? preview?.exactCount ?? null,
      similarCount: similarCount ?? preview?.similarCount ?? null,
      extraCriteria: extras,
      variantSeed: shareId ?? sharePath,
      variantOffset: commentVariantOffset,
    });
  }, [
    sharePath,
    shareId,
    seekerName,
    zoneRule,
    caption,
    exactCount,
    similarCount,
    preview,
    commentVariantOffset,
  ]);

  const handleExtract = async () => {
    if (!hasInput) return;
    setExtracting(true);
    setErr(null);
    setPreview(null);
    setSharePath(null);
    setCaption(null);
    setZoneRule(null);
    setExactCount(null);
    setSimilarCount(null);
    setShareId(null);
    setCommentVariantOffset(0);
    setCopiedComment(false);
    try {
      const result = await adminExtractSharedSearch({
        text: text.trim() || undefined,
        images: infographics.length
          ? infographics.map(({ mimeType, data }) => ({ mimeType, data }))
          : undefined,
        city,
        seekerName: seekerName.trim() || undefined,
        seekerGender: seekerGender || null,
      });
      setPreview(result);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al analizar.");
    } finally {
      setExtracting(false);
    }
  };

  const handleCreate = async () => {
    if (!preview) return;
    setCreating(true);
    setErr(null);
    try {
      const result = await adminCreateSharedSearch({
        city,
        seekerName: seekerName.trim(),
        seekerGender: seekerGender || null,
        sourceFacebookUrl: facebookUrl.trim(),
        extraction: preview.extraction,
      });
      setSharePath(result.sharePath);
      setShareId(result.id);
      setCaption(result.caption);
      setZoneRule(result.zoneRule ?? preview.zoneRule ?? null);
      setExactCount(result.exactCount);
      setSimilarCount(result.similarCount);
      setCommentVariantOffset(0);
      setCopiedComment(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al crear la búsqueda.");
    } finally {
      setCreating(false);
    }
  };

  const handleReuseExisting = async (sharePathToUse: string, id: string) => {
    setErr(null);
    setSharePath(sharePathToUse);
    setShareId(id);
    setCommentVariantOffset(0);
    setCopiedComment(false);
    try {
      const meta = await fetchSharedSearchMeta(id);
      setCaption(meta.caption);
      setZoneRule(meta.zoneRule ?? null);
      setExactCount(meta.exactCount);
      setSimilarCount(meta.similarCount);
    } catch {
      setCaption(null);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      /* ignore */
    }
  };

  const handleCopyComment = async () => {
    if (!facebookComment.trim()) return;
    try {
      await navigator.clipboard.writeText(facebookComment);
      setCopiedComment(true);
      window.setTimeout(() => setCopiedComment(false), 2500);
    } catch {
      /* ignore */
    }
  };

  const handleReset = () => {
    setText("");
    setInfographics([]);
    setSeekerName("");
    setSeekerGender("");
    setFacebookUrl("");
    setPreview(null);
    setSharePath(null);
    setShareId(null);
    setCaption(null);
    setZoneRule(null);
    setExactCount(null);
    setSimilarCount(null);
    setCommentVariantOffset(0);
    setErr(null);
    setDupMatches([]);
    setCopied(false);
    setCopiedComment(false);
    setExtracting(false);
    setCreating(false);
  };

  const formDirty =
    Boolean(text.trim()) ||
    infographics.length > 0 ||
    Boolean(seekerName.trim()) ||
    Boolean(facebookUrl.trim()) ||
    Boolean(preview) ||
    Boolean(sharePath) ||
    Boolean(err);

  const analysisLines = useMemo(() => {
    if (!preview) return [];
    return [
      `Calidad de la búsqueda: ${qualityLabel(preview.quality)}`,
      `${preview.exactCount} en zona`,
      `${preview.similarCount} cerca`,
      preview.zoneRule ? `Zona: ${preview.zoneRule}` : preview.composed.mainArea ? `Zona: ${preview.composed.mainArea}` : "",
      preview.composed.label,
    ].filter(Boolean);
  }, [preview]);

  return (
    <div className="min-w-0 space-y-6 pb-12">
      <div>
        <h2 className="text-lg font-bold text-body">Difusión de búsquedas</h2>
        <p className="mt-1 text-sm text-muted">
          Pega el post de alguien que busca cuarto. La IA arma una búsqueda con cuartos en zona y cerca
          para compartir en Facebook o WhatsApp.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
          Ciudad
        </label>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-full max-w-xs rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body focus:border-accent focus:outline-none"
        >
          {CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="admin-diffusion-facebook-url"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted"
        >
          Enlace del post de Facebook
        </label>
        <p className="mb-2 text-xs text-muted">
          Pega el enlace para evitar duplicar la misma búsqueda.
        </p>
        <input
          id="admin-diffusion-facebook-url"
          type="text"
          inputMode="url"
          value={facebookUrl}
          onChange={(e) => setFacebookUrl(e.target.value)}
          placeholder="https://www.facebook.com/groups/…/posts/…"
          maxLength={2048}
          className="w-full min-w-0 rounded-xl border border-border bg-bg-light px-3 py-2 text-sm text-body placeholder:text-muted focus:border-accent focus:outline-none"
        />
        {sharePath || dupMatches.length === 0 ? null : (
          <div
            role="status"
            className="mt-2 min-w-0 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-warning-fg"
          >
            <p className="font-semibold">Ya creamos una búsqueda de este post</p>
            <ul className="mt-2 space-y-1">
              {dupMatches.map((row) => (
                <li key={row.id} className="min-w-0 break-words">
                  {row.label}
                  {" · "}
                  <a
                    href={row.sharePath}
                    className="font-semibold underline underline-offset-2"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs text-warning-fg/80">Usa el enlace existente. No generes otro salvo que sea a propósito.</p>
            <button
              type="button"
              onClick={() => void handleReuseExisting(dupMatches[0].sharePath, dupMatches[0].id)}
              className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg hover:brightness-110"
            >
              Usar enlace existente
            </button>
          </div>
        )}
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label
            htmlFor="admin-diffusion-name"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted"
          >
            Nombre
          </label>
          <input
            id="admin-diffusion-name"
            type="text"
            value={seekerName}
            onChange={(e) => setSeekerName(e.target.value)}
            placeholder="Ej. María, Carlos…"
            maxLength={80}
            className="w-full min-w-0 rounded-xl border border-border bg-bg-light px-3 py-2 text-sm text-body placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>
        <div className="min-w-0">
          <p
            id="admin-diffusion-gender-label"
            className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted"
          >
            Género
          </p>
          <div
            role="group"
            aria-labelledby="admin-diffusion-gender-label"
            className="flex min-w-0 gap-2"
          >
            <button
              type="button"
              aria-pressed={seekerGender === "female"}
              onClick={() => setSeekerGender((current) => (current === "female" ? "" : "female"))}
              className={`inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition ${
                seekerGender === "female"
                  ? "border-primary bg-primary text-primary-fg shadow-sm"
                  : "border-border bg-surface text-body hover:bg-surface-elevated"
              }`}
            >
              Mujer
            </button>
            <button
              type="button"
              aria-pressed={seekerGender === "male"}
              onClick={() => setSeekerGender((current) => (current === "male" ? "" : "male"))}
              className={`inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition ${
                seekerGender === "male"
                  ? "border-primary bg-primary text-primary-fg shadow-sm"
                  : "border-border bg-surface text-body hover:bg-surface-elevated"
              }`}
            >
              Hombre
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-body">Texto de la publicación</label>
        <p className="mb-2 text-xs text-muted">Copia lo que la persona escribió buscando cuarto o roomie.</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Pega aquí el texto del post…"
          rows={6}
          className="w-full resize-y rounded-xl border border-border bg-bg-light px-3 py-2.5 text-sm text-body placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-body">Infográficos o mapa (hasta 2)</p>
        <ImageDropZone
          images={infographics}
          onImages={setInfographics}
          maxImages={2}
          label="Infográficos o mapa de zona"
          hint="Pega con Ctrl+V, arrastra o selecciona. Hasta dos imágenes: infográfico y/o mapa con perímetro."
        />
      </div>

      {!sharePath ? (
        <div className="flex min-w-0 flex-wrap gap-2">
          <button
            type="button"
            disabled={!hasInput || extracting}
            onClick={() => void handleExtract()}
            className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg hover:brightness-110 disabled:opacity-40"
          >
            <Wand2 size={16} />
            {extracting ? "Analizando…" : "Analizar con IA"}
          </button>
        </div>
      ) : null}

      {err ? (
        <div className="rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-sm text-error" role="alert">
          {err}
        </div>
      ) : null}

      {preview && !sharePath ? (
        <div className="min-w-0 space-y-4 rounded-2xl border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold text-body">Análisis</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-body">
            {analysisLines.map((line) => (
              <li key={line} className="break-words">
                {line}
              </li>
            ))}
          </ul>
          {preview.nonNegotiables.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">No negociables</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-body">
                {preview.nonNegotiables.map((n) => (
                  <li key={`${n.kind}-${n.value}`} className="break-words">
                    {n.reason || n.value}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {preview.insights.filter((i) => !i.mapped).length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Criterios fuera de filtros</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-muted">
                {preview.insights
                  .filter((i) => !i.mapped)
                  .map((i) => (
                    <li key={i.text} className="break-words">
                      {i.text}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">En zona</p>
              <ul className="mt-1 space-y-1 text-sm text-body">
                {preview.exact.length ? (
                  preview.exact.slice(0, 6).map((l) => (
                    <li key={l.id} className="min-w-0 break-words">
                      {l.title || "Anuncio"} · {l.neighborhood}
                    </li>
                  ))
                ) : (
                  <li className="text-muted">Ninguno en zona aún</li>
                )}
              </ul>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Cerca</p>
              <ul className="mt-1 space-y-1 text-sm text-body">
                {preview.similar.length ? (
                  preview.similar.slice(0, 6).map((l) => (
                    <li key={l.id} className="min-w-0 break-words">
                      {l.title || "Anuncio"} · {l.neighborhood}
                    </li>
                  ))
                ) : (
                  <li className="text-muted">Ninguno cerca</li>
                )}
              </ul>
            </div>
          </div>
          <p className="text-xs text-muted">Vista previa del recuadro al compartir: {preview.caption}</p>
          {preview.insights.filter((i) => !i.mapped).length ? (
            <p className="break-words text-xs text-muted">
              Incluye en el comentario:{" "}
              {preview.insights
                .filter((i) => !i.mapped)
                .map((i) => i.text)
                .join(" · ")}
            </p>
          ) : null}
          {dupMatches.length ? (
            <button
              type="button"
              onClick={() => void handleReuseExisting(dupMatches[0].sharePath, dupMatches[0].id)}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg hover:brightness-110"
            >
              Usar enlace existente
            </button>
          ) : (
            <button
              type="button"
              disabled={creating}
              onClick={() => void handleCreate()}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg hover:brightness-110 disabled:opacity-40"
            >
              {creating ? "Generando enlace…" : "Generar enlace para compartir"}
            </button>
          )}
        </div>
      ) : null}

      {shareUrl ? (
        <div className="min-w-0 space-y-4 rounded-2xl border border-secondary/40 bg-secondary/10 p-4">
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-semibold text-body">Comentario para Facebook</p>
            <p className="text-xs text-muted">
              Listo para pegar bajo el post del seeker. Incluye el enlace de la búsqueda y cierra con{" "}
              <span className="font-medium text-body">Atte. Equipo Bestie MX.</span> para vincularlo a
              Bestie en el grupo.
            </p>
            <textarea
              id="admin-diffusion-fb-comment"
              readOnly
              value={facebookComment}
              rows={10}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full min-w-0 resize-y rounded-xl border border-border bg-surface px-3 py-3 text-sm leading-relaxed text-body focus:border-accent focus:outline-none"
            />
            <div className="flex min-w-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleCopyComment()}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg hover:brightness-110"
              >
                {copiedComment ? <Check size={16} /> : <Copy size={16} />}
                {copiedComment ? "Comentario copiado" : "Copiar comentario"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCommentVariantOffset((n) => n + 1);
                  setCopiedComment(false);
                }}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-semibold text-body hover:bg-surface-elevated"
              >
                <RefreshCw size={16} />
                Otra redacción
              </button>
            </div>
            <p className="text-xs text-muted">{facebookComment.length} caracteres</p>
          </div>

          <div className="min-w-0 space-y-2 border-t border-border/60 pt-3">
            <p className="text-sm font-semibold text-body">Solo el enlace</p>
            {zoneRule ? <p className="break-words text-sm text-body">{zoneRule}</p> : null}
            {caption ? <p className="break-words text-sm text-muted">{caption}</p> : null}
            {preview?.insights.filter((i) => !i.mapped).length ? (
              <p className="break-words text-sm text-muted">
                Criterios en el comentario:{" "}
                {preview.insights
                  .filter((i) => !i.mapped)
                  .map((i) => i.text)
                  .join(" · ")}
              </p>
            ) : null}
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body sm:w-0 sm:flex-1"
              />
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-semibold text-body hover:bg-surface-elevated"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Copiado" : "Copiar enlace"}
              </button>
            </div>
            <p className="text-xs text-muted">
              El comentario ya usa la URL de producción (<span className="font-mono">www.bestie.mx</span>
              ), aunque estés en Dev.
            </p>
          </div>
        </div>
      ) : null}

      {formDirty ? (
        <div className="min-w-0 border-t border-border pt-4">
          <button
            type="button"
            onClick={handleReset}
            disabled={extracting || creating}
            className="inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-body hover:bg-surface-elevated disabled:opacity-40 sm:w-auto"
          >
            <RotateCcw size={16} />
            Limpiar y nueva difusión
          </button>
          <p className="mt-2 text-xs text-muted">Borra el formulario para pegar otro post y generar un enlace nuevo.</p>
        </div>
      ) : null}
    </div>
  );
}

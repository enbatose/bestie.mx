import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, ExternalLink, Plus, RefreshCw, Save, Sparkles, Trash2 } from "lucide-react";
import { BlogArticlePreviewModal } from "@/components/blog/BlogArticlePreviewModal";
import {
  adminChatBlogArticle,
  adminCreateBlogArticle,
  adminDeleteBlogArticle,
  adminEnhanceBlogArticle,
  adminGenerateBlogArticle,
  adminGetBlogArticle,
  adminListBlogArticles,
  adminMetaPublishBlog,
  adminProposeBlogTopics,
  adminRescoreBlogArticle,
  adminSaveBlogArticle,
  type BlogArticle,
  type BlogBlock,
  type BlogCosts,
  type BlogSource,
} from "@/lib/blogApi";

const fieldClass = "mt-1 min-h-11 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2";
const primaryClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:brightness-110 disabled:opacity-40";
const secondaryClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-body hover:bg-surface-elevated disabled:opacity-40";
type Topic = Awaited<ReturnType<typeof adminProposeBlogTopics>>["topics"][number];

const ACTIVITY_LABELS: Record<string, string> = {
  research: "Investigación",
  draft: "Generación / regeneración",
  rescore: "Rescore",
  enhance: "Mejoras (regeneración)",
  chat: "Chat IA",
  images: "Imágenes",
  topics: "Temas",
  similarity: "Similitud",
  social: "Social",
  other: "Otro",
};

const AI_PROGRESS_BY_KIND: Record<string, string[]> = {
  generate: [
    "Investigando fuentes en la web…",
    "Redactando el artículo…",
    "Buscando imágenes del tema…",
    "Evaluando calidad y similitud…",
    "Casi listo, armando el borrador…",
  ],
  enhance: [
    "Aplicando mejoras al artículo…",
    "Actualizando contenido e imágenes…",
    "Recalculando calidad…",
    "Casi listo…",
  ],
  rescore: ["Evaluando calidad del artículo…", "Preparando sugerencias…"],
  chat: ["El asistente está editando el artículo…", "Aplicando tus instrucciones…", "Casi listo…"],
  topics: ["Escaneando noticias y temas…", "Comparando con artículos existentes…", "Preparando propuestas…"],
  default: ["Trabajando…", "Sigue en proceso, no cierres esta pestaña…"],
};

function formatMxn(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return `${n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })} MXN`;
}

function topicIdeaText(topic: Topic): string {
  return [topic.title, topic.angle, topic.whyNow ? `Por qué ahora: ${topic.whyNow}` : ""]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n\n");
}

function AiProgressBanner({
  title,
  stepLabel,
  percent,
}: {
  title: string;
  stepLabel: string;
  percent: number;
}) {
  return (
    <div
      className="sticky top-2 z-[30] mb-4 rounded-2xl border border-secondary/40 bg-surface p-4 shadow-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-primary">
          <Sparkles className="size-4 animate-pulse" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-body">{title}</p>
          <p className="mt-1 text-xs text-muted">{stepLabel}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${Math.min(96, Math.max(6, percent))}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Puede tardar 1–2 minutos. La barra avanza mientras la IA trabaja; no está trabada.
          </p>
        </div>
      </div>
    </div>
  );
}

export function AdminBlogPanel() {
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [article, setArticle] = useState<BlogArticle | null>(null);
  const [costs, setCosts] = useState<BlogCosts | null>(null);
  const [search, setSearch] = useState("");
  const [idea, setIdea] = useState("");
  const [chat, setChat] = useState("");
  const [chatReply, setChatReply] = useState("");
  const [blocksText, setBlocksText] = useState("[]");
  const [sourcesText, setSourcesText] = useState("[]");
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [aiJob, setAiJob] = useState<{
    kind: string;
    title: string;
    stepLabel: string;
    percent: number;
  } | null>(null);
  const ideaSectionRef = useRef<HTMLDivElement>(null);
  const ideaInputRef = useRef<HTMLTextAreaElement>(null);
  const progressTimerRef = useRef<number | null>(null);

  const clearProgressTimer = () => {
    if (progressTimerRef.current != null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  const startAiProgress = (kind: string, title: string) => {
    clearProgressTimer();
    const steps = AI_PROGRESS_BY_KIND[kind] ?? AI_PROGRESS_BY_KIND.default;
    const started = Date.now();
    setAiJob({ kind, title, stepLabel: steps[0]!, percent: 8 });
    progressTimerRef.current = window.setInterval(() => {
      const elapsedSec = (Date.now() - started) / 1000;
      const stepIndex = Math.min(steps.length - 1, Math.floor(elapsedSec / 12));
      // Asymptotic progress toward ~92% so it never looks finished early.
      const percent = Math.min(92, 8 + (1 - Math.exp(-elapsedSec / 35)) * 84);
      setAiJob({
        kind,
        title,
        stepLabel: steps[stepIndex]!,
        percent,
      });
    }, 900);
  };

  const stopAiProgress = () => {
    clearProgressTimer();
    setAiJob((current) =>
      current ? { ...current, stepLabel: "Listo.", percent: 100 } : null,
    );
    window.setTimeout(() => setAiJob(null), 450);
  };

  useEffect(() => () => clearProgressTimer(), []);

  const loadList = useCallback(async (q?: string) => {
    setArticles(await adminListBlogArticles(q));
  }, []);

  const selectArticle = useCallback(async (id: string) => {
    setSelectedId(id);
    const data = await adminGetBlogArticle(id);
    setArticle(data.article);
    setCosts(data.costs);
    setBlocksText(JSON.stringify(data.article.blocks, null, 2));
    setSourcesText(JSON.stringify(data.article.sources, null, 2));
    setSelectedSuggestions([]);
    return data.article;
  }, []);

  const focusIdeaSection = useCallback(() => {
    window.setTimeout(() => {
      ideaSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      ideaInputRef.current?.focus();
    }, 80);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void adminListBlogArticles(search, controller.signal).then(setArticles).catch(() => {
        if (!controller.signal.aborted) setError("No se pudo cargar la lista de artículos.");
      });
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [search]);

  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await operation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la acción.");
    } finally {
      setBusy(false);
      stopAiProgress();
    }
  };

  const runAi = async (
    kind: string,
    title: string,
    operation: () => Promise<void>,
  ) => {
    startAiProgress(kind, title);
    await run(operation);
  };

  const applyResult = (result: { article: BlogArticle; costs: BlogCosts }) => {
    setArticle(result.article);
    setCosts(result.costs);
    setBlocksText(JSON.stringify(result.article.blocks, null, 2));
    setSourcesText(JSON.stringify(result.article.sources, null, 2));
    void loadList(search);
  };

  /** Apply AI result and surface how much MXN this run added to the article total. */
  const applyAiResult = (
    result: { article: BlogArticle; costs: BlogCosts },
    successNotice: string,
    beforeMxn: number,
  ) => {
    applyResult(result);
    const added = Math.max(0, (result.costs.totalMxn ?? 0) - beforeMxn);
    setNotice(
      added > 0
        ? `${successNotice} Costo de esta operación: ${formatMxn(added)} (acumulado ${formatMxn(result.costs.totalMxn)}).`
        : successNotice,
    );
  };

  const setField = <K extends keyof BlogArticle>(key: K, value: BlogArticle[K]) => {
    setArticle((current) => current ? { ...current, [key]: value } : current);
  };

  const save = async () => {
    if (!article) return;
    let blocks: BlogArticle["blocks"];
    let sources: BlogArticle["sources"];
    try {
      blocks = JSON.parse(blocksText) as BlogArticle["blocks"];
      sources = JSON.parse(sourcesText) as BlogArticle["sources"];
    } catch {
      throw new Error("Revisa el JSON de bloques y fuentes.");
    }
    applyResult(await adminSaveBlogArticle(article.id, { ...article, blocks, sources }));
    setNotice("Artículo guardado.");
  };

  const publishMeta = async (platform: "facebook" | "instagram") => {
    if (!article) return;
    const result = await adminMetaPublishBlog(article.id, platform);
    if (result.ok) {
      setNotice(`Publicado en ${platform === "facebook" ? "Facebook" : "Instagram"}.`);
      return;
    }
    const setup = result.setup as { hint?: string; draftCaption?: string; shareUrl?: string } | undefined;
    setNotice(
      setup?.hint
        ? `${setup.hint}${setup.shareUrl ? ` URL: ${setup.shareUrl}` : ""}`
        : String(result.error || "Meta no está configurado."),
    );
  };

  const useTopicIdea = async (topic: Topic) => {
    const text = topicIdeaText(topic);
    setIdea(text);

    if (topic.promoteArticleId) {
      const selected = await selectArticle(topic.promoteArticleId);
      if (topic.socialCaption) {
        setArticle({ ...selected, socialCaption: topic.socialCaption });
      }
      setNotice(
        topic.socialCaption
          ? "Idea de promoción cargada. Revisa el caption social y regenera creativos si hace falta."
          : "Artículo existente abierto para promover. Puedes ajustar el caption o pedir a la IA una actualización.",
      );
      focusIdeaSection();
      return;
    }

    let targetId = selectedId;
    if (!targetId) {
      const created = await adminCreateBlogArticle({
        title: topic.title.slice(0, 180) || "Nuevo artículo",
        cityCode: topic.cityCode,
      });
      await loadList(search);
      await selectArticle(created.id);
      targetId = created.id;
    } else {
      setField("title", topic.title.slice(0, 180) || article?.title || "Nuevo artículo");
      if (topic.cityCode === "gdl" || topic.cityCode == null) {
        setField("cityCode", topic.cityCode);
      }
    }

    if (topic.socialCaption && targetId) {
      setArticle((current) =>
        current ? { ...current, socialCaption: topic.socialCaption ?? current.socialCaption } : current,
      );
    }

    setNotice("Idea cargada en Generación con IA. Pulsa Generar artículo cuando quieras.");
    focusIdeaSection();
  };

  const deleteArticle = async (id: string, title: string) => {
    const ok = window.confirm(
      `¿Eliminar permanentemente “${title.trim() || "este artículo"}”? Esta acción no se puede deshacer.`,
    );
    if (!ok) return;
    await adminDeleteBlogArticle(id);
    if (selectedId === id) {
      setSelectedId(null);
      setArticle(null);
      setCosts(null);
      setBlocksText("[]");
      setSourcesText("[]");
      setIdea("");
      setPreviewOpen(false);
    }
    await loadList(search);
    setNotice("Artículo eliminado.");
  };

  const openPreview = () => {
    if (!article) return;
    try {
      JSON.parse(blocksText) as BlogBlock[];
      JSON.parse(sourcesText) as BlogSource[];
    } catch {
      setError("Revisa el JSON de bloques y fuentes antes de previsualizar.");
      return;
    }
    setError(null);
    setPreviewOpen(true);
  };

  const previewArticle = (() => {
    if (!article || !previewOpen) return null;
    try {
      const blocks = JSON.parse(blocksText) as BlogBlock[];
      const sources = JSON.parse(sourcesText) as BlogSource[];
      return { ...article, blocks, sources };
    } catch {
      return null;
    }
  })();

  return (
    <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      {previewArticle ? (
        <BlogArticlePreviewModal article={previewArticle} onClose={() => setPreviewOpen(false)} />
      ) : null}
      <aside className="h-fit rounded-2xl border border-border bg-surface p-3 lg:sticky lg:top-4">
        <div className="flex gap-2">
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar artículos…" className={`${fieldClass} mt-0`} />
          <button type="button" disabled={busy} onClick={() => void run(async () => {
            const created = await adminCreateBlogArticle({ title: "Nuevo artículo" });
            await loadList(search);
            await selectArticle(created.id);
          })} className={primaryClass} aria-label="Nuevo artículo"><Plus className="size-4" /></button>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void runAi("topics", "Escaneando temas…", async () =>
              setTopics((await adminProposeBlogTopics(article?.cityCode)).topics),
            )
          }
          className={`${secondaryClass} mt-3 w-full`}
        >
          <Sparkles className="size-4" /> Escanear temas
        </button>
        {topics.length ? (
          <div className="mt-4 border-t border-border pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Temas sugeridos</h3>
            <ul className="mt-2 space-y-2">
              {topics.map((topic, index) => (
                <li key={`${topic.title}-${index}`} className="rounded-lg bg-bg-light p-2 text-xs">
                  <p className="font-semibold text-body">{topic.title}</p>
                  <p className="mt-1 text-muted">{topic.angle}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => useTopicIdea(topic))}
                      className="font-semibold text-primary hover:underline disabled:opacity-40"
                    >
                      Usar idea
                    </button>
                    {topic.promotePath ? (
                      <a
                        href={topic.promotePath}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-muted hover:text-primary"
                      >
                        Ver público <ExternalLink className="size-3" />
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <ul className="mt-4 max-h-[60vh] space-y-1 overflow-y-auto border-t border-border pt-3">
          {articles.map((item) => (
            <li key={item.id} className="group relative">
              <button
                type="button"
                onClick={() => void run(() => selectArticle(item.id))}
                className={`w-full rounded-xl p-3 pr-10 text-left ${item.id === selectedId ? "bg-secondary/15 ring-1 ring-secondary/40" : "hover:bg-surface-elevated"}`}
              >
                <span className="line-clamp-2 text-sm font-semibold text-body">{item.title}</span>
                <span className="mt-1 flex justify-between text-xs text-muted">
                  <span>{item.status}</span>
                  <span>{item.cityLabel || "Nacional"}</span>
                </span>
              </button>
              <button
                type="button"
                disabled={busy}
                title="Eliminar"
                aria-label={`Eliminar ${item.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  void run(() => deleteArticle(item.id, item.title));
                }}
                className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full text-muted opacity-70 hover:bg-error/10 hover:text-error hover:opacity-100 disabled:opacity-40"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="min-w-0">
        {aiJob ? (
          <AiProgressBanner title={aiJob.title} stepLabel={aiJob.stepLabel} percent={aiJob.percent} />
        ) : null}
        {error ? <p className="mb-4 rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error">{error}</p> : null}
        {notice ? <p className="mb-4 rounded-xl border border-secondary/30 bg-secondary/10 p-3 text-sm text-body">{notice}</p> : null}
        {!article ? <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">Elige un artículo o crea uno nuevo.</div> : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-body">Editar artículo</h2>
                <p className="text-xs text-muted">{article.path}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={openPreview} className={secondaryClass}>
                  <Eye className="size-4" /> Vista previa
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => deleteArticle(article.id, article.title))}
                  className={`${secondaryClass} border-error/30 text-error hover:bg-error/10`}
                >
                  <Trash2 className="size-4" /> Eliminar
                </button>
                <button type="button" disabled={busy} onClick={() => void run(save)} className={primaryClass}>
                  <Save className="size-4" /> Guardar
                </button>
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2">
              <label className="sm:col-span-2 text-sm font-medium text-body">Título<input value={article.title} onChange={(e) => setField("title", e.target.value)} className={fieldClass} /></label>
              <label className="text-sm font-medium text-body">Slug<input value={article.slug} onChange={(e) => setField("slug", e.target.value)} className={fieldClass} /></label>
              <label className="text-sm font-medium text-body">Estado<select value={article.status} onChange={(e) => setField("status", e.target.value as BlogArticle["status"])} className={fieldClass}><option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option></select></label>
              <label className="text-sm font-medium text-body">Ciudad<select value={article.cityCode ?? ""} onChange={(e) => setField("cityCode", e.target.value || null)} className={fieldClass}><option value="">Nacional</option><option value="gdl">Guadalajara</option></select></label>
              <label className="text-sm font-medium text-body">Etiquetas<input value={article.labels.join(", ")} onChange={(e) => setField("labels", e.target.value.split(",").map((value) => value.trim()).filter(Boolean))} className={fieldClass} /></label>
              <label className="sm:col-span-2 text-sm font-medium text-body">Extracto<textarea value={article.excerpt} onChange={(e) => setField("excerpt", e.target.value)} rows={3} className={fieldClass} /></label>
              <label className="text-sm font-medium text-body">Meta title<input value={article.metaTitle ?? ""} onChange={(e) => setField("metaTitle", e.target.value || null)} className={fieldClass} /></label>
              <label className="text-sm font-medium text-body">Imagen de portada<input value={article.coverImageUrl ?? ""} onChange={(e) => setField("coverImageUrl", e.target.value || null)} className={fieldClass} /></label>
              <label className="sm:col-span-2 text-sm font-medium text-body">Meta description<textarea value={article.metaDescription ?? ""} onChange={(e) => setField("metaDescription", e.target.value || null)} rows={2} className={fieldClass} /></label>
              <label className="sm:col-span-2 text-sm font-medium text-body">Resumen AEO<textarea value={article.aeoSummary ?? ""} onChange={(e) => setField("aeoSummary", e.target.value || null)} rows={3} className={fieldClass} /></label>
              <label className="sm:col-span-2 text-sm font-medium text-body">Caption social<textarea value={article.socialCaption ?? ""} onChange={(e) => setField("socialCaption", e.target.value || null)} rows={3} className={fieldClass} /></label>
              <label className="sm:col-span-2 text-sm font-medium text-body">Bloques (JSON)<textarea value={blocksText} onChange={(e) => setBlocksText(e.target.value)} rows={14} className={`${fieldClass} font-mono text-xs`} /></label>
              <label className="sm:col-span-2 text-sm font-medium text-body">Fuentes (JSON)<textarea value={sourcesText} onChange={(e) => setSourcesText(e.target.value)} rows={7} className={`${fieldClass} font-mono text-xs`} /></label>
            </div>

            <div ref={ideaSectionRef} className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="font-semibold text-body">Generación con IA</h3>
              <textarea
                ref={ideaInputRef}
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                rows={4}
                placeholder="Idea, ángulo y datos que debe cubrir…"
                className={fieldClass}
              />
              <button
                type="button"
                disabled={busy || !idea.trim()}
                onClick={() =>
                  void runAi("generate", "Regenerando artículo…", async () => {
                    const beforeMxn = costs?.totalMxn ?? 0;
                    applyAiResult(
                      await adminGenerateBlogArticle(article.id, {
                        idea,
                        cityCode: article.cityCode,
                      }),
                      "Artículo regenerado.",
                      beforeMxn,
                    );
                  })
                }
                className={`${primaryClass} mt-3`}
              >
                <Sparkles className={`size-4 ${aiJob?.kind === "generate" ? "animate-spin" : ""}`} />
                {aiJob?.kind === "generate" ? "Generando…" : "Generar artículo"}
              </button>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold text-body">
                  Calidad: {article.qualityScore ?? "sin evaluar"}/100
                </h3>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runAi("rescore", "Recalculando calidad…", async () => {
                      const beforeMxn = costs?.totalMxn ?? 0;
                      applyAiResult(
                        await adminRescoreBlogArticle(article.id),
                        "Score actualizado.",
                        beforeMxn,
                      );
                    })
                  }
                  className={secondaryClass}
                >
                  <RefreshCw className={`size-4 ${aiJob?.kind === "rescore" ? "animate-spin" : ""}`} />
                  Rescore
                </button>
              </div>
              <ul className="mt-3 space-y-2">
                {article.qualitySuggestions.map((suggestion) => (
                  <li key={suggestion.id}>
                    <label className="flex gap-2 rounded-lg bg-bg-light p-3 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedSuggestions.includes(suggestion.id)}
                        onChange={(e) =>
                          setSelectedSuggestions((current) =>
                            e.target.checked
                              ? [...current, suggestion.id]
                              : current.filter((id) => id !== suggestion.id),
                          )
                        }
                      />
                      <span>
                        <strong className="text-body">{suggestion.title}</strong>
                        <span className="block text-xs text-muted">{suggestion.detail}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={busy || !selectedSuggestions.length}
                onClick={() =>
                  void runAi("enhance", "Aplicando mejoras…", async () => {
                    const beforeMxn = costs?.totalMxn ?? 0;
                    applyAiResult(
                      await adminEnhanceBlogArticle(article.id, selectedSuggestions),
                      "Mejoras aplicadas.",
                      beforeMxn,
                    );
                    setSelectedSuggestions([]);
                  })
                }
                className={`${primaryClass} mt-3`}
              >
                {aiJob?.kind === "enhance" ? "Mejorando…" : "Aplicar mejoras"}
              </button>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="font-semibold text-body">Instrucciones al asistente</h3>
              <textarea
                value={chat}
                onChange={(e) => setChat(e.target.value)}
                rows={3}
                placeholder="Ej. Haz el tono más directo y agrega una FAQ…"
                className={fieldClass}
                disabled={busy}
              />
              <button
                type="button"
                disabled={busy || !chat.trim()}
                onClick={() =>
                  void runAi("chat", "Aplicando instrucciones…", async () => {
                    const beforeMxn = costs?.totalMxn ?? 0;
                    const result = await adminChatBlogArticle(article.id, chat);
                    applyAiResult(result, "Instrucción aplicada.", beforeMxn);
                    setChatReply(result.reply);
                    setChat("");
                  })
                }
                className={`${primaryClass} mt-3`}
              >
                {aiJob?.kind === "chat" ? "Procesando…" : "Enviar instrucción"}
              </button>
              {chatReply ? (
                <p className="mt-3 rounded-lg bg-bg-light p-3 text-sm text-muted">{chatReply}</p>
              ) : null}
            </div>

            {article.similarityWarnings.length ? <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4"><h3 className="font-semibold text-warning-fg">Posibles contenidos similares</h3><ul className="mt-2 space-y-2 text-sm">{article.similarityWarnings.map((warning) => <li key={warning.articleId}><a href={warning.path} target="_blank" rel="noreferrer" className="font-semibold text-body underline">{warning.title}</a> · similitud {Math.round(warning.score)}/100</li>)}</ul></div> : null}

            <div className="grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface p-4">
                <h3 className="font-semibold text-body">Costo acumulado</h3>
                <p className="mt-2 text-2xl font-bold text-primary">{formatMxn(costs?.totalMxn ?? 0)}</p>
                <p className="mt-1 text-xs text-muted">
                  Estimación en pesos mexicanos (MXN). Incluye todas las regeneraciones, imágenes y
                  evaluaciones de este artículo.
                </p>
                <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto text-xs text-muted">
                  {(costs?.entries ?? []).map((entry) => (
                    <li key={entry.id} className="flex justify-between gap-3 border-t border-border pt-2">
                      <span>
                        <span className="text-body">{ACTIVITY_LABELS[entry.activity] ?? entry.activity}</span>
                        <span className="mt-0.5 block text-[10px] text-muted">
                          {new Date(entry.createdAt).toLocaleString("es-MX", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </span>
                      <span className="shrink-0 font-medium text-body">{formatMxn(entry.mxnEstimate)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4"><h3 className="font-semibold text-body">Publicar en Meta</h3><p className="mt-1 text-xs text-muted">Usa el caption social y la portada del artículo. Creativo OG con logo Bestie:</p><a className="mt-2 inline-flex text-xs font-semibold text-primary underline" href={`/api/share-og/blog/${article.id}.jpg`} target="_blank" rel="noreferrer">Descargar portada branded (1200)</a><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void run(() => publishMeta("facebook"))} className={primaryClass}>Facebook</button><button type="button" disabled={busy} onClick={() => void run(() => publishMeta("instagram"))} className={secondaryClass}>Instagram</button></div></div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { BLOG_BRAND_VOICE, BLOG_EDITORIAL_GOALS } from "./blogBrandPrompt.js";
import { recordBlogAiCost } from "./blogCosts.js";
import {
  getBlogArticleById,
  listPublishedBlogArticles,
  rowToBlogArticleDto,
  type BlogArticleRow,
} from "./blogDto.js";
import {
  blogGeminiCheapModel,
  blogGeminiDraftModel,
  extractJsonObject,
  generateGeminiText,
} from "./blogGemini.js";
import { resolveBlogImages } from "./blogImages.js";
import { blogArticlePublicPath, BLOG_CITY_META, BLOG_SOCIAL, ctaPathForArticle, slugifyBlogTitle } from "./blogPaths.js";
import type {
  BlogBlock,
  BlogFaqItem,
  BlogQualitySuggestion,
  BlogSimilarityWarning,
  BlogSource,
} from "./blogTypes.js";
import { recordGeminiTokens } from "./usageAnalytics.js";

function isoNow() {
  return new Date().toISOString();
}

function existingArticlesContext(db: DatabaseSync, excludeId?: string): string {
  const rows = db
    .prepare(
      `SELECT id, title, slug, city_code, excerpt, labels_json, status
       FROM blog_articles
       WHERE status IN ('published','draft')
       ORDER BY updated_at DESC LIMIT 40`,
    )
    .all() as Array<{
    id: string;
    title: string;
    slug: string;
    city_code: string | null;
    excerpt: string;
    labels_json: string;
    status: string;
  }>;
  return rows
    .filter((r) => r.id !== excludeId)
    .map(
      (r) =>
        `- [${r.status}] ${r.title} (id=${r.id}, city=${r.city_code || "nacional"}, labels=${r.labels_json}) :: ${r.excerpt.slice(0, 140)}`,
    )
    .join("\n");
}

type DraftPayload = {
  title: string;
  slug?: string;
  excerpt: string;
  labels: string[];
  aeoSummary: string;
  metaTitle: string;
  metaDescription: string;
  socialCaption: string;
  blocks: Array<Partial<BlogBlock> & { type: string }>;
  sources: Array<{ title: string; url: string; publisher?: string }>;
  faq: BlogFaqItem[];
  imageQueries: string[];
  qualityScore: number;
  qualitySuggestions: Array<{ title: string; detail: string }>;
};

function normalizeBlocks(raw: DraftPayload["blocks"], images: Awaited<ReturnType<typeof resolveBlogImages>>): BlogBlock[] {
  const blocks: BlogBlock[] = [];
  let imageIdx = 0;
  for (const b of raw) {
    const id = randomUUID();
    if (b.type === "heading") {
      blocks.push({ id, type: "heading", level: b.level === 3 ? 3 : 2, text: String(b.text ?? "").trim() });
    } else if (b.type === "paragraph") {
      blocks.push({ id, type: "paragraph", text: String(b.text ?? "").trim() });
    } else if (b.type === "quote") {
      blocks.push({ id, type: "quote", text: String(b.text ?? "").trim() });
    } else if (b.type === "list") {
      blocks.push({
        id,
        type: "list",
        items: (b.items ?? []).map((x) => String(x).trim()).filter(Boolean).slice(0, 12),
      });
    } else if (b.type === "cta") {
      blocks.push({
        id,
        type: "cta",
        label: String(b.label ?? "Explorar Bestie").trim(),
        href: String(b.href ?? "/").trim() || "/",
        text: b.text ? String(b.text).trim() : undefined,
      });
    } else if (b.type === "faq") {
      blocks.push({
        id,
        type: "faq",
        question: String(b.question ?? "").trim(),
        answer: String(b.answer ?? "").trim(),
      });
    } else if (b.type === "image") {
      const pick = images[imageIdx++];
      if (pick) {
        blocks.push({
          id,
          type: "image",
          imageUrl: pick.url,
          imageAlt: String(b.imageAlt || pick.alt || "").trim(),
          imageCredit: pick.credit,
          imageSource: pick.source,
        });
      }
    }
  }
  return blocks.filter((b) => {
    if (b.type === "paragraph" || b.type === "heading" || b.type === "quote") return Boolean(b.text);
    if (b.type === "list") return (b.items?.length ?? 0) > 0;
    if (b.type === "image") return Boolean(b.imageUrl);
    if (b.type === "faq") return Boolean(b.question && b.answer);
    return true;
  });
}

export async function generateBlogDraft(opts: {
  db: DatabaseSync;
  articleId: string;
  idea: string;
  cityCode?: string | null;
  uploadDir?: string;
}): Promise<{ ok: true; article: ReturnType<typeof rowToBlogArticleDto> } | { ok: false; error: string }> {
  const row = getBlogArticleById(opts.db, opts.articleId);
  if (!row) return { ok: false, error: "not_found" };

  const cityCode = opts.cityCode?.trim() || row.city_code || null;
  const cityLabel = cityCode && BLOG_CITY_META[cityCode] ? BLOG_CITY_META[cityCode].label : "México (nacional)";
  const ctaPath = ctaPathForArticle(cityCode);
  const existing = existingArticlesContext(opts.db, opts.articleId);

  const system = `${BLOG_BRAND_VOICE}\n\n${BLOG_EDITORIAL_GOALS}\n\nResponde SOLO con JSON válido (sin markdown).`;
  const user = `
Idea del editor: ${opts.idea.trim()}
Ciudad/enfoque: ${cityLabel}${cityCode ? ` (código ${cityCode})` : ""}
CTA principal del artículo: ${ctaPath}
Redes a mencionar al final: Facebook ${BLOG_SOCIAL.facebook} · Instagram ${BLOG_SOCIAL.instagram}

Artículos existentes (evita duplicar; si hay overlap, diferencia el ángulo):
${existing || "(ninguno)"}

Investiga en la web fuentes útiles (cualquier idioma). Prioriza México/LATAM/${cityLabel} cuando aporte, sin restringirte.
Devuelve JSON con esta forma:
{
  "title": string,
  "slug": string (kebab-case, sin ciudad),
  "excerpt": string (1-2 oraciones),
  "labels": string[],
  "aeoSummary": string (respuesta directa 2-4 oraciones para AEO),
  "metaTitle": string (<=60 chars),
  "metaDescription": string (<=155 chars),
  "socialCaption": string (español MX, listo para FB/IG, incluye URL placeholder BESTIE_URL),
  "imageQueries": string[] (3-5 búsquedas para fotos libres),
  "blocks": [
    {"type":"heading","level":2,"text":"..."},
    {"type":"paragraph","text":"... con citas [1] ..."},
    {"type":"image","imageAlt":"..."},
    {"type":"list","items":["..."]},
    {"type":"quote","text":"..."},
    {"type":"faq","question":"...","answer":"..."},
    {"type":"cta","label":"...","href":"${ctaPath}","text":"..."}
  ],
  "sources": [{"title":"...","url":"https://...","publisher":"..."}],
  "faq": [{"question":"...","answer":"..."}],
  "qualityScore": 0-100,
  "qualitySuggestions": [{"title":"...","detail":"..."}]
}
Incluye al menos 2 bloques image, 1 cta hacia ${ctaPath}, y sección útil con referencias [n].
Autoría: Bestie. Cierra con invitación a seguir FB e IG.
`.trim();

  const gen = await generateGeminiText({
    system,
    user,
    model: blogGeminiDraftModel(),
    googleSearch: true,
    temperature: 0.65,
    maxOutputTokens: 8192,
    timeoutMs: 120_000,
  });
  if (!gen.ok) return { ok: false, error: gen.error };

  recordGeminiTokens(gen.promptTokens, gen.outputTokens, gen.model);
  recordBlogAiCost(opts.db, {
    id: randomUUID(),
    articleId: opts.articleId,
    activity: "draft",
    model: gen.model,
    promptTokens: gen.promptTokens,
    outputTokens: gen.outputTokens,
    meta: { idea: opts.idea.slice(0, 200) },
  });

  const payload = extractJsonObject<DraftPayload>(gen.text);
  if (!payload?.title || !Array.isArray(payload.blocks)) {
    return { ok: false, error: "invalid_model_json" };
  }

  const images = await resolveBlogImages({
    db: opts.db,
    articleId: opts.articleId,
    queries: payload.imageQueries?.length ? payload.imageQueries : [payload.title, cityLabel],
    need: Math.max(2, payload.blocks.filter((b) => b.type === "image").length || 2),
    uploadDir: opts.uploadDir,
    themeHint: `${payload.title} — roomies ${cityLabel}`,
  });

  const blocks = normalizeBlocks(payload.blocks, images);
  const sources: BlogSource[] = (payload.sources ?? []).slice(0, 20).map((s, i) => ({
    id: i + 1,
    title: String(s.title || `Fuente ${i + 1}`).trim(),
    url: String(s.url || "").trim(),
    publisher: s.publisher ? String(s.publisher).trim() : undefined,
    accessedAt: isoNow().slice(0, 10),
  })).filter((s) => s.url.startsWith("http"));

  // Merge grounding URLs that weren't listed
  let nextId = sources.length + 1;
  for (const url of gen.groundingUrls ?? []) {
    if (sources.some((s) => s.url === url)) continue;
    sources.push({
      id: nextId++,
      title: url.replace(/^https?:\/\//, "").slice(0, 80),
      url,
      accessedAt: isoNow().slice(0, 10),
    });
  }

  const cover = images[0] ?? null;
  const slug = slugifyBlogTitle(payload.slug || payload.title);
  const suggestions: BlogQualitySuggestion[] = (payload.qualitySuggestions ?? []).slice(0, 8).map((s) => ({
    id: randomUUID(),
    title: String(s.title || "Mejora").trim(),
    detail: String(s.detail || "").trim(),
  }));

  const similarity = await computeSimilarityWarnings(opts.db, {
    articleId: opts.articleId,
    title: payload.title,
    excerpt: payload.excerpt,
    labels: payload.labels ?? [],
  });

  const now = isoNow();
  opts.db
    .prepare(
      `UPDATE blog_articles SET
        title = ?, slug = ?, excerpt = ?, city_code = ?, labels_json = ?,
        cover_image_url = ?, cover_image_credit = ?, cover_image_source = ?,
        blocks_json = ?, sources_json = ?, quality_score = ?, quality_suggestions_json = ?,
        similarity_warnings_json = ?, meta_title = ?, meta_description = ?, aeo_summary = ?,
        faq_json = ?, social_caption = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      payload.title.trim().slice(0, 180),
      slug,
      String(payload.excerpt || "").trim().slice(0, 400),
      cityCode,
      JSON.stringify((payload.labels ?? []).slice(0, 16)),
      cover?.url ?? row.cover_image_url,
      cover?.credit ?? row.cover_image_credit,
      cover?.source ?? row.cover_image_source,
      JSON.stringify(blocks),
      JSON.stringify(sources),
      Math.max(0, Math.min(100, Math.round(Number(payload.qualityScore) || 0))),
      JSON.stringify(suggestions),
      JSON.stringify(similarity),
      String(payload.metaTitle || payload.title).trim().slice(0, 70),
      String(payload.metaDescription || payload.excerpt).trim().slice(0, 170),
      String(payload.aeoSummary || payload.excerpt).trim().slice(0, 600),
      JSON.stringify(payload.faq ?? []),
      String(payload.socialCaption || "").replace(/BESTIE_URL/g, `https://www.bestie.mx${blogArticlePublicPath({ slug, cityCode })}`),
      now,
      opts.articleId,
    );

  const updated = getBlogArticleById(opts.db, opts.articleId)!;
  return { ok: true, article: rowToBlogArticleDto(updated) };
}

export async function computeSimilarityWarnings(
  db: DatabaseSync,
  opts: { articleId: string; title: string; excerpt: string; labels: string[] },
): Promise<BlogSimilarityWarning[]> {
  const others = db
    .prepare(
      `SELECT id, title, slug, city_code, excerpt, labels_json FROM blog_articles
       WHERE id != ? AND status IN ('published','draft') LIMIT 30`,
    )
    .all(opts.articleId) as Array<{
    id: string;
    title: string;
    slug: string;
    city_code: string | null;
    excerpt: string;
    labels_json: string;
  }>;

  if (!others.length) return [];

  const gen = await generateGeminiText({
    system: "Compara similitud editorial. Responde SOLO JSON.",
    user: `Artículo nuevo:
Título: ${opts.title}
Excerpt: ${opts.excerpt}
Labels: ${opts.labels.join(", ")}

Otros:
${others.map((o) => `- id=${o.id} | ${o.title} | ${o.excerpt.slice(0, 120)} | ${o.labels_json}`).join("\n")}

Devuelve {"warnings":[{"articleId":"...","score":0-100,"reason":"..."}]} solo si score>=55.`,
    model: blogGeminiCheapModel(),
    temperature: 0.2,
    maxOutputTokens: 2048,
  });

  if (!gen.ok) {
    // Heuristic fallback
    return others
      .map((o) => {
        const score = roughSimilarity(opts.title, o.title);
        return {
          articleId: o.id,
          title: o.title,
          path: blogArticlePublicPath({ slug: o.slug, cityCode: o.city_code }),
          score,
        };
      })
      .filter((w) => w.score >= 55)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  recordGeminiTokens(gen.promptTokens, gen.outputTokens, gen.model);
  recordBlogAiCost(db, {
    id: randomUUID(),
    articleId: opts.articleId,
    activity: "similarity",
    model: gen.model,
    promptTokens: gen.promptTokens,
    outputTokens: gen.outputTokens,
  });

  const parsed = extractJsonObject<{ warnings?: Array<{ articleId: string; score: number }> }>(gen.text);
  const byId = new Map(others.map((o) => [o.id, o]));
  return (parsed?.warnings ?? [])
    .map((w) => {
      const o = byId.get(w.articleId);
      if (!o) return null;
      return {
        articleId: o.id,
        title: o.title,
        path: blogArticlePublicPath({ slug: o.slug, cityCode: o.city_code }),
        score: Math.max(0, Math.min(100, Math.round(Number(w.score) || 0))),
      } satisfies BlogSimilarityWarning;
    })
    .filter((x): x is BlogSimilarityWarning => Boolean(x))
    .filter((w) => w.score >= 55)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function roughSimilarity(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\W+/).filter((x) => x.length > 3));
  const tb = b.toLowerCase().split(/\W+/).filter((x) => x.length > 3);
  if (!ta.size || !tb.length) return 0;
  let hit = 0;
  for (const t of tb) if (ta.has(t)) hit++;
  return Math.round((hit / Math.max(ta.size, tb.length)) * 100);
}

export async function rescoreBlogArticle(opts: {
  db: DatabaseSync;
  articleId: string;
}): Promise<{ ok: true; article: ReturnType<typeof rowToBlogArticleDto> } | { ok: false; error: string }> {
  const row = getBlogArticleById(opts.db, opts.articleId);
  if (!row) return { ok: false, error: "not_found" };
  const dto = rowToBlogArticleDto(row);

  const gen = await generateGeminiText({
    system: `${BLOG_BRAND_VOICE}\nEvalúa calidad editorial 0-100. SOLO JSON.`,
    user: `Artículo:
${JSON.stringify({
  title: dto.title,
  excerpt: dto.excerpt,
  labels: dto.labels,
  blocks: dto.blocks,
  sources: dto.sources,
  aeoSummary: dto.aeoSummary,
})}
Devuelve {"qualityScore":0-100,"qualitySuggestions":[{"title":"...","detail":"..."}]}`,
    model: blogGeminiCheapModel(),
    temperature: 0.3,
    maxOutputTokens: 2048,
  });
  if (!gen.ok) return { ok: false, error: gen.error };

  recordGeminiTokens(gen.promptTokens, gen.outputTokens, gen.model);
  recordBlogAiCost(opts.db, {
    id: randomUUID(),
    articleId: opts.articleId,
    activity: "rescore",
    model: gen.model,
    promptTokens: gen.promptTokens,
    outputTokens: gen.outputTokens,
  });

  const parsed = extractJsonObject<{
    qualityScore?: number;
    qualitySuggestions?: Array<{ title: string; detail: string }>;
  }>(gen.text);
  const suggestions = (parsed?.qualitySuggestions ?? []).slice(0, 8).map((s) => ({
    id: randomUUID(),
    title: String(s.title || "Mejora").trim(),
    detail: String(s.detail || "").trim(),
  }));

  opts.db
    .prepare(
      `UPDATE blog_articles SET quality_score = ?, quality_suggestions_json = ?, updated_at = ? WHERE id = ?`,
    )
    .run(
      Math.max(0, Math.min(100, Math.round(Number(parsed?.qualityScore) || 0))),
      JSON.stringify(suggestions),
      isoNow(),
      opts.articleId,
    );

  return { ok: true, article: rowToBlogArticleDto(getBlogArticleById(opts.db, opts.articleId)!) };
}

export async function enhanceBlogWithSuggestions(opts: {
  db: DatabaseSync;
  articleId: string;
  suggestionIds: string[];
  uploadDir?: string;
}): Promise<{ ok: true; article: ReturnType<typeof rowToBlogArticleDto> } | { ok: false; error: string }> {
  const row = getBlogArticleById(opts.db, opts.articleId);
  if (!row) return { ok: false, error: "not_found" };
  const dto = rowToBlogArticleDto(row);
  const selected = dto.qualitySuggestions.filter((s) => opts.suggestionIds.includes(s.id));
  if (!selected.length) return { ok: false, error: "no_suggestions" };

  const gen = await generateGeminiText({
    system: `${BLOG_BRAND_VOICE}\n${BLOG_EDITORIAL_GOALS}\nMejora el artículo aplicando SOLO las sugerencias aceptadas. SOLO JSON con los mismos campos que un draft completo.`,
    user: `Artículo actual:\n${JSON.stringify(dto)}\n\nSugerencias a aplicar:\n${JSON.stringify(selected)}`,
    model: blogGeminiDraftModel(),
    googleSearch: true,
    temperature: 0.55,
    maxOutputTokens: 8192,
    timeoutMs: 120_000,
  });
  if (!gen.ok) return { ok: false, error: gen.error };

  recordGeminiTokens(gen.promptTokens, gen.outputTokens, gen.model);
  recordBlogAiCost(opts.db, {
    id: randomUUID(),
    articleId: opts.articleId,
    activity: "enhance",
    model: gen.model,
    promptTokens: gen.promptTokens,
    outputTokens: gen.outputTokens,
  });

  // Reuse draft apply path via temporary idea wrapper
  const payload = extractJsonObject<DraftPayload>(gen.text);
  if (!payload?.title || !Array.isArray(payload.blocks)) return { ok: false, error: "invalid_model_json" };

  const images = await resolveBlogImages({
    db: opts.db,
    articleId: opts.articleId,
    queries: payload.imageQueries?.length ? payload.imageQueries : [payload.title],
    need: Math.max(2, payload.blocks.filter((b) => b.type === "image").length || 2),
    uploadDir: opts.uploadDir,
    themeHint: payload.title,
  });
  const blocks = normalizeBlocks(payload.blocks, images);
  const sources: BlogSource[] = (payload.sources ?? []).slice(0, 20).map((s, i) => ({
    id: i + 1,
    title: String(s.title || `Fuente ${i + 1}`).trim(),
    url: String(s.url || "").trim(),
    publisher: s.publisher ? String(s.publisher).trim() : undefined,
    accessedAt: isoNow().slice(0, 10),
  })).filter((s) => s.url.startsWith("http"));

  const cover = images[0];
  const slug = slugifyBlogTitle(payload.slug || payload.title);
  const cityCode = row.city_code;
  opts.db
    .prepare(
      `UPDATE blog_articles SET
        title = ?, slug = ?, excerpt = ?, labels_json = ?,
        cover_image_url = COALESCE(?, cover_image_url),
        cover_image_credit = COALESCE(?, cover_image_credit),
        cover_image_source = COALESCE(?, cover_image_source),
        blocks_json = ?, sources_json = ?, quality_score = ?, quality_suggestions_json = ?,
        meta_title = ?, meta_description = ?, aeo_summary = ?, faq_json = ?, social_caption = ?,
        updated_at = ?
       WHERE id = ?`,
    )
    .run(
      payload.title.trim().slice(0, 180),
      slug,
      String(payload.excerpt || "").trim().slice(0, 400),
      JSON.stringify((payload.labels ?? dto.labels).slice(0, 16)),
      cover?.url ?? null,
      cover?.credit ?? null,
      cover?.source ?? null,
      JSON.stringify(blocks),
      JSON.stringify(sources.length ? sources : dto.sources),
      Math.max(0, Math.min(100, Math.round(Number(payload.qualityScore) || dto.qualityScore || 0))),
      JSON.stringify(
        (payload.qualitySuggestions ?? []).slice(0, 8).map((s) => ({
          id: randomUUID(),
          title: String(s.title || "Mejora").trim(),
          detail: String(s.detail || "").trim(),
        })),
      ),
      String(payload.metaTitle || payload.title).trim().slice(0, 70),
      String(payload.metaDescription || payload.excerpt).trim().slice(0, 170),
      String(payload.aeoSummary || payload.excerpt).trim().slice(0, 600),
      JSON.stringify(payload.faq ?? dto.faq),
      String(payload.socialCaption || dto.socialCaption || "").replace(
        /BESTIE_URL/g,
        `https://www.bestie.mx${blogArticlePublicPath({ slug, cityCode })}`,
      ),
      isoNow(),
      opts.articleId,
    );

  return { ok: true, article: rowToBlogArticleDto(getBlogArticleById(opts.db, opts.articleId)!) };
}

export async function chatEditBlogArticle(opts: {
  db: DatabaseSync;
  articleId: string;
  message: string;
  uploadDir?: string;
}): Promise<
  | {
      ok: true;
      article: ReturnType<typeof rowToBlogArticleDto>;
      reply: string;
      actions: string[];
    }
  | { ok: false; error: string }
> {
  const row = getBlogArticleById(opts.db, opts.articleId);
  if (!row) return { ok: false, error: "not_found" };
  const dto = rowToBlogArticleDto(row);

  const gen = await generateGeminiText({
    system: `${BLOG_BRAND_VOICE}\n${BLOG_EDITORIAL_GOALS}
Eres el copiloto del editor del blog en admin. Puedes proponer cambios al artículo completo.
Si el usuario pide explícitamente publicar, archivar o cambiar status/slug/labels/ciudad, inclúyelo en "articlePatch".
Responde SOLO JSON: {"reply":"...","actions":["..."],"articlePatch":{...campos parciales del artículo incluyendo blocks/sources si cambian...}}`,
    user: `Artículo actual:\n${JSON.stringify(dto)}\n\nMensaje del editor:\n${opts.message.trim()}`,
    model: blogGeminiDraftModel(),
    googleSearch: /busca|investiga|fuente|noticia|news|actualiza datos/i.test(opts.message),
    temperature: 0.5,
    maxOutputTokens: 8192,
    timeoutMs: 120_000,
  });
  if (!gen.ok) return { ok: false, error: gen.error };

  recordGeminiTokens(gen.promptTokens, gen.outputTokens, gen.model);
  recordBlogAiCost(opts.db, {
    id: randomUUID(),
    articleId: opts.articleId,
    activity: "chat",
    model: gen.model,
    promptTokens: gen.promptTokens,
    outputTokens: gen.outputTokens,
    meta: { message: opts.message.slice(0, 240) },
  });

  const parsed = extractJsonObject<{
    reply?: string;
    actions?: string[];
    articlePatch?: Partial<{
      title: string;
      slug: string;
      excerpt: string;
      status: string;
      cityCode: string | null;
      labels: string[];
      blocks: BlogBlock[];
      sources: BlogSource[];
      metaTitle: string;
      metaDescription: string;
      aeoSummary: string;
      faq: BlogFaqItem[];
      socialCaption: string;
      qualityScore: number;
    }>;
  }>(gen.text);

  const patch = parsed?.articlePatch;
  if (patch) {
    applyArticlePatch(opts.db, row, patch as Record<string, unknown>);
  }

  return {
    ok: true,
    article: rowToBlogArticleDto(getBlogArticleById(opts.db, opts.articleId)!),
    reply: String(parsed?.reply || "Listo.").trim(),
    actions: Array.isArray(parsed?.actions) ? parsed!.actions!.map(String) : [],
  };
}

function applyArticlePatch(db: DatabaseSync, row: BlogArticleRow, patch: Record<string, unknown>): void {
  const p = patch;
  const title = typeof p.title === "string" ? p.title.trim().slice(0, 180) : row.title;
  const slug =
    typeof p.slug === "string" ? slugifyBlogTitle(p.slug) : row.slug;
  const excerpt = typeof p.excerpt === "string" ? p.excerpt.trim().slice(0, 400) : row.excerpt;
  let status = row.status;
  if (p.status === "draft" || p.status === "published" || p.status === "archived") status = p.status;
  let cityCode = row.city_code;
  if (p.cityCode === null || p.cityCode === "") cityCode = null;
  else if (typeof p.cityCode === "string" && p.cityCode === "gdl") cityCode = "gdl";

  const labels = Array.isArray(p.labels) ? JSON.stringify(p.labels.slice(0, 16)) : row.labels_json;
  const blocks = Array.isArray(p.blocks) ? JSON.stringify(p.blocks) : row.blocks_json;
  const sources = Array.isArray(p.sources) ? JSON.stringify(p.sources) : row.sources_json;
  const faq = Array.isArray(p.faq) ? JSON.stringify(p.faq) : row.faq_json;
  const metaTitle = typeof p.metaTitle === "string" ? p.metaTitle.slice(0, 70) : row.meta_title;
  const metaDescription =
    typeof p.metaDescription === "string" ? p.metaDescription.slice(0, 170) : row.meta_description;
  const aeoSummary = typeof p.aeoSummary === "string" ? p.aeoSummary.slice(0, 600) : row.aeo_summary;
  const socialCaption = typeof p.socialCaption === "string" ? p.socialCaption : row.social_caption;
  const qualityScore =
    typeof p.qualityScore === "number"
      ? Math.max(0, Math.min(100, Math.round(p.qualityScore)))
      : row.quality_score;

  let publishedAt = row.published_at;
  if (status === "published" && !publishedAt) publishedAt = isoNow();
  if (status !== "published") {
    /* keep published_at history */
  }

  db.prepare(
    `UPDATE blog_articles SET
      title=?, slug=?, excerpt=?, status=?, city_code=?, labels_json=?,
      blocks_json=?, sources_json=?, faq_json=?, meta_title=?, meta_description=?,
      aeo_summary=?, social_caption=?, quality_score=?, published_at=?, updated_at=?
     WHERE id=?`,
  ).run(
    title,
    slug,
    excerpt,
    status,
    cityCode,
    labels,
    blocks,
    sources,
    faq,
    metaTitle,
    metaDescription,
    aeoSummary,
    socialCaption,
    qualityScore,
    publishedAt,
    isoNow(),
    row.id,
  );
}

export async function proposeBlogTopics(opts: {
  db: DatabaseSync;
  cityCode?: string | null;
}): Promise<
  | {
      ok: true;
      topics: Array<{
        title: string;
        angle: string;
        whyNow: string;
        cityCode: string | null;
        promoteArticleId?: string;
        promotePath?: string;
        socialCaption?: string;
      }>;
    }
  | { ok: false; error: string }
> {
  const cityCode = opts.cityCode === "gdl" ? "gdl" : null;
  const cityLabel = cityCode ? BLOG_CITY_META.gdl.label : "México";
  const existing = existingArticlesContext(opts.db);
  const published = listPublishedBlogArticles(opts.db, { limit: 15 }).items;

  const gen = await generateGeminiText({
    system: `${BLOG_BRAND_VOICE}\n${BLOG_EDITORIAL_GOALS}\nPropón temas de blog. SOLO JSON.`,
    user: `Escanea noticias/tendencias recientes relevantes para ${cityLabel} y roommates/renta compartida.
También sugiere REPROMOVER artículos existentes si una noticia los hace otra vez relevantes.

Artículos existentes:
${existing || "(ninguno)"}

Publicados (para promote):
${published.map((p) => `- id=${p.id} path=${p.path} title=${p.title}`).join("\n") || "(ninguno)"}

Devuelve {"topics":[{"title":"...","angle":"...","whyNow":"...","cityCode":${cityCode ? `"gdl"` : "null"},"promoteArticleId": null o id,"socialCaption":"..."}]}
Máximo 8 topics. Incluye mix de ideas nuevas y 1-3 promotes si aplica.`,
    model: blogGeminiDraftModel(),
    googleSearch: true,
    temperature: 0.7,
    maxOutputTokens: 4096,
    timeoutMs: 90_000,
  });
  if (!gen.ok) return { ok: false, error: gen.error };

  // Topics are not always tied to one article — record against a synthetic bucket via first draft later.
  // Cost is recorded by caller with a scratch article or we skip article_id constraint.
  // Use a dedicated "topics" row only when articleId provided — here return without DB cost if no article.
  // Caller (admin) will pass a cost sink article or we insert with article_id optional — schema requires article_id.
  // Record against most recent draft if any; else skip.

  const parsed = extractJsonObject<{
    topics?: Array<{
      title: string;
      angle: string;
      whyNow: string;
      cityCode?: string | null;
      promoteArticleId?: string | null;
      socialCaption?: string;
    }>;
  }>(gen.text);

  const byId = new Map(published.map((p) => [p.id, p]));
  const topics = (parsed?.topics ?? []).slice(0, 8).map((t) => {
    const promote = t.promoteArticleId ? byId.get(t.promoteArticleId) : undefined;
    return {
      title: String(t.title || "").trim(),
      angle: String(t.angle || "").trim(),
      whyNow: String(t.whyNow || "").trim(),
      cityCode: t.cityCode === "gdl" || cityCode === "gdl" ? ("gdl" as const) : null,
      promoteArticleId: promote?.id,
      promotePath: promote?.path,
      socialCaption: t.socialCaption ? String(t.socialCaption) : undefined,
    };
  }).filter((t) => t.title);

  // Attach cost to a placeholder: create ephemeral cost log only if we have any article
  const anyArticle = opts.db.prepare(`SELECT id FROM blog_articles ORDER BY updated_at DESC LIMIT 1`).get() as
    | { id: string }
    | undefined;
  if (anyArticle) {
    recordGeminiTokens(gen.promptTokens, gen.outputTokens, gen.model);
    recordBlogAiCost(opts.db, {
      id: randomUUID(),
      articleId: anyArticle.id,
      activity: "topics",
      model: gen.model,
      promptTokens: gen.promptTokens,
      outputTokens: gen.outputTokens,
      meta: { cityCode },
    });
  }

  return { ok: true, topics };
}

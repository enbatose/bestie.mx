import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import express, { type NextFunction, type Request, type Response } from "express";
import { isAdminUser } from "./adminAuth.js";
import {
  chatEditBlogArticle,
  enhanceBlogWithSuggestions,
  generateBlogDraft,
  proposeBlogTopics,
  rescoreBlogArticle,
} from "./blogAiService.js";
import { clearBlogChatMemory, loadBlogChatMemory } from "./blogChatMemory.js";
import { sumBlogAiCosts } from "./blogCosts.js";
import {
  getBlogArticleById,
  rowToBlogArticleDto,
  type BlogArticleRow,
} from "./blogDto.js";
import { blogArticleShareUrl, normalizeSocialCaption, slugifyBlogTitle } from "./blogPaths.js";
import { isBlogLiveCityCode, normalizeBlogStatus } from "./blogSchema.js";
import { resolveUploadDir } from "./dataPaths.js";
import { readAuthUserId } from "./jwtSession.js";
import { BLOG_ADMIN_JSON_BODY_LIMIT } from "./blogGemini.js";
import { tryPublishBlogToMeta } from "./blogMetaPublish.js";
import { clampStr } from "./validation.js";

function isoNow() {
  return new Date().toISOString();
}

function requireAdmin(db: DatabaseSync, req: Request, res: Response, next: NextFunction): void {
  const uid = readAuthUserId(req);
  if (!uid) {
    res.status(401).json({ error: "auth_required" });
    return;
  }
  if (!isAdminUser(db, uid)) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  next();
}

export function blogAdminRouter(db: DatabaseSync, databasePath?: string) {
  const r = express.Router();
  r.use(express.json({ limit: BLOG_ADMIN_JSON_BODY_LIMIT }));
  r.use((req, res, next) => requireAdmin(db, req, res, next));

  const uploadDir = resolveUploadDir(databasePath);

  r.get("/articles", (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const where: string[] = ["1=1"];
    const params: unknown[] = [];
    if (q) {
      where.push(
        `(LOWER(title) LIKE ? OR LOWER(excerpt) LIKE ? OR LOWER(labels_json) LIKE ? OR LOWER(blocks_json) LIKE ? OR IFNULL(LOWER(city_code),'') LIKE ? OR LOWER(slug) LIKE ?)`,
      );
      const like = `%${q.replace(/%/g, "")}%`;
      params.push(like, like, like, like, like, like);
    }
    const rows = db
      .prepare(
        `SELECT * FROM blog_articles WHERE ${where.join(" AND ")}
         ORDER BY updated_at DESC LIMIT 200`,
      )
      .all(...(params as string[])) as BlogArticleRow[];
    res.json({ items: rows.map(rowToBlogArticleDto) });
  });

  r.post("/articles", (req, res) => {
    const id = randomUUID();
    const now = isoNow();
    const title = clampStr(String(req.body?.title ?? "Borrador sin título"), 180) || "Borrador sin título";
    const cityRaw = typeof req.body?.cityCode === "string" ? req.body.cityCode.trim().toLowerCase() : "";
    const cityCode = isBlogLiveCityCode(cityRaw) ? cityRaw : null;
    const slugBase = slugifyBlogTitle(typeof req.body?.slug === "string" ? req.body.slug : title);
    const slug = uniqueSlug(db, slugBase, cityCode, id);
    db.prepare(
      `INSERT INTO blog_articles (
        id, slug, title, excerpt, status, city_code, labels_json, blocks_json, sources_json,
        quality_suggestions_json, similarity_warnings_json, faq_json, view_count, created_at, updated_at
      ) VALUES (?, ?, ?, '', 'draft', ?, '[]', '[]', '[]', '[]', '[]', '[]', 0, ?, ?)`,
    ).run(id, slug, title, cityCode, now, now);
    res.status(201).json({ article: rowToBlogArticleDto(getBlogArticleById(db, id)!) });
  });

  r.get("/articles/:id", (req, res) => {
    const row = getBlogArticleById(db, String(req.params.id));
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const costs = sumBlogAiCosts(db, row.id);
    const memory = loadBlogChatMemory(row);
    res.json({
      article: rowToBlogArticleDto(row),
      costs: { totalUsd: costs.usd, totalMxn: costs.mxn, entries: costs.rows },
      chatHistory: memory.history,
      chatRevisions: memory.revisions.map((r) => ({
        revision: r.revision,
        title: r.title,
        createdAt: r.createdAt,
      })),
    });
  });

  r.put("/articles/:id", (req, res) => {
    const row = getBlogArticleById(db, String(req.params.id));
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const body = req.body ?? {};
    const title =
      typeof body.title === "string" ? clampStr(body.title, 180) || row.title : row.title;
    const excerpt = typeof body.excerpt === "string" ? clampStr(body.excerpt, 400) : row.excerpt;
    const status = normalizeBlogStatus(typeof body.status === "string" ? body.status : row.status);
    let cityCode = row.city_code;
    if (body.cityCode === null || body.cityCode === "") cityCode = null;
    else if (typeof body.cityCode === "string" && isBlogLiveCityCode(body.cityCode.trim().toLowerCase())) {
      cityCode = body.cityCode.trim().toLowerCase();
    }
    const slugIn = typeof body.slug === "string" ? slugifyBlogTitle(body.slug) : row.slug;
    const slug = uniqueSlug(db, slugIn, cityCode, row.id);
    const labels = Array.isArray(body.labels) ? JSON.stringify(body.labels.slice(0, 24)) : row.labels_json;
    const blocks = Array.isArray(body.blocks) ? JSON.stringify(body.blocks) : row.blocks_json;
    const sources = Array.isArray(body.sources) ? JSON.stringify(body.sources) : row.sources_json;
    const faq = Array.isArray(body.faq) ? JSON.stringify(body.faq) : row.faq_json;
    const coverImageUrl =
      typeof body.coverImageUrl === "string" ? body.coverImageUrl.trim() || null : row.cover_image_url;
    const coverImageCredit =
      typeof body.coverImageCredit === "string" ? body.coverImageCredit : row.cover_image_credit;
    const coverImageSource =
      typeof body.coverImageSource === "string" ? body.coverImageSource : row.cover_image_source;
    const metaTitle = typeof body.metaTitle === "string" ? body.metaTitle.slice(0, 70) : row.meta_title;
    const metaDescription =
      typeof body.metaDescription === "string" ? body.metaDescription.slice(0, 170) : row.meta_description;
    const aeoSummary = typeof body.aeoSummary === "string" ? body.aeoSummary.slice(0, 600) : row.aeo_summary;
    const socialCaption =
      typeof body.socialCaption === "string"
        ? normalizeSocialCaption(body.socialCaption, {
            articleUrl: blogArticleShareUrl({ slug, cityCode }),
          })
        : row.social_caption;

    let publishedAt = row.published_at;
    if (status === "published" && !publishedAt) publishedAt = isoNow();

    db.prepare(
      `UPDATE blog_articles SET
        title=?, slug=?, excerpt=?, status=?, city_code=?, labels_json=?,
        cover_image_url=?, cover_image_credit=?, cover_image_source=?,
        blocks_json=?, sources_json=?, faq_json=?, meta_title=?, meta_description=?,
        aeo_summary=?, social_caption=?, published_at=?, updated_at=?
       WHERE id=?`,
    ).run(
      title,
      slug,
      excerpt,
      status,
      cityCode,
      labels,
      coverImageUrl,
      coverImageCredit,
      coverImageSource,
      blocks,
      sources,
      faq,
      metaTitle,
      metaDescription,
      aeoSummary,
      socialCaption,
      publishedAt,
      isoNow(),
      row.id,
    );

    const costs = sumBlogAiCosts(db, row.id);
    res.json({
      article: rowToBlogArticleDto(getBlogArticleById(db, row.id)!),
      costs: { totalUsd: costs.usd, totalMxn: costs.mxn, entries: costs.rows },
    });
  });

  r.delete("/articles/:id", (req, res) => {
    const id = String(req.params.id);
    const row = getBlogArticleById(db, id);
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    db.prepare(`DELETE FROM blog_comments WHERE article_id = ?`).run(id);
    db.prepare(`DELETE FROM blog_ai_costs WHERE article_id = ?`).run(id);
    db.prepare(`DELETE FROM blog_articles WHERE id = ?`).run(id);
    res.json({ ok: true });
  });

  r.post("/articles/:id/generate", async (req, res) => {
    const idea = clampStr(String(req.body?.idea ?? ""), 4000);
    if (idea.length < 8) {
      res.status(400).json({ error: "idea_required" });
      return;
    }
    const cityRaw = typeof req.body?.cityCode === "string" ? req.body.cityCode.trim().toLowerCase() : "";
    const cityCode = isBlogLiveCityCode(cityRaw) ? cityRaw : cityRaw === "" ? undefined : null;
    const result = await generateBlogDraft({
      db,
      articleId: String(req.params.id),
      idea,
      cityCode: cityCode === null ? null : cityCode,
      uploadDir,
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    // Full regenerate starts a new editorial baseline; drop prior instruction memory.
    clearBlogChatMemory(db, String(req.params.id));
    const costs = sumBlogAiCosts(db, String(req.params.id));
    res.json({
      article: result.article,
      costs: { totalUsd: costs.usd, totalMxn: costs.mxn, entries: costs.rows },
      chatHistory: [],
      chatRevisions: [],
    });
  });

  r.post("/articles/:id/rescore", async (req, res) => {
    const result = await rescoreBlogArticle({ db, articleId: String(req.params.id) });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    const costs = sumBlogAiCosts(db, String(req.params.id));
    res.json({
      article: result.article,
      costs: { totalUsd: costs.usd, totalMxn: costs.mxn, entries: costs.rows },
    });
  });

  r.post("/articles/:id/enhance", async (req, res) => {
    const ids = Array.isArray(req.body?.suggestionIds)
      ? req.body.suggestionIds.map(String)
      : [];
    const result = await enhanceBlogWithSuggestions({
      db,
      articleId: String(req.params.id),
      suggestionIds: ids,
      uploadDir,
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    const costs = sumBlogAiCosts(db, String(req.params.id));
    res.json({
      article: result.article,
      costs: { totalUsd: costs.usd, totalMxn: costs.mxn, entries: costs.rows },
    });
  });

  r.post("/articles/:id/chat", async (req, res) => {
    const message = clampStr(String(req.body?.message ?? ""), 4000);
    if (!message) {
      res.status(400).json({ error: "message_required" });
      return;
    }
    const result = await chatEditBlogArticle({
      db,
      articleId: String(req.params.id),
      message,
      uploadDir,
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    const costs = sumBlogAiCosts(db, String(req.params.id));
    res.json({
      article: result.article,
      reply: result.reply,
      actions: result.actions,
      chatHistory: result.chatHistory,
      chatRevisions: result.chatRevisions,
      costs: { totalUsd: costs.usd, totalMxn: costs.mxn, entries: costs.rows },
    });
  });

  r.delete("/articles/:id/chat-memory", (req, res) => {
    const id = String(req.params.id);
    const row = getBlogArticleById(db, id);
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    clearBlogChatMemory(db, id);
    res.json({ ok: true, chatHistory: [], chatRevisions: [] });
  });

  r.post("/topics", async (req, res) => {
    const cityRaw = typeof req.body?.cityCode === "string" ? req.body.cityCode.trim().toLowerCase() : "";
    const result = await proposeBlogTopics({
      db,
      cityCode: isBlogLiveCityCode(cityRaw) ? cityRaw : null,
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  r.post("/articles/:id/meta-publish", async (req, res) => {
    const row = getBlogArticleById(db, String(req.params.id));
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const article = rowToBlogArticleDto(row);
    const platform = req.body?.platform === "instagram" ? "instagram" : "facebook";
    const result = await tryPublishBlogToMeta({ article, platform });
    res.status(result.ok ? 200 : 400).json(result);
  });

  return r;
}

function uniqueSlug(
  db: DatabaseSync,
  base: string,
  _cityCode: string | null,
  excludeId: string,
): string {
  let slug = base || "articulo";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
    const row = db.prepare(`SELECT id FROM blog_articles WHERE slug = ?`).get(candidate) as
      | { id: string }
      | undefined;
    if (!row || row.id === excludeId) return candidate;
  }
  return `${slug}-${randomUUID().slice(0, 8)}`;
}

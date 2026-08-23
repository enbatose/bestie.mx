import type { DatabaseSync } from "node:sqlite";
import { blogArticlePublicPath, BLOG_CITY_META, ctaPathForArticle } from "./blogPaths.js";
import { normalizeBlogStatus } from "./blogSchema.js";
import {
  parseJsonArray,
  parseLabels,
  type BlogBlock,
  type BlogFaqItem,
  type BlogQualityStrength,
  type BlogQualitySuggestion,
  type BlogSimilarityWarning,
  type BlogSource,
} from "./blogTypes.js";

export type BlogArticleRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  status: string;
  city_code: string | null;
  labels_json: string;
  cover_image_url: string | null;
  cover_image_credit: string | null;
  cover_image_source: string | null;
  blocks_json: string;
  sources_json: string;
  quality_score: number | null;
  quality_suggestions_json: string;
  quality_strengths_json: string;
  similarity_warnings_json: string;
  view_count: number;
  meta_title: string | null;
  meta_description: string | null;
  aeo_summary: string | null;
  faq_json: string;
  social_caption: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BlogArticleDto = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  status: "draft" | "published" | "archived";
  cityCode: string | null;
  cityLabel: string | null;
  labels: string[];
  coverImageUrl: string | null;
  coverImageCredit: string | null;
  coverImageSource: string | null;
  blocks: BlogBlock[];
  sources: BlogSource[];
  qualityScore: number | null;
  qualitySuggestions: BlogQualitySuggestion[];
  qualityStrengths: BlogQualityStrength[];
  similarityWarnings: BlogSimilarityWarning[];
  viewCount: number;
  metaTitle: string | null;
  metaDescription: string | null;
  aeoSummary: string | null;
  faq: BlogFaqItem[];
  socialCaption: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  path: string;
  ctaPath: string;
};

export function rowToBlogArticleDto(row: BlogArticleRow): BlogArticleDto {
  const cityCode = row.city_code?.trim() || null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? "",
    status: normalizeBlogStatus(row.status),
    cityCode,
    cityLabel: cityCode && BLOG_CITY_META[cityCode] ? BLOG_CITY_META[cityCode].label : null,
    labels: parseLabels(row.labels_json),
    coverImageUrl: row.cover_image_url,
    coverImageCredit: row.cover_image_credit,
    coverImageSource: row.cover_image_source,
    blocks: parseJsonArray<BlogBlock>(row.blocks_json),
    sources: parseJsonArray<BlogSource>(row.sources_json),
    qualityScore: row.quality_score == null ? null : Number(row.quality_score),
    qualitySuggestions: parseJsonArray<BlogQualitySuggestion>(row.quality_suggestions_json),
    qualityStrengths: parseJsonArray<BlogQualityStrength>(row.quality_strengths_json ?? "[]"),
    similarityWarnings: parseJsonArray<BlogSimilarityWarning>(row.similarity_warnings_json),
    viewCount: Number(row.view_count) || 0,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    aeoSummary: row.aeo_summary,
    faq: parseJsonArray<BlogFaqItem>(row.faq_json),
    socialCaption: row.social_caption,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    path: blogArticlePublicPath({ slug: row.slug, cityCode }),
    ctaPath: ctaPathForArticle(cityCode),
  };
}

export function getBlogArticleById(db: DatabaseSync, id: string): BlogArticleRow | null {
  const row = db.prepare(`SELECT * FROM blog_articles WHERE id = ?`).get(id) as BlogArticleRow | undefined;
  return row ?? null;
}

export function getBlogArticleBySlug(
  db: DatabaseSync,
  opts: { slug: string; cityCode?: string | null; publishedOnly?: boolean },
): BlogArticleRow | null {
  const slug = opts.slug.trim();
  const city = opts.cityCode?.trim() || null;
  if (city) {
    const row = db
      .prepare(
        `SELECT * FROM blog_articles WHERE slug = ? AND city_code = ?
         ${opts.publishedOnly ? "AND status = 'published'" : ""}`,
      )
      .get(slug, city) as BlogArticleRow | undefined;
    return row ?? null;
  }
  const row = db
    .prepare(
      `SELECT * FROM blog_articles WHERE slug = ? AND (city_code IS NULL OR city_code = '')
       ${opts.publishedOnly ? "AND status = 'published'" : ""}`,
    )
    .get(slug) as BlogArticleRow | undefined;
  return row ?? null;
}

export function listPublishedBlogArticles(
  db: DatabaseSync,
  opts: { q?: string; city?: string | null; label?: string | null; limit?: number; offset?: number },
): { items: BlogArticleDto[]; total: number } {
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
  const offset = Math.max(0, opts.offset ?? 0);
  const q = (opts.q ?? "").trim().toLowerCase();
  const city = opts.city?.trim().toLowerCase() || null;
  const label = opts.label?.trim().toLowerCase() || null;

  const where: string[] = [`status = 'published'`];
  const params: unknown[] = [];

  if (city === "national") {
    where.push(`(city_code IS NULL OR city_code = '')`);
  } else if (city) {
    where.push(`city_code = ?`);
    params.push(city);
  }

  if (q) {
    where.push(
      `(LOWER(title) LIKE ? OR LOWER(excerpt) LIKE ? OR LOWER(labels_json) LIKE ? OR LOWER(blocks_json) LIKE ? OR IFNULL(LOWER(city_code),'') LIKE ?)`,
    );
    const like = `%${q.replace(/%/g, "")}%`;
    params.push(like, like, like, like, like);
  }

  if (label) {
    where.push(`LOWER(labels_json) LIKE ?`);
    params.push(`%${label.replace(/%/g, "")}%`);
  }

  const whereSql = where.join(" AND ");
  const bind = params as string[];
  const totalRow = db
    .prepare(`SELECT COUNT(*) AS c FROM blog_articles WHERE ${whereSql}`)
    .get(...bind) as { c: number };
  const rows = db
    .prepare(
      `SELECT * FROM blog_articles WHERE ${whereSql}
       ORDER BY COALESCE(published_at, created_at) DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...bind, limit, offset) as BlogArticleRow[];

  return {
    total: Number(totalRow?.c) || 0,
    items: rows.map(rowToBlogArticleDto),
  };
}

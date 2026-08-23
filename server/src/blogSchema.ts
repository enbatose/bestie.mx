import type { DatabaseSync } from "node:sqlite";

/** Live city codes supported for city-specific blog URLs/labels/CTAs. */
export const BLOG_LIVE_CITY_CODES = ["gdl"] as const;
export type BlogLiveCityCode = (typeof BLOG_LIVE_CITY_CODES)[number];

export type BlogArticleStatus = "draft" | "published" | "paused";

export function isBlogLiveCityCode(raw: string | null | undefined): raw is BlogLiveCityCode {
  return raw === "gdl";
}

export function normalizeBlogStatus(raw: string | null | undefined): BlogArticleStatus {
  if (raw === "published" || raw === "paused" || raw === "draft") return raw;
  // Legacy blog rows used "archived" for off-public; treat as paused.
  if (raw === "archived") return "paused";
  return "draft";
}

export function ensureBlogSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS blog_articles (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      excerpt TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      city_code TEXT,
      labels_json TEXT NOT NULL DEFAULT '[]',
      cover_image_url TEXT,
      cover_image_credit TEXT,
      cover_image_source TEXT,
      blocks_json TEXT NOT NULL DEFAULT '[]',
      sources_json TEXT NOT NULL DEFAULT '[]',
      quality_score INTEGER,
      quality_suggestions_json TEXT NOT NULL DEFAULT '[]',
      quality_strengths_json TEXT NOT NULL DEFAULT '[]',
      similarity_warnings_json TEXT NOT NULL DEFAULT '[]',
      view_count INTEGER NOT NULL DEFAULT 0,
      meta_title TEXT,
      meta_description TEXT,
      aeo_summary TEXT,
      faq_json TEXT NOT NULL DEFAULT '[]',
      social_caption TEXT,
      published_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_articles_slug ON blog_articles(slug);
    CREATE INDEX IF NOT EXISTS idx_blog_articles_status_published
      ON blog_articles(status, published_at);
    CREATE INDEX IF NOT EXISTS idx_blog_articles_city ON blog_articles(city_code);

    CREATE TABLE IF NOT EXISTS blog_comments (
      id TEXT PRIMARY KEY,
      article_id TEXT NOT NULL,
      parent_id TEXT,
      user_id TEXT NOT NULL,
      body TEXT NOT NULL,
      hidden_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (article_id) REFERENCES blog_articles(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_blog_comments_article_created
      ON blog_comments(article_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_blog_comments_parent ON blog_comments(parent_id);

    CREATE TABLE IF NOT EXISTS blog_ai_costs (
      id TEXT PRIMARY KEY,
      article_id TEXT NOT NULL,
      activity TEXT NOT NULL,
      model TEXT,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      image_count INTEGER NOT NULL DEFAULT 0,
      usd_estimate REAL NOT NULL DEFAULT 0,
      mxn_estimate REAL NOT NULL DEFAULT 0,
      meta_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (article_id) REFERENCES blog_articles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_blog_ai_costs_article ON blog_ai_costs(article_id, created_at);
  `);

  if (!tableHasColumn(db, "blog_articles", "quality_strengths_json")) {
    db.exec(`ALTER TABLE blog_articles ADD COLUMN quality_strengths_json TEXT NOT NULL DEFAULT '[]'`);
  }

  db.exec(`UPDATE blog_articles SET status = 'paused' WHERE status = 'archived'`);
}

function tableHasColumn(db: DatabaseSync, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

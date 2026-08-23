import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import express from "express";
import { isAdminUser } from "./adminAuth.js";
import {
  getBlogArticleById,
  getBlogArticleBySlug,
  listPublishedBlogArticles,
  rowToBlogArticleDto,
} from "./blogDto.js";
import { BLOG_SOCIAL } from "./blogPaths.js";
import { isBlogLiveCityCode } from "./blogSchema.js";
import { readAuthUserId } from "./jwtSession.js";
import {
  BLOG_BOT_USER_ID,
  ensureBlogBotParticipant,
  createBlogCommentReportConversation,
} from "./blogReports.js";
import { createSlidingWindowLimiter } from "./rateLimit.js";
import { clampStr } from "./validation.js";

const viewLimiter = createSlidingWindowLimiter({ windowMs: 60_000, max: 60 });
const commentLimiter = createSlidingWindowLimiter({ windowMs: 60_000, max: 20 });
const reportLimiter = createSlidingWindowLimiter({ windowMs: 60_000, max: 10 });

function isoNow() {
  return new Date().toISOString();
}

function clampBody(raw: unknown, max: number): string {
  return clampStr(String(raw ?? ""), max);
}

export function blogPublicRouter(db: DatabaseSync) {
  const r = express.Router();
  r.use(express.json({ limit: "256kb" }));

  r.get("/meta", (_req, res) => {
    res.json({
      cities: [{ code: "gdl", label: "Guadalajara" }],
      social: BLOG_SOCIAL,
    });
  });

  r.get("/articles", (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const cityRaw = typeof req.query.city === "string" ? req.query.city.trim().toLowerCase() : "";
    const label = typeof req.query.label === "string" ? req.query.label : "";
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;
    if (cityRaw && cityRaw !== "national" && cityRaw !== "gdl") {
      res.status(400).json({ error: "unsupported_city" });
      return;
    }
    const result = listPublishedBlogArticles(db, {
      q,
      city: cityRaw || null,
      label,
      limit,
      offset,
    });
    res.json({
      total: result.total,
      items: result.items.map((a) => ({
        id: a.id,
        title: a.title,
        excerpt: a.excerpt,
        slug: a.slug,
        cityCode: a.cityCode,
        cityLabel: a.cityLabel,
        labels: a.labels,
        coverImageUrl: a.coverImageUrl,
        viewCount: a.viewCount,
        publishedAt: a.publishedAt,
        path: a.path,
      })),
    });
  });

  r.get("/articles/by-path", (req, res) => {
    const slug = typeof req.query.slug === "string" ? req.query.slug.trim() : "";
    const cityRaw = typeof req.query.city === "string" ? req.query.city.trim().toLowerCase() : "";
    const cityCode = isBlogLiveCityCode(cityRaw) ? cityRaw : null;
    if (!slug) {
      res.status(400).json({ error: "slug_required" });
      return;
    }
    const row = getBlogArticleBySlug(db, { slug, cityCode, publishedOnly: true });
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ article: rowToBlogArticleDto(row), social: BLOG_SOCIAL });
  });

  r.post("/articles/:id/view", (req, res) => {
    if (!viewLimiter(req.ip ?? "ip").ok) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }
    const id = String(req.params.id || "");
    const row = getBlogArticleById(db, id);
    if (!row || row.status !== "published") {
      res.status(404).json({ error: "not_found" });
      return;
    }
    db.prepare(`UPDATE blog_articles SET view_count = view_count + 1 WHERE id = ?`).run(id);
    const updated = getBlogArticleById(db, id)!;
    res.json({ viewCount: updated.view_count });
  });

  r.get("/articles/:id/comments", (req, res) => {
    const id = String(req.params.id || "");
    const row = getBlogArticleById(db, id);
    if (!row || row.status !== "published") {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const uid = readAuthUserId(req);
    const isAdmin = uid ? isAdminUser(db, uid) : false;
    const comments = listBlogComments(db, id, { includeHidden: isAdmin, viewerId: uid });
    res.json({ comments });
  });

  r.post("/articles/:id/comments", (req, res) => {
    if (!commentLimiter(req.ip ?? "ip").ok) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }
    const uid = readAuthUserId(req);
    if (!uid) {
      res.status(401).json({ error: "auth_required" });
      return;
    }
    const id = String(req.params.id || "");
    const row = getBlogArticleById(db, id);
    if (!row || row.status !== "published") {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const body = clampBody(req.body?.body, 2000);
    if (!body) {
      res.status(400).json({ error: "body_required" });
      return;
    }
    const parentId =
      typeof req.body?.parentId === "string" && req.body.parentId.trim()
        ? req.body.parentId.trim()
        : null;
    if (parentId) {
      const parent = db
        .prepare(`SELECT id, article_id, hidden_at FROM blog_comments WHERE id = ?`)
        .get(parentId) as { id: string; article_id: string; hidden_at: string | null } | undefined;
      if (!parent || parent.article_id !== id || parent.hidden_at) {
        res.status(400).json({ error: "invalid_parent" });
        return;
      }
    }
    const commentId = randomUUID();
    const now = isoNow();
    db.prepare(
      `INSERT INTO blog_comments (id, article_id, parent_id, user_id, body, hidden_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
    ).run(commentId, id, parentId, uid, body, now, now);
    const comments = listBlogComments(db, id, { includeHidden: false, viewerId: uid });
    res.status(201).json({ id: commentId, comments });
  });

  r.patch("/comments/:commentId", (req, res) => {
    const uid = readAuthUserId(req);
    if (!uid) {
      res.status(401).json({ error: "auth_required" });
      return;
    }
    const commentId = String(req.params.commentId || "");
    const comment = db.prepare(`SELECT * FROM blog_comments WHERE id = ?`).get(commentId) as
      | {
          id: string;
          article_id: string;
          user_id: string;
          body: string;
          hidden_at: string | null;
        }
      | undefined;
    if (!comment) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const isAdmin = isAdminUser(db, uid);
    const isOwner = comment.user_id === uid;
    if (!isAdmin && !isOwner) {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    const body =
      req.body?.body != null ? clampBody(req.body.body, 2000) : undefined;
    const hide = req.body?.hidden === true;
    const unhide = req.body?.hidden === false;

    if (body != null) {
      if (!isAdmin && !isOwner) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
      db.prepare(`UPDATE blog_comments SET body = ?, updated_at = ? WHERE id = ?`).run(body, isoNow(), commentId);
    }
    if (hide) {
      if (!isAdmin) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
      db.prepare(`UPDATE blog_comments SET hidden_at = ?, updated_at = ? WHERE id = ?`).run(
        isoNow(),
        isoNow(),
        commentId,
      );
    }
    if (unhide) {
      if (!isAdmin) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
      db.prepare(`UPDATE blog_comments SET hidden_at = NULL, updated_at = ? WHERE id = ?`).run(
        isoNow(),
        commentId,
      );
    }

    res.json({
      comments: listBlogComments(db, comment.article_id, {
        includeHidden: isAdmin,
        viewerId: uid,
      }),
    });
  });

  r.delete("/comments/:commentId", (req, res) => {
    const uid = readAuthUserId(req);
    if (!uid) {
      res.status(401).json({ error: "auth_required" });
      return;
    }
    const commentId = String(req.params.commentId || "");
    const comment = db.prepare(`SELECT * FROM blog_comments WHERE id = ?`).get(commentId) as
      | { id: string; article_id: string; user_id: string }
      | undefined;
    if (!comment) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const isAdmin = isAdminUser(db, uid);
    if (!isAdmin && comment.user_id !== uid) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    db.prepare(`DELETE FROM blog_comments WHERE id = ? OR parent_id = ?`).run(commentId, commentId);
    res.json({
      ok: true,
      comments: listBlogComments(db, comment.article_id, {
        includeHidden: isAdmin,
        viewerId: uid,
      }),
    });
  });

  r.post("/comments/:commentId/report", (req, res) => {
    if (!reportLimiter(req.ip ?? "ip").ok) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }
    const uid = readAuthUserId(req);
    const commentId = String(req.params.commentId || "");
    const comment = db
      .prepare(
        `SELECT c.*, u.display_name, u.email, a.title AS article_title, a.slug, a.city_code
         FROM blog_comments c
         JOIN users u ON u.id = c.user_id
         JOIN blog_articles a ON a.id = c.article_id
         WHERE c.id = ?`,
      )
      .get(commentId) as
      | {
          id: string;
          article_id: string;
          user_id: string;
          body: string;
          display_name: string | null;
          email: string | null;
          article_title: string;
          slug: string;
          city_code: string | null;
        }
      | undefined;
    if (!comment) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const reason = clampBody(req.body?.reason ?? "Comentario reportado", 500) || "Comentario reportado";
    const conversationId = createBlogCommentReportConversation(db, {
      reporterUserId: uid,
      comment,
      reason,
    });
    res.status(201).json({ ok: true, conversationId });
  });

  // silence unused import in case tree-shaking
  void BLOG_BOT_USER_ID;
  void ensureBlogBotParticipant;

  return r;
}

export type BlogCommentDto = {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  hidden: boolean;
  author: { id: string; displayName: string; avatarUrl: string | null };
  replies: BlogCommentDto[];
  canEdit: boolean;
  canDelete: boolean;
  canModerate: boolean;
};

function listBlogComments(
  db: DatabaseSync,
  articleId: string,
  opts: { includeHidden: boolean; viewerId: string | null },
): BlogCommentDto[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.parent_id, c.user_id, c.body, c.hidden_at, c.created_at, c.updated_at,
              u.display_name, u.profile_picture_url
       FROM blog_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.article_id = ?
       ORDER BY c.created_at ASC`,
    )
    .all(articleId) as Array<{
    id: string;
    parent_id: string | null;
    user_id: string;
    body: string;
    hidden_at: string | null;
    created_at: string;
    updated_at: string;
    display_name: string | null;
    profile_picture_url: string | null;
  }>;

  const isAdmin = opts.viewerId ? isAdminUser(db, opts.viewerId) : false;
  const map = new Map<string, BlogCommentDto>();
  const roots: BlogCommentDto[] = [];

  for (const row of rows) {
    if (row.hidden_at && !opts.includeHidden) continue;
    const dto: BlogCommentDto = {
      id: row.id,
      parentId: row.parent_id,
      body: row.body,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      hidden: Boolean(row.hidden_at),
      author: {
        id: row.user_id,
        displayName: row.display_name?.trim() || "Usuario",
        avatarUrl: row.profile_picture_url,
      },
      replies: [],
      canEdit: Boolean(opts.viewerId && (isAdmin || opts.viewerId === row.user_id)),
      canDelete: Boolean(opts.viewerId && (isAdmin || opts.viewerId === row.user_id)),
      canModerate: isAdmin,
    };
    map.set(row.id, dto);
  }

  for (const dto of map.values()) {
    if (dto.parentId && map.has(dto.parentId)) {
      map.get(dto.parentId)!.replies.push(dto);
    } else if (!dto.parentId) {
      roots.push(dto);
    } else {
      roots.push(dto);
    }
  }
  return roots;
}

import type { DatabaseSync } from "node:sqlite";
import type { BlogArticleDto, BlogArticleRow } from "./blogDto.js";
import { parseJsonArray, type BlogBlock, type BlogFaqItem, type BlogSource } from "./blogTypes.js";

/** Cap turns kept per article (user + assistant pairs accumulate quickly). */
export const BLOG_CHAT_HISTORY_MAX_TURNS = 40;
/** Cap full article snapshots for restore-by-iteration. */
export const BLOG_CHAT_REVISIONS_MAX = 12;

export type BlogChatRole = "user" | "assistant" | "system";

export type BlogChatTurn = {
  role: BlogChatRole;
  text: string;
  createdAt: string;
  /** Revision number that existed after this turn (assistant turns). */
  revisionAfter?: number;
};

/** Fields needed to restore a prior article body (not cover images / status). */
export type BlogChatRevisionSnapshot = {
  revision: number;
  createdAt: string;
  title: string;
  slug: string;
  excerpt: string;
  cityCode: string | null;
  labels: string[];
  blocks: BlogBlock[];
  sources: BlogSource[];
  faq: BlogFaqItem[];
  metaTitle: string | null;
  metaDescription: string | null;
  aeoSummary: string | null;
  socialCaption: string | null;
};

export type BlogChatMemory = {
  history: BlogChatTurn[];
  revisions: BlogChatRevisionSnapshot[];
};

type ArticleRowWithChat = BlogArticleRow & {
  chat_history_json?: string | null;
  chat_revisions_json?: string | null;
};

export function snapshotFromDto(dto: BlogArticleDto, revision: number, createdAt: string): BlogChatRevisionSnapshot {
  return {
    revision,
    createdAt,
    title: dto.title,
    slug: dto.slug,
    excerpt: dto.excerpt,
    cityCode: dto.cityCode,
    labels: [...dto.labels],
    blocks: dto.blocks,
    sources: dto.sources,
    faq: dto.faq,
    metaTitle: dto.metaTitle,
    metaDescription: dto.metaDescription,
    aeoSummary: dto.aeoSummary,
    socialCaption: dto.socialCaption,
  };
}

export function loadBlogChatMemory(row: BlogArticleRow): BlogChatMemory {
  const r = row as ArticleRowWithChat;
  const history = parseJsonArray<BlogChatTurn>(r.chat_history_json ?? "[]").filter(
    (t) => t && (t.role === "user" || t.role === "assistant" || t.role === "system") && typeof t.text === "string",
  );
  const revisions = parseJsonArray<BlogChatRevisionSnapshot>(r.chat_revisions_json ?? "[]").filter(
    (s) => s && Number.isFinite(s.revision) && typeof s.title === "string",
  );
  return { history, revisions };
}

export function saveBlogChatMemory(db: DatabaseSync, articleId: string, memory: BlogChatMemory): void {
  const history = memory.history.slice(-BLOG_CHAT_HISTORY_MAX_TURNS);
  const revisions = memory.revisions.slice(-BLOG_CHAT_REVISIONS_MAX);
  db.prepare(
    `UPDATE blog_articles SET chat_history_json = ?, chat_revisions_json = ?, updated_at = ? WHERE id = ?`,
  ).run(JSON.stringify(history), JSON.stringify(revisions), new Date().toISOString(), articleId);
}

export function clearBlogChatMemory(db: DatabaseSync, articleId: string): void {
  saveBlogChatMemory(db, articleId, { history: [], revisions: [] });
}

export function ensureBaselineRevision(
  memory: BlogChatMemory,
  dto: BlogArticleDto,
  now: string,
): BlogChatMemory {
  if (memory.revisions.length > 0) return memory;
  return {
    ...memory,
    revisions: [snapshotFromDto(dto, 1, now)],
  };
}

export function nextRevisionNumber(revisions: BlogChatRevisionSnapshot[]): number {
  if (!revisions.length) return 1;
  return Math.max(...revisions.map((r) => r.revision)) + 1;
}

export function revisionIndexForPrompt(revisions: BlogChatRevisionSnapshot[]): string {
  if (!revisions.length) return "(sin revisiones aún)";
  return revisions
    .map((r) => {
      const blocks = Array.isArray(r.blocks) ? r.blocks.length : 0;
      const excerpt = String(r.excerpt || "").replace(/\s+/g, " ").trim().slice(0, 120);
      return `- Revisión ${r.revision}: título «${r.title}» · ${blocks} bloques · ${excerpt || "(sin extracto)"}`;
    })
    .join("\n");
}

export function chatTranscriptForPrompt(history: BlogChatTurn[]): string {
  if (!history.length) return "(sin mensajes previos en esta sesión de instrucciones)";
  return history
    .map((t, i) => {
      const who = t.role === "user" ? "Editor" : t.role === "assistant" ? "Asistente" : "Sistema";
      const rev = t.revisionAfter != null ? ` [quedó como revisión ${t.revisionAfter}]` : "";
      return `${i + 1}. ${who}${rev}:\n${t.text.trim()}`;
    })
    .join("\n\n");
}

/**
 * Apply field-level restore from saved revisions, then optional patch overrides.
 * Keys of restoreFrom map article field → revision number.
 */
export function applyRestoreFrom(
  current: BlogArticleDto,
  revisions: BlogChatRevisionSnapshot[],
  restoreFrom: Record<string, unknown> | null | undefined,
): Partial<{
  title: string;
  slug: string;
  excerpt: string;
  cityCode: string | null;
  labels: string[];
  blocks: BlogBlock[];
  sources: BlogSource[];
  faq: BlogFaqItem[];
  metaTitle: string;
  metaDescription: string;
  aeoSummary: string;
  socialCaption: string;
}> {
  if (!restoreFrom || typeof restoreFrom !== "object") return {};
  const byRev = new Map(revisions.map((r) => [r.revision, r]));
  const out: Record<string, unknown> = {};

  const fieldMap: Array<{ key: string; snapKey: keyof BlogChatRevisionSnapshot }> = [
    { key: "title", snapKey: "title" },
    { key: "slug", snapKey: "slug" },
    { key: "excerpt", snapKey: "excerpt" },
    { key: "cityCode", snapKey: "cityCode" },
    { key: "labels", snapKey: "labels" },
    { key: "blocks", snapKey: "blocks" },
    { key: "sources", snapKey: "sources" },
    { key: "faq", snapKey: "faq" },
    { key: "metaTitle", snapKey: "metaTitle" },
    { key: "metaDescription", snapKey: "metaDescription" },
    { key: "aeoSummary", snapKey: "aeoSummary" },
    { key: "socialCaption", snapKey: "socialCaption" },
  ];

  for (const { key, snapKey } of fieldMap) {
    const revRaw = restoreFrom[key];
    const rev = typeof revRaw === "number" ? revRaw : Number(revRaw);
    if (!Number.isFinite(rev)) continue;
    const snap = byRev.get(Math.floor(rev));
    if (!snap) continue;
    const value = snap[snapKey];
    if (value === undefined) continue;
    out[key] = value;
  }

  // Convenience: restoreFrom.all = N restores every content field from that revision.
  const allRaw = restoreFrom.all;
  const allRev = typeof allRaw === "number" ? allRaw : Number(allRaw);
  if (Number.isFinite(allRev)) {
    const snap = byRev.get(Math.floor(allRev));
    if (snap) {
      for (const { key, snapKey } of fieldMap) {
        if (out[key] !== undefined) continue;
        out[key] = snap[snapKey];
      }
    }
  }

  void current;
  return out as ReturnType<typeof applyRestoreFrom>;
}

/** Compact revision payloads for the model (full content, capped count). */
export function revisionsPayloadForPrompt(revisions: BlogChatRevisionSnapshot[]): BlogChatRevisionSnapshot[] {
  return revisions.slice(-BLOG_CHAT_REVISIONS_MAX);
}

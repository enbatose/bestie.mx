import { apiBase } from "@/lib/apiBase";

const cred: RequestCredentials = "include";

export type BlogBlock = {
  id: string;
  type: "heading" | "paragraph" | "image" | "quote" | "list" | "cta" | "faq";
  level?: 2 | 3;
  text?: string;
  items?: string[];
  imageUrl?: string;
  imageAlt?: string;
  imageCredit?: string;
  imageSource?: string;
  href?: string;
  label?: string;
  question?: string;
  answer?: string;
};

export type BlogSource = {
  id: number;
  title: string;
  url: string;
  publisher?: string;
  accessedAt?: string;
};

export type BlogArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  status: "draft" | "published" | "paused";
  cityCode: string | null;
  cityLabel: string | null;
  labels: string[];
  coverImageUrl: string | null;
  coverImageCredit: string | null;
  coverImageSource: string | null;
  blocks: BlogBlock[];
  sources: BlogSource[];
  qualityScore: number | null;
  qualitySuggestions: Array<{ id: string; title: string; detail: string }>;
  qualityStrengths: Array<{ id: string; title: string; detail: string }>;
  similarityWarnings: Array<{ articleId: string; title: string; path: string; score: number }>;
  viewCount: number;
  metaTitle: string | null;
  metaDescription: string | null;
  aeoSummary: string | null;
  faq: Array<{ question: string; answer: string }>;
  socialCaption: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  path: string;
  ctaPath: string;
};

export type BlogComment = {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  hidden: boolean;
  author: { id: string; displayName: string; avatarUrl: string | null };
  replies: BlogComment[];
  canEdit: boolean;
  canDelete: boolean;
  canModerate: boolean;
};

export type BlogCosts = {
  totalUsd: number;
  totalMxn: number;
  entries: Array<{
    id: string;
    activity: string;
    model: string | null;
    promptTokens: number;
    outputTokens: number;
    imageCount: number;
    usdEstimate: number;
    mxnEstimate: number;
    createdAt: string;
  }>;
};

export async function fetchBlogIndex(opts: {
  q?: string;
  city?: string;
  /** With city set: include national articles too (exclude other cities). */
  includeNational?: boolean;
  label?: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<{ total: number; items: Array<Pick<BlogArticle, "id" | "title" | "excerpt" | "slug" | "cityCode" | "cityLabel" | "labels" | "coverImageUrl" | "viewCount" | "publishedAt" | "path">> }> {
  const params = new URLSearchParams();
  if (opts.q?.trim()) params.set("q", opts.q.trim());
  if (opts.city) params.set("city", opts.city);
  if (opts.includeNational) params.set("includeNational", "1");
  if (opts.label?.trim()) params.set("label", opts.label.trim());
  if (opts.limit != null) params.set("limit", String(opts.limit));
  const res = await fetch(`${apiBase()}/api/blog/articles?${params}`, {
    credentials: cred,
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`blog_index_${res.status}`);
  return (await res.json()) as Awaited<ReturnType<typeof fetchBlogIndex>>;
}

export async function fetchBlogArticleByPath(opts: {
  slug: string;
  city?: string | null;
  signal?: AbortSignal;
}): Promise<{ article: BlogArticle; social: { facebook: string; instagram: string } }> {
  const params = new URLSearchParams({ slug: opts.slug });
  if (opts.city) params.set("city", opts.city);
  const res = await fetch(`${apiBase()}/api/blog/articles/by-path?${params}`, {
    credentials: cred,
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`blog_article_${res.status}`);
  return (await res.json()) as Awaited<ReturnType<typeof fetchBlogArticleByPath>>;
}

export async function recordBlogView(articleId: string): Promise<number> {
  const res = await fetch(`${apiBase()}/api/blog/articles/${encodeURIComponent(articleId)}/view`, {
    method: "POST",
    credentials: cred,
  });
  if (!res.ok) return 0;
  const json = (await res.json()) as { viewCount?: number };
  return Number(json.viewCount) || 0;
}

export async function fetchBlogComments(articleId: string, signal?: AbortSignal): Promise<BlogComment[]> {
  const res = await fetch(
    `${apiBase()}/api/blog/articles/${encodeURIComponent(articleId)}/comments`,
    { credentials: cred, signal },
  );
  if (!res.ok) throw new Error(`blog_comments_${res.status}`);
  const json = (await res.json()) as { comments: BlogComment[] };
  return json.comments;
}

export async function postBlogComment(
  articleId: string,
  input: { body: string; parentId?: string | null },
): Promise<{ id: string; comments: BlogComment[] }> {
  const res = await fetch(
    `${apiBase()}/api/blog/articles/${encodeURIComponent(articleId)}/comments`,
    {
      method: "POST",
      credentials: cred,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (res.status === 401) throw new Error("auth_required");
  if (!res.ok) throw new Error(`blog_comment_${res.status}`);
  return (await res.json()) as { id: string; comments: BlogComment[] };
}

export async function patchBlogComment(
  commentId: string,
  input: { body?: string; hidden?: boolean },
): Promise<BlogComment[]> {
  const res = await fetch(`${apiBase()}/api/blog/comments/${encodeURIComponent(commentId)}`, {
    method: "PATCH",
    credentials: cred,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`blog_comment_patch_${res.status}`);
  const json = (await res.json()) as { comments: BlogComment[] };
  return json.comments;
}

export async function deleteBlogComment(commentId: string): Promise<BlogComment[]> {
  const res = await fetch(`${apiBase()}/api/blog/comments/${encodeURIComponent(commentId)}`, {
    method: "DELETE",
    credentials: cred,
  });
  if (!res.ok) throw new Error(`blog_comment_delete_${res.status}`);
  const json = (await res.json()) as { comments: BlogComment[] };
  return json.comments;
}

export async function reportBlogComment(commentId: string, reason: string): Promise<void> {
  const res = await fetch(
    `${apiBase()}/api/blog/comments/${encodeURIComponent(commentId)}/report`,
    {
      method: "POST",
      credentials: cred,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    },
  );
  if (!res.ok) throw new Error(`blog_report_${res.status}`);
}

/** Admin */
export async function adminListBlogArticles(q?: string, signal?: AbortSignal): Promise<BlogArticle[]> {
  const params = new URLSearchParams();
  if (q?.trim()) params.set("q", q.trim());
  const res = await fetch(`${apiBase()}/api/admin/blog/articles?${params}`, {
    credentials: cred,
    signal,
  });
  if (!res.ok) throw new Error(`admin_blog_list_${res.status}`);
  const json = (await res.json()) as { items: BlogArticle[] };
  return json.items;
}

export async function adminGetBlogArticle(
  id: string,
  signal?: AbortSignal,
): Promise<{ article: BlogArticle; costs: BlogCosts }> {
  const res = await fetch(`${apiBase()}/api/admin/blog/articles/${encodeURIComponent(id)}`, {
    credentials: cred,
    signal,
  });
  if (!res.ok) throw new Error(`admin_blog_get_${res.status}`);
  return (await res.json()) as { article: BlogArticle; costs: BlogCosts };
}

export async function adminCreateBlogArticle(input?: {
  title?: string;
  cityCode?: string | null;
}): Promise<BlogArticle> {
  const res = await fetch(`${apiBase()}/api/admin/blog/articles`, {
    method: "POST",
    credentials: cred,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input ?? {}),
  });
  if (!res.ok) throw new Error(`admin_blog_create_${res.status}`);
  const json = (await res.json()) as { article: BlogArticle };
  return json.article;
}

export async function adminDeleteBlogArticle(id: string): Promise<void> {
  const res = await fetch(`${apiBase()}/api/admin/blog/articles/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: cred,
  });
  if (!res.ok) throw new Error(`admin_blog_delete_${res.status}`);
}

export async function adminSaveBlogArticle(
  id: string,
  article: Partial<BlogArticle>,
): Promise<{ article: BlogArticle; costs: BlogCosts }> {
  const res = await fetch(`${apiBase()}/api/admin/blog/articles/${encodeURIComponent(id)}`, {
    method: "PUT",
    credentials: cred,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(article),
  });
  if (!res.ok) throw new Error(`admin_blog_save_${res.status}`);
  return (await res.json()) as { article: BlogArticle; costs: BlogCosts };
}

export async function adminGenerateBlogArticle(
  id: string,
  input: { idea: string; cityCode?: string | null },
): Promise<{ article: BlogArticle; costs: BlogCosts }> {
  const res = await fetch(
    `${apiBase()}/api/admin/blog/articles/${encodeURIComponent(id)}/generate`,
    {
      method: "POST",
      credentials: cred,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) throw new Error(`admin_blog_generate_${res.status}`);
  return (await res.json()) as { article: BlogArticle; costs: BlogCosts };
}

export async function adminRescoreBlogArticle(
  id: string,
): Promise<{ article: BlogArticle; costs: BlogCosts }> {
  const res = await fetch(
    `${apiBase()}/api/admin/blog/articles/${encodeURIComponent(id)}/rescore`,
    { method: "POST", credentials: cred },
  );
  if (!res.ok) throw new Error(`admin_blog_rescore_${res.status}`);
  return (await res.json()) as { article: BlogArticle; costs: BlogCosts };
}

export async function adminEnhanceBlogArticle(
  id: string,
  suggestionIds: string[],
): Promise<{ article: BlogArticle; costs: BlogCosts }> {
  const res = await fetch(
    `${apiBase()}/api/admin/blog/articles/${encodeURIComponent(id)}/enhance`,
    {
      method: "POST",
      credentials: cred,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suggestionIds }),
    },
  );
  if (!res.ok) throw new Error(`admin_blog_enhance_${res.status}`);
  return (await res.json()) as { article: BlogArticle; costs: BlogCosts };
}

export async function adminChatBlogArticle(
  id: string,
  message: string,
): Promise<{ article: BlogArticle; costs: BlogCosts; reply: string; actions: string[] }> {
  const res = await fetch(
    `${apiBase()}/api/admin/blog/articles/${encodeURIComponent(id)}/chat`,
    {
      method: "POST",
      credentials: cred,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    },
  );
  if (!res.ok) throw new Error(`admin_blog_chat_${res.status}`);
  return (await res.json()) as Awaited<ReturnType<typeof adminChatBlogArticle>>;
}

export async function adminProposeBlogTopics(cityCode?: string | null): Promise<{
  topics: Array<{
    title: string;
    angle: string;
    whyNow: string;
    cityCode: string | null;
    promoteArticleId?: string;
    promotePath?: string;
    socialCaption?: string;
  }>;
}> {
  const res = await fetch(`${apiBase()}/api/admin/blog/topics`, {
    method: "POST",
    credentials: cred,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cityCode: cityCode ?? null }),
  });
  if (!res.ok) throw new Error(`admin_blog_topics_${res.status}`);
  return (await res.json()) as Awaited<ReturnType<typeof adminProposeBlogTopics>>;
}

export async function adminMetaPublishBlog(
  id: string,
  platform: "facebook" | "instagram",
): Promise<Record<string, unknown>> {
  const res = await fetch(
    `${apiBase()}/api/admin/blog/articles/${encodeURIComponent(id)}/meta-publish`,
    {
      method: "POST",
      credentials: cred,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform }),
    },
  );
  return (await res.json()) as Record<string, unknown>;
}

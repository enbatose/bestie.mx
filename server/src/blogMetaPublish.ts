import { blogArticlePublicPath, normalizeSocialCaption } from "./blogPaths.js";
import type { BlogArticleDto } from "./blogDto.js";

/**
 * Publish article link to Facebook Page / Instagram via Graph API when tokens exist.
 * Until Meta verification/tokens are configured, returns a clear setup payload.
 */
export async function tryPublishBlogToMeta(opts: {
  article: BlogArticleDto;
  platform: "facebook" | "instagram";
}): Promise<
  | { ok: true; platform: string; postId: string }
  | {
      ok: false;
      error: string;
      setup?: {
        requiredEnv: string[];
        hint: string;
        draftCaption: string;
        shareUrl: string;
      };
    }
> {
  const origin = (process.env.PUBLIC_WEB_ORIGIN || "https://www.bestie.mx").replace(/\/+$/, "");
  const shareUrl = `${origin}${opts.article.path || blogArticlePublicPath(opts.article)}`;
  const caption = normalizeSocialCaption(opts.article.socialCaption || opts.article.title, {
    articleUrl: shareUrl,
  });

  const pageToken = process.env.META_PAGE_ACCESS_TOKEN?.trim();
  const pageId = process.env.META_PAGE_ID?.trim();
  const igUserId = process.env.META_IG_BUSINESS_ACCOUNT_ID?.trim();

  if (opts.platform === "facebook") {
    if (!pageToken || !pageId) {
      return {
        ok: false,
        error: "meta_not_configured",
        setup: {
          requiredEnv: ["META_PAGE_ACCESS_TOKEN", "META_PAGE_ID"],
          hint: "Conecta la Página de Bestie en Meta Business y pega el Page access token + Page ID en Dev. Luego podrás publicar desde admin.",
          draftCaption: caption,
          shareUrl,
        },
      };
    }
    try {
      const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/feed`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: caption,
          link: shareUrl,
          access_token: pageToken,
        }),
      });
      const json = (await res.json()) as { id?: string; error?: { message?: string } };
      if (!res.ok || !json.id) {
        return { ok: false, error: json.error?.message || `http_${res.status}` };
      }
      return { ok: true, platform: "facebook", postId: json.id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "meta_error" };
    }
  }

  // Instagram: link posts are limited; we create a media container from cover when possible.
  if (!pageToken || !igUserId) {
    return {
      ok: false,
      error: "meta_not_configured",
      setup: {
        requiredEnv: ["META_PAGE_ACCESS_TOKEN", "META_IG_BUSINESS_ACCOUNT_ID"],
        hint: "Instagram Content Publishing API requiere cuenta Business vinculada a la Página. Mientras tanto descarga el creativo 1080×1080 desde el admin y publica manualmente.",
        draftCaption: caption,
        shareUrl,
      },
    };
  }

  const imageUrl = opts.article.coverImageUrl?.startsWith("http")
    ? opts.article.coverImageUrl
    : opts.article.coverImageUrl
      ? `${origin}${opts.article.coverImageUrl}`
      : null;
  if (!imageUrl) {
    return { ok: false, error: "cover_required_for_instagram" };
  }

  try {
    const createUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(igUserId)}/media`;
    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl.startsWith("https://") ? imageUrl : undefined,
        caption,
        access_token: pageToken,
      }),
    });
    const createJson = (await createRes.json()) as { id?: string; error?: { message?: string } };
    if (!createRes.ok || !createJson.id) {
      return { ok: false, error: createJson.error?.message || `http_${createRes.status}` };
    }
    const publishRes = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(igUserId)}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: createJson.id, access_token: pageToken }),
      },
    );
    const publishJson = (await publishRes.json()) as { id?: string; error?: { message?: string } };
    if (!publishRes.ok || !publishJson.id) {
      return { ok: false, error: publishJson.error?.message || `http_${publishRes.status}` };
    }
    return { ok: true, platform: "instagram", postId: publishJson.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "meta_error" };
  }
}

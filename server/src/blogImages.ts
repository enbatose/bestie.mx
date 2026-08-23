import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { geminiApiKey } from "./shareAiCopyGemini.js";
import { recordBlogAiCost } from "./blogCosts.js";

export type BlogImagePick = {
  url: string;
  credit: string;
  source: "wikimedia" | "unsplash" | "pexels" | "ai" | "upload";
  alt: string;
};

type CommonsSearchResponse = {
  query?: {
    search?: Array<{ title: string; pageid: number }>;
  };
};

type CommonsImageInfo = {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        imageinfo?: Array<{
          url?: string;
          descriptionurl?: string;
          extmetadata?: {
            Artist?: { value?: string };
            LicenseShortName?: { value?: string };
          };
        }>;
      }
    >;
  };
};

/** Search Wikimedia Commons for openly licensed images. */
export async function searchWikimediaImages(
  query: string,
  limit = 4,
): Promise<BlogImagePick[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const searchUrl =
      `https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6` +
      `&srsearch=${encodeURIComponent(q)}&srlimit=${Math.min(10, limit * 2)}&format=json&origin=*`;
    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": "BestieMXBlog/1.0 (contacto@bestie.mx)" },
    });
    if (!searchRes.ok) return [];
    const searchJson = (await searchRes.json()) as CommonsSearchResponse;
    const titles = (searchJson.query?.search ?? [])
      .map((s) => s.title)
      .filter((t) => /\.(jpe?g|png|webp)$/i.test(t))
      .slice(0, limit);
    if (!titles.length) return [];

    const infoUrl =
      `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles.join("|"))}` +
      `&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1600&format=json&origin=*`;
    const infoRes = await fetch(infoUrl, {
      headers: { "User-Agent": "BestieMXBlog/1.0 (contacto@bestie.mx)" },
    });
    if (!infoRes.ok) return [];
    const infoJson = (await infoRes.json()) as CommonsImageInfo;
    const out: BlogImagePick[] = [];
    for (const page of Object.values(infoJson.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      const url = info?.url?.trim();
      if (!url) continue;
      const artist = stripHtml(info?.extmetadata?.Artist?.value ?? "Wikimedia Commons");
      const license = info?.extmetadata?.LicenseShortName?.value ?? "open license";
      out.push({
        url,
        credit: `${artist} · ${license} · Wikimedia Commons`,
        source: "wikimedia",
        alt: (page.title ?? q).replace(/^File:/i, ""),
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

export async function searchUnsplashImages(query: string, limit = 3): Promise<BlogImagePick[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (!key) return [];
  try {
    const url =
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}` +
      `&per_page=${limit}&orientation=landscape`;
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      results?: Array<{
        alt_description?: string;
        urls?: { regular?: string };
        user?: { name?: string; links?: { html?: string } };
        links?: { html?: string };
      }>;
    };
    return (json.results ?? []).slice(0, limit).map((r) => ({
      url: r.urls?.regular ?? "",
      credit: `Foto: ${r.user?.name ?? "Unsplash"} · Unsplash`,
      source: "unsplash" as const,
      alt: r.alt_description || query,
    })).filter((x) => x.url);
  } catch {
    return [];
  }
}

export async function searchPexelsImages(query: string, limit = 3): Promise<BlogImagePick[]> {
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key) return [];
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${limit}&orientation=landscape`;
    const res = await fetch(url, { headers: { Authorization: key } });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      photos?: Array<{
        alt?: string;
        src?: { large?: string };
        photographer?: string;
        url?: string;
      }>;
    };
    return (json.photos ?? []).slice(0, limit).map((p) => ({
      url: p.src?.large ?? "",
      credit: `Foto: ${p.photographer ?? "Pexels"} · Pexels`,
      source: "pexels" as const,
      alt: p.alt || query,
    })).filter((x) => x.url);
  } catch {
    return [];
  }
}

/**
 * Try open-license stock first; fall back to Gemini/Imagen-style generation when none fit.
 * Generated images are stored into upload_blobs when uploadDir is provided.
 */
export async function resolveBlogImages(opts: {
  db: DatabaseSync;
  articleId: string;
  queries: string[];
  need: number;
  uploadDir?: string;
  preferAi?: boolean;
  themeHint?: string;
}): Promise<BlogImagePick[]> {
  const need = Math.max(1, Math.min(8, opts.need));
  const picks: BlogImagePick[] = [];

  if (!opts.preferAi) {
    for (const q of opts.queries) {
      if (picks.length >= need) break;
      const commons = await searchWikimediaImages(q, need - picks.length);
      picks.push(...commons);
    }
    for (const q of opts.queries) {
      if (picks.length >= need) break;
      const unsplash = await searchUnsplashImages(q, need - picks.length);
      picks.push(...unsplash);
    }
    for (const q of opts.queries) {
      if (picks.length >= need) break;
      const pexels = await searchPexelsImages(q, need - picks.length);
      picks.push(...pexels);
    }
  }

  if (picks.length >= need) return picks.slice(0, need);

  const remaining = need - picks.length;
  const generated = await generateAiBlogImages({
    db: opts.db,
    articleId: opts.articleId,
    count: remaining,
    themeHint: opts.themeHint || opts.queries[0] || "roommates Mexico",
    uploadDir: opts.uploadDir,
  });
  picks.push(...generated);
  return picks.slice(0, need);
}

async function generateAiBlogImages(opts: {
  db: DatabaseSync;
  articleId: string;
  count: number;
  themeHint: string;
  uploadDir?: string;
}): Promise<BlogImagePick[]> {
  const key = geminiApiKey();
  if (!key || !opts.uploadDir) return [];

  const model =
    process.env.BLOG_IMAGE_MODEL?.trim() || "gemini-2.5-flash-image";
  const out: BlogImagePick[] = [];

  for (let i = 0; i < opts.count; i++) {
    const prompt =
      `Create a brand-safe editorial illustration for Bestie.mx (roommate marketplace in Mexico). ` +
      `Theme: ${opts.themeHint}. Style: mix of warm flat illustration with subtle silhouette figures ` +
      `(two friendly people / high-five vibe), forest green #143D30 and lime accent, no text, no logos, ` +
      `no watermarks, suitable as a blog article image, 16:9.`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      });
      const json = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
        }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
        error?: { message?: string };
      };
      if (!res.ok) {
        console.warn("[blog-images] ai fail", json.error?.message);
        break;
      }
      const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      const b64 = part?.inlineData?.data;
      const mime = part?.inlineData?.mimeType || "image/png";
      if (!b64) continue;
      const ext = mime.includes("jpeg") || mime.includes("jpg") ? ".jpg" : ".png";
      const filename = `${randomUUID()}${ext}`;
      const bytes = Buffer.from(b64, "base64");
      fs.mkdirSync(opts.uploadDir, { recursive: true });
      fs.writeFileSync(path.join(opts.uploadDir, filename), bytes);
      opts.db
        .prepare(
          `INSERT OR REPLACE INTO upload_blobs (filename, mime_type, bytes, created_at) VALUES (?, ?, ?, ?)`,
        )
        .run(filename, mime, bytes, new Date().toISOString());

      recordBlogAiCost(opts.db, {
        id: randomUUID(),
        articleId: opts.articleId,
        activity: "images",
        model,
        promptTokens: Number(json.usageMetadata?.promptTokenCount) || 0,
        outputTokens: Number(json.usageMetadata?.candidatesTokenCount) || 0,
        imageCount: 1,
        meta: { themeHint: opts.themeHint },
      });

      out.push({
        url: `/api/uploads/${filename}`,
        credit: "Ilustración generada · Bestie",
        source: "ai",
        alt: opts.themeHint,
      });
    } catch (err) {
      console.warn("[blog-images] ai error", err instanceof Error ? err.message : err);
      break;
    }
  }
  return out;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

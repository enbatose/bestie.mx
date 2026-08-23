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

export type BlogImageSlot = {
  /** English search terms for stock APIs; must describe a concrete visual scene. */
  query: string;
  alt?: string;
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

const SKIP_TITLE_RE =
  /\b(map|mapa|logo|flag|bandera|svg|icon|diagrama|diagram|chart|grafica|screenshot|coat of arms|escudo)\b/i;

/** Search Wikimedia Commons for openly licensed photos (photos only; skip maps/diagrams). */
export async function searchWikimediaImages(
  query: string,
  limit = 4,
): Promise<BlogImagePick[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const searchUrl =
      `https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6` +
      `&srsearch=${encodeURIComponent(`${q} photograph`)}&srlimit=${Math.min(16, limit * 4)}&format=json&origin=*`;
    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": "BestieMXBlog/1.0 (contacto@bestie.mx)" },
    });
    if (!searchRes.ok) return [];
    const searchJson = (await searchRes.json()) as CommonsSearchResponse;
    const titles = (searchJson.query?.search ?? [])
      .map((s) => s.title)
      .filter((t) => /\.(jpe?g|png|webp)$/i.test(t) && !SKIP_TITLE_RE.test(t))
      .slice(0, limit * 2);
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
      const title = page.title ?? "";
      if (SKIP_TITLE_RE.test(title)) continue;
      const info = page.imageinfo?.[0];
      const url = info?.url?.trim();
      if (!url) continue;
      const artist = stripHtml(info?.extmetadata?.Artist?.value ?? "Wikimedia Commons");
      const license = info?.extmetadata?.LicenseShortName?.value ?? "open license";
      out.push({
        url,
        credit: `${artist} · ${license} · Wikimedia Commons`,
        source: "wikimedia",
        alt: title.replace(/^File:/i, ""),
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
      `&per_page=${Math.min(12, Math.max(limit, 6))}&orientation=landscape`;
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      results?: Array<{
        alt_description?: string;
        urls?: { regular?: string };
        user?: { name?: string };
      }>;
    };
    return (json.results ?? [])
      .slice(0, limit)
      .map((r) => ({
        url: r.urls?.regular ?? "",
        credit: `Foto: ${r.user?.name ?? "Unsplash"} · Unsplash`,
        source: "unsplash" as const,
        alt: r.alt_description || query,
      }))
      .filter((x) => x.url);
  } catch {
    return [];
  }
}

export async function searchPexelsImages(query: string, limit = 3): Promise<BlogImagePick[]> {
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key) return [];
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${Math.min(12, Math.max(limit, 6))}&orientation=landscape`;
    const res = await fetch(url, { headers: { Authorization: key } });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      photos?: Array<{
        alt?: string;
        src?: { large?: string };
        photographer?: string;
      }>;
    };
    return (json.photos ?? [])
      .slice(0, limit)
      .map((p) => ({
        url: p.src?.large ?? "",
        credit: `Foto: ${p.photographer ?? "Pexels"} · Pexels`,
        source: "pexels" as const,
        alt: p.alt || query,
      }))
      .filter((x) => x.url);
  } catch {
    return [];
  }
}

function pickUnused(candidates: BlogImagePick[], used: Set<string>): BlogImagePick | null {
  for (const c of candidates) {
    const key = normalizeImageUrl(c.url);
    if (!key || used.has(key)) continue;
    used.add(key);
    return c;
  }
  return null;
}

function normalizeImageUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

/**
 * Resolve one unique image per slot (cover + in-article).
 * Order per slot: Unsplash → Pexels → Wikimedia → AI generation.
 * Never reuses the same URL across slots.
 */
export async function resolveBlogImagesForSlots(opts: {
  db: DatabaseSync;
  articleId: string;
  slots: BlogImageSlot[];
  uploadDir?: string;
  themeContext?: string;
}): Promise<BlogImagePick[]> {
  const slots = opts.slots.slice(0, 8);
  const used = new Set<string>();
  const out: BlogImagePick[] = [];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;
    const query = slot.query.trim() || opts.themeContext || "roommates shared apartment Mexico lifestyle";
    let pick: BlogImagePick | null = null;

    pick = pickUnused(await searchUnsplashImages(query, 6), used);
    if (!pick) pick = pickUnused(await searchPexelsImages(query, 6), used);
    if (!pick) pick = pickUnused(await searchWikimediaImages(query, 6), used);

    if (!pick) {
      const generated = await generateAiBlogImages({
        db: opts.db,
        articleId: opts.articleId,
        count: 1,
        themeHint: `${query}. Context: ${opts.themeContext || ""}`.slice(0, 400),
        uploadDir: opts.uploadDir,
        variation: i,
      });
      pick = pickUnused(generated, used);
    }

    if (pick) {
      out.push({
        ...pick,
        alt: (slot.alt || pick.alt || query).slice(0, 180),
      });
    }
  }

  return out;
}

/** @deprecated Prefer resolveBlogImagesForSlots for topic-matched unique images. */
export async function resolveBlogImages(opts: {
  db: DatabaseSync;
  articleId: string;
  queries: string[];
  need: number;
  uploadDir?: string;
  preferAi?: boolean;
  themeHint?: string;
}): Promise<BlogImagePick[]> {
  const queries = opts.queries.length
    ? opts.queries
    : [opts.themeHint || "roommates Mexico"];
  const slots: BlogImageSlot[] = [];
  for (let i = 0; i < opts.need; i++) {
    slots.push({ query: queries[i % queries.length]! });
  }
  if (opts.preferAi) {
    const generated = await generateAiBlogImages({
      db: opts.db,
      articleId: opts.articleId,
      count: opts.need,
      themeHint: opts.themeHint || queries[0] || "roommates Mexico",
      uploadDir: opts.uploadDir,
    });
    return generated.slice(0, opts.need);
  }
  return resolveBlogImagesForSlots({
    db: opts.db,
    articleId: opts.articleId,
    slots,
    uploadDir: opts.uploadDir,
    themeContext: opts.themeHint,
  });
}

async function generateAiBlogImages(opts: {
  db: DatabaseSync;
  articleId: string;
  count: number;
  themeHint: string;
  uploadDir?: string;
  variation?: number;
}): Promise<BlogImagePick[]> {
  const key = geminiApiKey();
  if (!key || !opts.uploadDir) return [];

  const model = process.env.BLOG_IMAGE_MODEL?.trim() || "gemini-2.5-flash-image";
  const out: BlogImagePick[] = [];

  for (let i = 0; i < opts.count; i++) {
    const variation = (opts.variation ?? 0) + i;
    const angles = [
      "wide lifestyle photo feel, natural light",
      "close editorial moment, shallow depth of field feel",
      "urban Mexico neighborhood atmosphere",
      "warm shared-home interior scene",
    ];
    const angle = angles[variation % angles.length];
    const prompt =
      `Create a unique brand-safe editorial illustration for Bestie.mx (roommate marketplace in Mexico). ` +
      `Specific scene: ${opts.themeHint}. Angle: ${angle}. ` +
      `Style: warm flat illustration mixed with soft photographic cues; optional subtle Bestie-like people silhouettes ` +
      `contextualized to THIS scene (not a generic high-five logo). Forest green #143D30 and lime accent sparingly. ` +
      `No text, no logos, no watermarks, no repeated generic apartment stock look. 16:9. Variation seed ${variation + 1}.`;

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
        meta: { themeHint: opts.themeHint, variation },
      });

      out.push({
        url: `/api/uploads/${filename}`,
        credit: "Ilustración generada · Bestie",
        source: "ai",
        alt: opts.themeHint.slice(0, 120),
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

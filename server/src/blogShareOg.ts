/**
 * Open Graph / JSON-LD for blog article URLs (crawler HTML injection).
 */
import type { DatabaseSync } from "node:sqlite";
import {
  upsertCanonical,
  upsertJsonLd,
  upsertMetaByName,
  upsertMetaByProperty,
  upsertTitle,
} from "./htmlMeta.js";
import { getBlogArticleBySlug, rowToBlogArticleDto } from "./blogDto.js";
import { parseBlogArticlePath } from "./blogPaths.js";
import { OG_DESC_MAX, OG_TITLE_MAX, truncateOgText } from "./listingShareOg.js";
import { shareOgImagePublicPath } from "./shareOgImage.js";

export type BlogShareOgMeta = {
  title: string;
  description: string;
  url: string;
  imageUrl: string | null;
  jsonLd?: unknown;
};

export function resolveBlogShareOg(
  db: DatabaseSync,
  pathname: string,
  base: string,
): BlogShareOgMeta | null {
  const parsed = parseBlogArticlePath(pathname);
  if (!parsed) return null;
  const row = getBlogArticleBySlug(db, {
    slug: parsed.slug,
    cityCode: parsed.cityCode,
    publishedOnly: true,
  });
  if (!row) return null;
  const article = rowToBlogArticleDto(row);
  const origin = base.replace(/\/+$/, "");
  const title = truncateOgText(article.metaTitle || article.title, OG_TITLE_MAX);
  const description = truncateOgText(
    article.metaDescription || article.excerpt || article.aeoSummary || "",
    OG_DESC_MAX,
  );
  const imageUrl = article.coverImageUrl
    ? `${origin}${shareOgImagePublicPath("blog", article.id)}`
    : `${origin}/brand/og-default.jpg`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.excerpt || description,
    datePublished: article.publishedAt || article.createdAt,
    dateModified: article.updatedAt,
    author: { "@type": "Organization", name: "Bestie", url: origin },
    publisher: {
      "@type": "Organization",
      name: "Bestie",
      logo: { "@type": "ImageObject", url: `${origin}/brand/logo-lockup.svg` },
    },
    image: imageUrl,
    mainEntityOfPage: `${origin}${article.path}`,
    articleSection: article.cityLabel || "México",
    keywords: article.labels.join(", "),
    speakable: article.aeoSummary
      ? {
          "@type": "SpeakableSpecification",
          cssSelector: [".blog-aeo-summary"],
        }
      : undefined,
    ...(article.faq.length
      ? {
          // Companion FAQPage node for AEO
        }
      : {}),
  };

  const nodes: unknown[] = [jsonLd];
  if (article.faq.length) {
    nodes.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: article.faq.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });
  }

  return {
    title: `${title} | Bestie`,
    description,
    url: `${origin}${article.path}`,
    imageUrl,
    jsonLd: nodes.length === 1 ? nodes[0] : nodes,
  };
}

export function injectBlogShareOg(html: string, og: BlogShareOgMeta): string {
  let out = html;
  out = upsertTitle(out, og.title);
  out = upsertMetaByName(out, "description", og.description);
  out = upsertCanonical(out, og.url);
  out = upsertMetaByProperty(out, "og:type", "article");
  out = upsertMetaByProperty(out, "og:title", og.title);
  out = upsertMetaByProperty(out, "og:description", og.description);
  out = upsertMetaByProperty(out, "og:url", og.url);
  if (og.imageUrl) {
    out = upsertMetaByProperty(out, "og:image", og.imageUrl);
    out = upsertMetaByName(out, "twitter:card", "summary_large_image");
    out = upsertMetaByName(out, "twitter:image", og.imageUrl);
  }
  out = upsertMetaByName(out, "twitter:title", og.title);
  out = upsertMetaByName(out, "twitter:description", og.description);
  if (og.jsonLd) {
    out = upsertJsonLd(out, "bestie-blog-jsonld", og.jsonLd);
  }
  return out;
}

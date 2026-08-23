/** Public blog URL helpers (city path only when city-specific). */

export const BLOG_SOCIAL = {
  facebook: "https://www.facebook.com/profile.php?id=61591982715836",
  instagram: "https://www.instagram.com/bestie.mexico/",
} as const;

/** Closing line for FB/IG captions — profile URLs stay out; article URL is separate. */
export const BLOG_SOCIAL_FOLLOW_LINE = "¡Síguenos para más consejos!";

export function publicWebOrigin(): string {
  return (process.env.PUBLIC_WEB_ORIGIN || "https://www.bestie.mx").replace(/\/+$/, "");
}

export function blogArticleShareUrl(opts: {
  slug: string;
  cityCode?: string | null;
  origin?: string;
}): string {
  const origin = (opts.origin || publicWebOrigin()).replace(/\/+$/, "");
  return `${origin}${blogArticlePublicPath(opts)}`;
}

function urlsMatchArticle(candidate: string, articleUrl: string): boolean {
  try {
    const a = new URL(articleUrl);
    const u = new URL(candidate);
    const pathA = a.pathname.replace(/\/+$/, "") || "/";
    const pathU = u.pathname.replace(/\/+$/, "") || "/";
    const hostA = a.hostname.replace(/^www\./i, "").toLowerCase();
    const hostU = u.hostname.replace(/^www\./i, "").toLowerCase();
    return hostA === hostU && pathA === pathU;
  } catch {
    return candidate.replace(/\/+$/, "") === articleUrl.replace(/\/+$/, "");
  }
}

/**
 * Caption for Meta paste: keep emojis, strip profile/other links, ensure follow line
 * + the article URL (for link previews) at the end.
 */
export function normalizeSocialCaption(
  raw: string | null | undefined,
  opts?: { articleUrl?: string | null },
): string {
  const articleUrl = (opts?.articleUrl ?? "").trim().replace(/\/+$/, "") || null;
  let text = String(raw ?? "").trim();

  if (articleUrl) {
    text = text.replace(/BESTIE_URL/gi, articleUrl);
  } else {
    text = text.replace(/BESTIE_URL/gi, "");
  }

  text = text.replace(/^[ \t]*Síguenos\s*[:：].*$/gim, "");
  text = text.replace(/¡?\s*Síguenos para más consejos!?\.?/gi, "");

  text = text.replace(/https?:\/\/\S+/gi, (match) => {
    const cleaned = match.replace(/[.,);:!?\]>'"]+$/g, "");
    if (articleUrl && urlsMatchArticle(cleaned, articleUrl)) return "";
    return "";
  });
  text = text.replace(/\bwww\.\S+/gi, "");

  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const parts: string[] = [];
  if (text) parts.push(text);
  parts.push(BLOG_SOCIAL_FOLLOW_LINE);
  if (articleUrl) parts.push(articleUrl);
  return parts.join("\n");
}

export const BLOG_CITY_META: Record<
  string,
  { label: string; landingPath: string; searchPath: string }
> = {
  gdl: {
    label: "Guadalajara",
    landingPath: "/guadalajara",
    searchPath: "/buscar/gdl",
  },
};

export function blogArticlePublicPath(opts: {
  slug: string;
  cityCode?: string | null;
}): string {
  const slug = opts.slug.trim().replace(/^\/+|\/+$/g, "");
  const city = (opts.cityCode ?? "").trim().toLowerCase();
  if (city && BLOG_CITY_META[city]) {
    return `/blog/${city}/${slug}`;
  }
  return `/blog/${slug}`;
}

export function parseBlogArticlePath(pathname: string): {
  cityCode: string | null;
  slug: string;
} | null {
  const raw = pathname.split("?")[0]?.replace(/\/+$/, "") || "";
  const parts = raw.split("/").filter(Boolean);
  if (parts[0] !== "blog" || parts.length < 2) return null;
  if (parts.length === 2) {
    if (parts[1] === "gdl") return null; // index filter lives on /blog?city=gdl
    return { cityCode: null, slug: parts[1]! };
  }
  if (parts.length === 3 && parts[1] === "gdl") {
    return { cityCode: "gdl", slug: parts[2]! };
  }
  return null;
}

export function ctaPathForArticle(cityCode: string | null | undefined): string {
  const city = (cityCode ?? "").trim().toLowerCase();
  if (city && BLOG_CITY_META[city]) return BLOG_CITY_META[city].landingPath;
  return "/";
}

export function slugifyBlogTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "articulo";
}

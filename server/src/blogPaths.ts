/** Public blog URL helpers (city path only when city-specific). */

export const BLOG_SOCIAL = {
  facebook: "https://www.facebook.com/profile.php?id=61591982715836",
  instagram: "https://www.instagram.com/bestie.mexico/",
} as const;

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

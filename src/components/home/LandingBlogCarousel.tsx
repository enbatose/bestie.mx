import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { fetchBlogIndex, type BlogArticle } from "@/lib/blogApi";
import { track } from "@/lib/analytics";

type BlogCard = Pick<
  BlogArticle,
  | "id"
  | "title"
  | "excerpt"
  | "slug"
  | "cityCode"
  | "cityLabel"
  | "labels"
  | "coverImageUrl"
  | "viewCount"
  | "publishedAt"
  | "path"
>;

type LandingBlogCarouselProps = {
  /** Omit for national hub (all articles). Pass city code for city+national only. */
  cityCode?: string | null;
  /** Analytics surface id */
  surface?: "home" | "city";
};

const AUTO_MS = 5500;
const CARD_SCROLL_PX = 292;

export function LandingBlogCarousel({ cityCode = null, surface = "home" }: LandingBlogCarouselProps) {
  const [items, setItems] = useState<BlogCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const scrollerRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void fetchBlogIndex({
      city: cityCode || undefined,
      includeNational: Boolean(cityCode),
      limit: 12,
      signal: controller.signal,
    })
      .then((data) => setItems(data.items))
      .catch(() => {
        if (!controller.signal.aborted) setItems([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [cityCode]);

  const scrollByCards = useCallback((dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 4) return;
    const next = el.scrollLeft + dir * CARD_SCROLL_PX;
    if (dir > 0 && next >= max - 8) {
      el.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    if (dir < 0 && next <= 8) {
      el.scrollTo({ left: max, behavior: "smooth" });
      return;
    }
    el.scrollBy({ left: dir * CARD_SCROLL_PX, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (paused || items.length < 3) return;
    const id = window.setInterval(() => scrollByCards(1), AUTO_MS);
    return () => window.clearInterval(id);
  }, [paused, items.length, scrollByCards]);

  if (!loading && items.length === 0) return null;

  const blogHref = cityCode === "gdl" ? "/blog?city=gdl" : "/blog";
  const subtitle = cityCode
    ? "Guías locales y tips nacionales para roomies."
    : "Consejos para encontrar roomie y vivir mejor en México.";

  return (
    <section className="border-b border-border bg-surface px-4 py-14 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Blog</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-body sm:text-xl">
              Del blog Bestie
            </h2>
            <p className="mt-2 text-balance text-sm leading-relaxed text-muted sm:text-base">
              {subtitle}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="Artículo anterior"
                onClick={() => scrollByCards(-1)}
                className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-bg-light text-body transition hover:border-primary/40 disabled:opacity-40"
                disabled={loading || items.length < 2}
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Siguiente artículo"
                onClick={() => scrollByCards(1)}
                className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-bg-light text-body transition hover:border-primary/40 disabled:opacity-40"
                disabled={loading || items.length < 2}
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
            <Link
              to={blogHref}
              onClick={() => track("home_cta_clicked", { cta: "blog_section", surface })}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-primary/25 px-4 text-sm font-semibold text-primary transition hover:border-primary/50"
            >
              Ver todo el blog
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="mt-8 animate-pulse text-sm text-muted" role="status">
            Cargando artículos…
          </p>
        ) : (
          <ul
            ref={scrollerRef}
            className="-mx-1 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-1 pb-2 [scrollbar-width:thin]"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
            }}
            aria-label="Artículos del blog"
          >
            {items.map((article) => (
              <li
                key={article.id}
                className="w-[min(100%,17.5rem)] shrink-0 snap-start sm:w-[18rem]"
              >
                <Link
                  to={article.path}
                  onClick={() =>
                    track("home_cta_clicked", {
                      cta: "blog_article",
                      surface,
                      article_id: article.id,
                    })
                  }
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-bg-light transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                >
                  <div className="aspect-[16/10] overflow-hidden bg-surface">
                    {article.coverImageUrl ? (
                      <img
                        src={article.coverImageUrl}
                        alt=""
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-secondary/15 text-xs font-semibold text-primary">
                        Bestie Blog
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-3.5">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                      <span className="rounded-full bg-secondary/15 px-2 py-0.5 font-semibold text-primary">
                        {article.cityLabel || "México"}
                      </span>
                      {article.publishedAt ? (
                        <time dateTime={article.publishedAt}>
                          {new Date(article.publishedAt).toLocaleDateString("es-MX", {
                            day: "numeric",
                            month: "short",
                          })}
                        </time>
                      ) : null}
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-base font-bold leading-snug text-primary">
                      {article.title}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-muted">{article.excerpt}</p>
                    <span className="mt-auto flex items-center gap-1 pt-3 text-[11px] text-muted">
                      <Eye className="size-3.5" />
                      {article.viewCount.toLocaleString("es-MX")} vistas
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

import { Link } from "react-router-dom";
import { Eye } from "lucide-react";
import { BlogBlocks } from "@/components/blog/BlogBlocks";
import type { BlogArticle, BlogBlock, BlogSource } from "@/lib/blogApi";

const SOCIAL = {
  facebook: "https://www.facebook.com/profile.php?id=61591982715836",
  instagram: "https://www.instagram.com/bestie.mexico/",
} as const;

export type BlogArticlePreviewModel = Pick<
  BlogArticle,
  | "title"
  | "excerpt"
  | "labels"
  | "coverImageUrl"
  | "coverImageCredit"
  | "aeoSummary"
  | "ctaPath"
  | "cityLabel"
  | "viewCount"
  | "publishedAt"
  | "socialCaption"
> & {
  blocks: BlogBlock[];
  sources: BlogSource[];
};

/** Public article body (no comments) — used on the live page and in admin preview. */
export function BlogArticleBody({
  article,
  showDraftBadge = false,
}: {
  article: BlogArticlePreviewModel;
  showDraftBadge?: boolean;
}) {
  const dateLabel = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Borrador · sin publicar";

  return (
    <article>
      {showDraftBadge ? (
        <p className="mb-4 inline-flex rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-900">
          Vista previa · así se verá al publicar
        </p>
      ) : null}
      {article.coverImageUrl ? (
        <figure className="space-y-2">
          <img
            src={article.coverImageUrl}
            alt=""
            className="aspect-[16/9] w-full rounded-3xl object-cover"
          />
          {article.coverImageCredit ? (
            <figcaption className="text-xs text-muted">{article.coverImageCredit}</figcaption>
          ) : null}
        </figure>
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center rounded-3xl border border-dashed border-border bg-surface text-sm text-muted">
          Sin imagen de portada
        </div>
      )}
      <div className="mt-7 flex flex-wrap gap-2">
        {article.cityLabel ? (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {article.cityLabel}
          </span>
        ) : null}
        {article.labels.map((label) => (
          <span
            key={label}
            className="rounded-full bg-secondary/15 px-3 py-1 text-xs font-semibold text-primary"
          >
            {label}
          </span>
        ))}
      </div>
      <h1 className="mt-4 text-3xl font-bold leading-tight text-primary sm:text-4xl">
        {article.title || "Sin título"}
      </h1>
      {article.excerpt ? <p className="mt-3 text-base leading-7 text-muted">{article.excerpt}</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
        <span className="font-semibold text-body">Por Bestie</span>
        <time>{dateLabel}</time>
        <span className="inline-flex items-center gap-1">
          <Eye className="size-4" /> {article.viewCount.toLocaleString("es-MX")} vistas
        </span>
      </div>
      {article.aeoSummary ? (
        <aside className="blog-aeo-summary mt-7 rounded-2xl border border-secondary/30 bg-secondary/10 p-5 text-sm leading-6 text-body">
          <strong className="block text-primary">En breve</strong>
          {article.aeoSummary}
        </aside>
      ) : null}
      <div className="mt-9">
        {article.blocks.length ? (
          <BlogBlocks blocks={article.blocks} />
        ) : (
          <p className="text-sm text-muted">Aún no hay contenido en el artículo.</p>
        )}
      </div>
      {article.sources.length ? (
        <section className="mt-10 border-t border-border pt-7">
          <h2 className="text-lg font-bold text-primary">Fuentes</h2>
          <ol className="mt-3 space-y-2 text-sm text-muted">
            {article.sources.map((source, index) => (
              <li key={source.id}>
                <span className="mr-2 font-semibold text-body">[{index + 1}]</span>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-primary"
                >
                  {source.title}
                </a>
                {source.publisher ? ` — ${source.publisher}` : ""}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <div className="mt-9 flex flex-col gap-4 rounded-2xl bg-primary p-6 text-primary-fg sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold">Encuentra tu próximo hogar compartido</p>
          <p className="mt-1 text-sm opacity-80">Busca opciones claras y conecta en Bestie.</p>
        </div>
        <Link
          to={article.ctaPath || "/"}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-secondary px-5 text-sm font-bold text-primary"
        >
          Explorar en Bestie
        </Link>
      </div>
      <p className="mt-6 text-sm text-muted">
        Síguenos en{" "}
        <a href={SOCIAL.facebook} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">
          Facebook
        </a>{" "}
        e{" "}
        <a href={SOCIAL.instagram} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">
          Instagram
        </a>
        .
      </p>
    </article>
  );
}

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, Search } from "lucide-react";
import { usePageSeo } from "@/hooks/usePageSeo";
import { fetchBlogIndex, type BlogArticle } from "@/lib/blogApi";

type BlogCard = Pick<BlogArticle, "id" | "title" | "excerpt" | "slug" | "cityCode" | "cityLabel" | "labels" | "coverImageUrl" | "viewCount" | "publishedAt" | "path">;

const inputClass = "min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2";

export function BlogIndexPage() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<BlogCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const q = params.get("q") ?? "";
  const city = params.get("city") ?? "all";
  const label = params.get("label") ?? "";

  usePageSeo({
    title: "Blog Bestie MX | Roomies, renta compartida y vida en GDL",
    description: "Guías y consejos de Bestie sobre roomies, cuartos en renta y vida compartida en Guadalajara y México.",
    canonicalPath: "/blog",
  });

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void fetchBlogIndex({ q, city: city === "all" ? undefined : city, label, signal: controller.signal })
      .then((data) => setItems(data.items))
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "No se pudo cargar el blog.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [q, city, label]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || (key === "city" && value === "all")) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Ideas para vivir mejor</p>
        <h1 className="mt-2 text-3xl font-bold text-primary">Blog Bestie</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Consejos claros para encontrar roomie, compartir hogar y disfrutar tu ciudad.</p>
      </header>

      <div className="mt-7 grid gap-3 rounded-2xl border border-border bg-bg-light p-4 sm:grid-cols-3">
        <label className="relative">
          <span className="sr-only">Buscar artículos</span>
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted" />
          <input type="search" value={q} onChange={(e) => update("q", e.target.value)} placeholder="Buscar en el blog…" className={`${inputClass} pl-9`} />
        </label>
        <label>
          <span className="sr-only">Ciudad</span>
          <select value={city} onChange={(e) => update("city", e.target.value)} className={inputClass}>
            <option value="all">Todas las ciudades</option>
            <option value="gdl">Guadalajara</option>
            <option value="national">Nacional</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Tema</span>
          <input value={label} onChange={(e) => update("label", e.target.value)} placeholder="Tema (ej. roomies)" className={inputClass} />
        </label>
      </div>

      {loading ? <p className="mt-8 text-sm text-muted">Cargando artículos…</p> : null}
      {error ? <p className="mt-8 rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error">No pudimos cargar los artículos. Intenta de nuevo.</p> : null}
      {!loading && !error && items.length === 0 ? <p className="mt-8 text-sm text-muted">No encontramos artículos con estos filtros.</p> : null}

      <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((article) => (
          <li key={article.id}>
            <Link to={article.path} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
              <div className="aspect-[16/9] overflow-hidden bg-bg-light">
                {article.coverImageUrl ? <img src={article.coverImageUrl} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" /> : null}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex flex-wrap gap-2 text-xs text-muted">
                  <span className="rounded-full bg-secondary/15 px-2 py-1 font-semibold text-primary">{article.cityLabel || "México"}</span>
                  {article.publishedAt ? <time dateTime={article.publishedAt}>{new Date(article.publishedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}</time> : null}
                </div>
                <h2 className="mt-3 text-lg font-bold leading-snug text-primary">{article.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">{article.excerpt}</p>
                <span className="mt-auto flex items-center gap-1 pt-4 text-xs text-muted"><Eye className="size-3.5" /> {article.viewCount.toLocaleString("es-MX")} vistas</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Check, Copy, MessageCircle, Share2 } from "lucide-react";
import { BlogArticleBody } from "@/components/blog/BlogArticleBody";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { usePageSeo } from "@/hooks/usePageSeo";
import { useAppShellOutlet } from "@/layouts/appShellOutletContext";
import {
  deleteBlogComment,
  fetchBlogArticleByPath,
  fetchBlogComments,
  patchBlogComment,
  postBlogComment,
  recordBlogView,
  reportBlogComment,
  type BlogArticle,
  type BlogComment,
} from "@/lib/blogApi";
import { SITE_ORIGIN } from "@/lib/seo";

function CommentItem({
  articleId,
  comment,
  canPost,
  onLogin,
  onChange,
}: {
  articleId: string;
  comment: BlogComment;
  canPost: boolean;
  onLogin: () => void;
  onChange: (comments: BlogComment[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const edit = async () => {
    const body = window.prompt("Edita tu comentario", comment.body)?.trim();
    if (body && body !== comment.body) onChange(await patchBlogComment(comment.id, { body }));
  };
  const remove = async () => {
    if (window.confirm("¿Eliminar este comentario?")) onChange(await deleteBlogComment(comment.id));
  };
  const hide = async () => onChange(await patchBlogComment(comment.id, { hidden: !comment.hidden }));
  const report = async () => {
    const reason = window.prompt("¿Por qué quieres reportar este comentario?")?.trim();
    if (reason) {
      await reportBlogComment(comment.id, reason);
      window.alert("Gracias. Revisaremos el reporte.");
    }
  };
  const postReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!reply.trim()) return;
    if (!canPost) {
      onLogin();
      return;
    }
    const result = await postBlogComment(articleId, { body: reply.trim(), parentId: comment.id });
    onChange(result.comments);
    setReply("");
    setReplying(false);
    setExpanded(true);
  };
  return (
    <li className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {comment.author.avatarUrl ? <img src={comment.author.avatarUrl} alt="" className="size-8 rounded-full object-cover" /> : <span className="flex size-8 items-center justify-center rounded-full bg-secondary/20 text-xs font-bold text-primary">{comment.author.displayName.slice(0, 1).toUpperCase()}</span>}
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-body">{comment.author.displayName}</p><time className="text-xs text-muted" dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleDateString("es-MX")}</time></div>
        </div>
      </div>
      <p className={`mt-3 whitespace-pre-wrap text-sm leading-6 ${comment.hidden ? "italic text-muted" : "text-body"}`}>{comment.hidden ? "Comentario oculto por moderación." : comment.body}</p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-muted">
        {comment.canEdit ? <button type="button" onClick={() => void edit()} className="hover:text-primary">Editar</button> : null}
        {comment.canDelete ? <button type="button" onClick={() => void remove()} className="hover:text-error">Eliminar</button> : null}
        {comment.canModerate ? <button type="button" onClick={() => void hide()} className="hover:text-primary">{comment.hidden ? "Mostrar" : "Ocultar"}</button> : null}
        <button type="button" onClick={() => void report()} className="hover:text-error">Reportar</button>
        <button type="button" onClick={() => setReplying((value) => !value)} className="text-primary">Responder</button>
        {comment.replies.length ? <button type="button" onClick={() => setExpanded((value) => !value)} className="text-primary">{expanded ? "Ocultar respuestas" : `Ver ${comment.replies.length} respuesta${comment.replies.length === 1 ? "" : "s"}`}</button> : null}
      </div>
      {replying ? <form onSubmit={(event) => void postReply(event)} className="mt-3 flex gap-2"><input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Escribe una respuesta…" className="min-h-10 min-w-0 flex-1 rounded-xl border border-border bg-bg-light px-3 text-sm outline-none ring-accent focus:ring-2" /><button type="submit" disabled={!reply.trim()} className="rounded-full bg-primary px-4 text-xs font-semibold text-primary-fg disabled:opacity-40">Publicar</button></form> : null}
      {expanded ? <ul className="mt-4 space-y-3 border-l-2 border-border pl-3">{comment.replies.map((child) => <CommentItem key={child.id} articleId={articleId} comment={child} canPost={canPost} onLogin={onLogin} onChange={onChange} />)}</ul> : null}
    </li>
  );
}

export function BlogArticlePage() {
  const { city, slug = "" } = useParams<{ city?: string; slug: string }>();
  const location = useLocation();
  const { me } = useAppShellOutlet();
  const { openLogin } = useAuthModal();
  const [article, setArticle] = useState<BlogArticle | null>(null);
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [posting, setPosting] = useState(false);
  const [copied, setCopied] = useState(false);
  const viewedId = useRef<string | null>(null);

  usePageSeo({
    title: article?.metaTitle || article?.title || "Blog Bestie MX",
    description: article?.metaDescription || article?.excerpt || "Consejos de Bestie para compartir hogar.",
    canonicalPath: article?.path || location.pathname,
    ogType: "article",
    jsonLd: article ? [{
      "@context": "https://schema.org",
      "@type": "Article",
      headline: article.title,
      description: article.metaDescription || article.excerpt,
      image: article.coverImageUrl || undefined,
      datePublished: article.publishedAt || article.createdAt,
      dateModified: article.updatedAt,
      author: { "@type": "Organization", name: "Bestie MX" },
      publisher: { "@type": "Organization", name: "Bestie MX" },
      mainEntityOfPage: `${SITE_ORIGIN}${article.path}`,
    }] : undefined,
  });

  useEffect(() => {
    if (city && city !== "gdl") {
      setError(true);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    void fetchBlogArticleByPath({ slug, city: city ?? null, signal: controller.signal })
      .then(async (data) => {
        setArticle(data.article);
        setComments(await fetchBlogComments(data.article.id, controller.signal));
        if (viewedId.current !== data.article.id) {
          viewedId.current = data.article.id;
          const count = await recordBlogView(data.article.id);
          if (count) setArticle((current) => current ? { ...current, viewCount: count } : current);
        }
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [city, slug]);

  const publishComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim() || !article) return;
    if (!me) {
      openLogin(location.pathname);
      return;
    }
    setPosting(true);
    try {
      const result = await postBlogComment(article.id, { body: body.trim() });
      setComments(result.comments);
      setBody("");
    } finally {
      setPosting(false);
    }
  };

  if (loading) return <main className="mx-auto max-w-3xl px-4 py-16 text-sm text-muted sm:px-6">Cargando artículo…</main>;
  if (error || !article) return <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6"><h1 className="text-2xl font-bold text-primary">Artículo no encontrado</h1><Link to="/blog" className="mt-4 inline-block text-sm font-semibold text-primary underline">Volver al blog</Link></main>;

  const shareUrl = `${window.location.origin}${article.path}`;
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link to="/blog" className="text-sm font-semibold text-primary underline-offset-2 hover:underline">← Volver al blog</Link>
      <div className="mt-6">
        <BlogArticleBody article={article} />
      </div>

      <section className="mt-8 flex flex-wrap items-center gap-3 border-y border-border py-5">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-body"><Share2 className="size-4" /> Compartir</span>
        <button type="button" onClick={async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-4 text-sm text-body">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? "Copiado" : "Copiar enlace"}</button>
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-4 text-sm text-body"><span className="font-bold">f</span> Facebook</a>
      </section>

      <section className="mt-10" id="comentarios">
        <h2 className="flex items-center gap-2 text-xl font-bold text-primary"><MessageCircle className="size-5" /> Comentarios</h2>
        <form onSubmit={(event) => void publishComment(event)} className="mt-4 rounded-2xl border border-border bg-bg-light p-4">
          <label htmlFor="blog-comment" className="text-sm font-semibold text-body">Comparte tu opinión</label>
          <textarea id="blog-comment" value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Escribe un comentario…" className="mt-2 w-full resize-y rounded-xl border border-border bg-surface p-3 text-sm text-body outline-none ring-accent focus:ring-2" />
          {!me ? <p className="mt-2 text-xs text-muted">Puedes escribir ahora; te pediremos iniciar sesión al publicar.</p> : null}
          <button type="submit" disabled={!body.trim() || posting} className="mt-3 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg disabled:opacity-40">{posting ? "Publicando…" : "Publicar"}</button>
        </form>
        {comments.length ? <ul className="mt-6 space-y-4">{comments.map((comment) => <CommentItem key={comment.id} articleId={article.id} comment={comment} canPost={Boolean(me)} onLogin={() => openLogin(location.pathname)} onChange={setComments} />)}</ul> : <p className="mt-6 text-sm text-muted">Sé la primera persona en comentar.</p>}
      </section>
    </main>
  );
}

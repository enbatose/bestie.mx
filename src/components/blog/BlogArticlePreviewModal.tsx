import { useEffect } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X } from "lucide-react";
import {
  BlogArticleBody,
  type BlogArticlePreviewModel,
} from "@/components/blog/BlogArticleBody";

export function BlogArticlePreviewModal({
  article,
  onClose,
}: {
  article: BlogArticlePreviewModel;
  onClose: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[2100] flex items-end justify-center bg-black/55 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Vista previa del artículo"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-bg-light shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
          <div>
            <p className="text-sm font-bold text-body">Vista previa</p>
            <p className="text-xs text-muted">Así se verá el artículo una vez publicado</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-full border border-border text-body hover:bg-surface-elevated"
            aria-label="Cerrar vista previa"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
          <BlogArticleBody article={article} showDraftBadge />

          <section className="mt-10 border-t border-border pt-8" aria-label="Comentarios (vista previa)">
            <h2 className="flex items-center gap-2 text-xl font-bold text-primary">
              <MessageCircle className="size-5" /> Comentarios
            </h2>
            <p className="mt-2 text-xs text-muted">
              Así se verá la sección de comentarios. En la vista previa no se pueden publicar.
            </p>
            <div className="mt-4 rounded-2xl border border-border bg-bg-light p-4 opacity-90">
              <label className="text-sm font-semibold text-body">Comparte tu opinión</label>
              <textarea
                rows={4}
                disabled
                placeholder="Escribe un comentario…"
                className="mt-2 w-full resize-none rounded-xl border border-border bg-surface p-3 text-sm text-muted"
              />
              <p className="mt-2 text-xs text-muted">
                Los lectores pueden escribir aquí; si no han iniciado sesión, se les pedirá al publicar.
              </p>
              <button
                type="button"
                disabled
                className="mt-3 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg opacity-40"
              >
                Publicar
              </button>
            </div>
            <p className="mt-6 text-sm text-muted">Sé la primera persona en comentar.</p>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

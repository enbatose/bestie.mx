import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
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
        </div>
      </div>
    </div>,
    document.body,
  );
}

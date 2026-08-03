import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ShareAiCopyPanel } from "@/components/share/ShareAiCopyPanel";
import type { ShareAiScope } from "@/lib/shareAiCopyApi";

type Props = {
  open: boolean;
  onClose: () => void;
  scope: ShareAiScope;
  propertyId?: string | null;
  roomId?: string | null;
  title?: string;
};

/** Mobile-first bottom sheet / centered dialog for AI share copy. */
export function ShareAiCopyModal({
  open,
  onClose,
  scope,
  propertyId = null,
  roomId = null,
  title,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[2100] flex items-end justify-center sm:items-center sm:p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-ai-dialog-title"
        className="relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p id="share-ai-dialog-title" className="truncate text-sm font-bold text-body">
              Compartir anuncio
            </p>
            {title ? <p className="truncate text-xs text-muted">{title}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex rounded-full border border-border p-1.5 text-muted transition hover:bg-surface-elevated hover:text-body"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <ShareAiCopyPanel
            scope={scope}
            propertyId={propertyId}
            roomId={roomId}
            compact
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

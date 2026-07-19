import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { apiAbsoluteUrl } from "@/lib/mediaUrl";

export type MessageAttachmentLike = { url: string; filename: string };

const SWIPE_THRESHOLD_PX = 48;

/** Thumbnail grid for attachments already sent on a message, with an in-app lightbox. */
export function MessageAttachmentList({ attachments }: { attachments: MessageAttachmentLike[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!attachments || attachments.length === 0) return null;

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {attachments.map((a, i) => (
          <button
            key={`${a.url}-${i}`}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="block overflow-hidden rounded-lg border border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={`Ver imagen: ${a.filename || "Adjunto"}`}
          >
            <img
              src={apiAbsoluteUrl(a.url)}
              alt={a.filename || "Adjunto"}
              className="size-20 object-cover"
            />
          </button>
        ))}
      </div>
      {openIndex != null ? (
        <AttachmentLightbox
          attachments={attachments}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      ) : null}
    </>
  );
}

function AttachmentLightbox({
  attachments,
  index,
  onIndexChange,
  onClose,
}: {
  attachments: MessageAttachmentLike[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const count = attachments.length;
  const canNav = count > 1;
  const current = attachments[index] ?? attachments[0]!;
  const touchStartX = useRef<number | null>(null);

  const go = useCallback(
    (delta: number) => {
      if (count < 2) return;
      onIndexChange((index + delta + count) % count);
    },
    [count, index, onIndexChange],
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (!canNav) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canNav, go, onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || !canNav) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX == null) return;
    const dx = endX - touchStartX.current;
    if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) go(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2100] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label="Galería de adjuntos"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="relative flex min-h-0 flex-1 flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
          <p className="min-w-0 truncate text-sm font-medium">
            {current.filename || "Adjunto"}
            {canNav ? (
              <span className="ml-2 text-white/70">
                {index + 1} / {count}
              </span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            aria-label="Cerrar"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6 sm:px-16">
          {canNav ? (
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-2 z-10 flex size-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 sm:left-4"
              aria-label="Imagen anterior"
            >
              <ChevronLeft className="size-6" aria-hidden />
            </button>
          ) : null}

          <img
            src={apiAbsoluteUrl(current.url)}
            alt={current.filename || "Adjunto"}
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />

          {canNav ? (
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-2 z-10 flex size-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 sm:right-4"
              aria-label="Imagen siguiente"
            >
              <ChevronRight className="size-6" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

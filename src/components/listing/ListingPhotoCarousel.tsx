import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Flag, X } from "lucide-react";
import { apiAbsoluteUrl } from "@/lib/mediaUrl";

const SWIPE_THRESHOLD_PX = 48;

type Props = {
  urls: readonly string[];
  failedUrls?: ReadonlySet<string>;
  onImageError?: (url: string) => void;
  onReportPhoto?: (index: number, url: string) => void;
};

function PhotoSlide({
  url,
  failed,
  onError,
  className,
  alt,
  priority = false,
}: {
  url: string;
  failed: boolean;
  onError?: () => void;
  className: string;
  alt: string;
  priority?: boolean;
}) {
  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-bg-light text-center text-sm text-muted ${className}`}
      >
        <span className="font-semibold text-body">Foto no disponible</span>
      </div>
    );
  }
  return (
    <img
      src={apiAbsoluteUrl(url)}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      draggable={false}
      onError={onError}
    />
  );
}

type CarouselChromeProps = {
  urls: readonly string[];
  index: number;
  failedUrls?: ReadonlySet<string>;
  onImageError?: (url: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (i: number) => void;
  onOpenFullscreen?: () => void;
  onCloseFullscreen?: () => void;
  onReportPhoto?: (index: number, url: string) => void;
  fullscreen?: boolean;
  thumbRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
};

function CarouselChrome({
  urls,
  index,
  failedUrls,
  onImageError,
  onPrev,
  onNext,
  onSelect,
  onOpenFullscreen,
  onCloseFullscreen,
  onReportPhoto,
  fullscreen = false,
  thumbRefs,
}: CarouselChromeProps) {
  const count = urls.length;
  const canNav = count > 1;
  const currentUrl = urls[index]!;
  const failed = failedUrls?.has(currentUrl) ?? false;

  const mainClass = fullscreen
    ? "max-h-[min(85vh,900px)] max-w-full object-contain"
    : "h-full w-full object-cover";

  const frameClass = fullscreen
    ? "relative flex min-h-0 flex-1 items-center justify-center px-12 py-4 sm:px-16"
    : "relative aspect-[4/3] w-full cursor-zoom-in bg-black/5 sm:aspect-[16/10]";

  return (
    <>
      <div className={frameClass}>
        {onReportPhoto ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReportPhoto(index, currentUrl);
            }}
            className={`absolute left-3 top-3 z-20 flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold shadow-md transition ${
              fullscreen
                ? "bg-black/55 text-white backdrop-blur-sm hover:bg-black/70"
                : "bg-surface/95 text-error ring-1 ring-border hover:bg-surface"
            }`}
            aria-label="Reportar foto"
          >
            <Flag className="size-3.5" aria-hidden />
            Reportar
          </button>
        ) : null}

        {fullscreen && onCloseFullscreen ? (
          <button
            type="button"
            onClick={onCloseFullscreen}
            className="absolute right-3 top-3 z-20 flex size-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/70"
            aria-label="Cerrar vista ampliada"
          >
            <X className="size-5" aria-hidden />
          </button>
        ) : null}

        {canNav ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPrev();
              }}
              className={`absolute left-2 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full shadow-md transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                fullscreen
                  ? "bg-white/15 text-white backdrop-blur-sm hover:bg-white/25"
                  : "bg-surface/95 text-primary ring-1 ring-border hover:bg-surface"
              }`}
              aria-label="Foto anterior"
            >
              <ChevronLeft className="size-6" aria-hidden />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
              className={`absolute right-2 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full shadow-md transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                fullscreen
                  ? "bg-white/15 text-white backdrop-blur-sm hover:bg-white/25"
                  : "bg-surface/95 text-primary ring-1 ring-border hover:bg-surface"
              }`}
              aria-label="Foto siguiente"
            >
              <ChevronRight className="size-6" aria-hidden />
            </button>
          </>
        ) : null}

        {onOpenFullscreen && !fullscreen ? (
          <button
            type="button"
            onClick={onOpenFullscreen}
            className="absolute inset-0 z-[1] flex h-full w-full items-stretch"
            aria-label={`Ver foto ${index + 1} de ${count} en pantalla completa`}
          >
            <PhotoSlide
              url={currentUrl}
              failed={failed}
              onError={onImageError ? () => onImageError(currentUrl) : undefined}
              className={mainClass}
              alt={`Foto ${index + 1} de ${count}`}
              priority={index === 0}
            />
          </button>
        ) : (
          <PhotoSlide
            url={currentUrl}
            failed={failed}
            onError={onImageError ? () => onImageError(currentUrl) : undefined}
            className={mainClass}
            alt={`Foto ${index + 1} de ${count}`}
            priority={index === 0 && !fullscreen}
          />
        )}

        <div
          className={`pointer-events-none absolute bottom-3 right-3 z-10 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums shadow-sm ${
            fullscreen ? "bg-black/55 text-white" : "bg-black/50 text-white"
          }`}
          aria-live="polite"
          aria-atomic="true"
        >
          {index + 1} / {count}
        </div>

        {index === 0 && !fullscreen ? (
          <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-fg shadow-sm">
            Portada
          </span>
        ) : null}
      </div>

      {canNav ? (
        <div
          className={
            fullscreen
              ? "shrink-0 border-t border-white/10 bg-black/80 px-3 py-3"
              : "mt-3"
          }
        >
          <div
            className={`flex gap-2 overflow-x-auto overscroll-x-contain pb-0.5 ${
              fullscreen ? "justify-center" : ""
            }`}
            role="tablist"
            aria-label="Miniaturas de fotos"
          >
            {urls.map((u, i) => {
              const thumbFailed = failedUrls?.has(u) ?? false;
              const active = i === index;
              return (
                <button
                  key={u}
                  ref={(el) => {
                    thumbRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`Foto ${i + 1}${i === 0 ? ", portada" : ""}`}
                  onClick={() => onSelect(i)}
                  className={`relative shrink-0 overflow-hidden rounded-lg ring-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                    active
                      ? fullscreen
                        ? "ring-white ring-offset-2 ring-offset-black/80"
                        : "ring-primary ring-offset-2 ring-offset-surface"
                      : fullscreen
                        ? "ring-transparent opacity-60 hover:opacity-90"
                        : "ring-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  {thumbFailed ? (
                    <div className="flex size-14 items-center justify-center bg-bg-light text-[9px] text-muted sm:size-16">
                      —
                    </div>
                  ) : (
                    <img
                      src={apiAbsoluteUrl(u)}
                      alt=""
                      className="size-14 object-cover sm:size-16"
                      loading="lazy"
                      draggable={false}
                    />
                  )}
                  {i === 0 ? (
                    <span
                      className={`absolute bottom-0.5 left-0.5 rounded px-1 text-[8px] font-bold uppercase ${
                        fullscreen ? "bg-primary text-primary-fg" : "bg-primary/90 text-primary-fg"
                      }`}
                    >
                      1
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ListingPhotoCarousel({ urls, failedUrls, onImageError, onReportPhoto }: Props) {
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const touchStartX = useRef<number | null>(null);

  const count = urls.length;

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  const go = useCallback(
    (delta: number) => {
      if (count < 2) return;
      setIndex((i) => (i + delta + count) % count);
    },
    [count],
  );

  const onSelect = useCallback((i: number) => {
    setIndex(i);
  }, []);

  useEffect(() => {
    const thumb = thumbRefs.current[index];
    const container = thumb?.parentElement;
    if (!thumb || !container) return;
    const targetLeft = thumb.offsetLeft - (container.clientWidth - thumb.offsetWidth) / 2;
    container.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
  }, [index, fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFullscreen(false);
        return;
      }
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
  }, [fullscreen, go]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || count < 2) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX == null) return;
    const dx = endX - touchStartX.current;
    if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) go(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (count < 2) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    }
  };

  if (!count) {
    return <p className="text-sm text-muted">Sin fotos disponibles.</p>;
  }

  const chromeProps = {
    urls,
    index,
    failedUrls,
    onImageError,
    onReportPhoto,
    onPrev: () => go(-1),
    onNext: () => go(1),
    onSelect,
    thumbRefs,
  };

  const fullscreenOverlay =
    fullscreen && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[2100] flex flex-col bg-black/95"
            role="dialog"
            aria-modal="true"
            aria-label="Galería de fotos en pantalla completa"
            onClick={() => setFullscreen(false)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="flex min-h-0 flex-1 flex-col" onClick={(e) => e.stopPropagation()}>
              <CarouselChrome
                {...chromeProps}
                fullscreen
                onCloseFullscreen={() => setFullscreen(false)}
              />
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        className="overflow-hidden rounded-xl ring-1 ring-border"
        role="region"
        aria-roledescription="carrusel"
        aria-label={`Galería de fotos, ${count} imágenes`}
        tabIndex={count > 1 ? 0 : undefined}
        onKeyDown={handleInlineKeyDown}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <CarouselChrome
          {...chromeProps}
          onOpenFullscreen={() => setFullscreen(true)}
        />
      </div>
      {fullscreenOverlay}
    </>
  );
}

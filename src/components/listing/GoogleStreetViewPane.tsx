import { useEffect, useMemo, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { streetViewEmbedUrl, streetViewExternalUrl } from "@/lib/streetView";

type Props = {
  lat: number;
  lng: number;
  heightClass?: string;
  className?: string;
};

function StreetViewFrame({
  lat,
  lng,
  heightClass,
  title,
}: {
  lat: number;
  lng: number;
  heightClass: string;
  title: string;
}) {
  const src = useMemo(() => streetViewEmbedUrl(lat, lng), [lat, lng]);
  return (
    <iframe
      title={title}
      src={src}
      className={`${heightClass} w-full rounded-xl border border-border bg-surface`}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
    />
  );
}

export function GoogleStreetViewPane({
  lat,
  lng,
  heightClass = "h-[260px] md:h-[320px]",
  className = "",
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const externalUrl = useMemo(() => streetViewExternalUrl(lat, lng), [lat, lng]);

  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  return (
    <>
      <div className={`relative ${className}`}>
        <StreetViewFrame lat={lat} lng={lng} heightClass={heightClass} title="Vista de calle" />
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface/95 px-2.5 py-1.5 text-xs font-semibold text-body shadow-sm backdrop-blur-sm transition hover:bg-surface-elevated"
        >
          <Maximize2 className="size-3.5" aria-hidden />
          Ampliar Street View
        </button>
      </div>

      {expanded ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Street View ampliado"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
          onClick={() => setExpanded(false)}
        >
          <div
            className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-body">Vista de calle</p>
              <div className="flex items-center gap-2">
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-primary transition hover:bg-surface-elevated"
                >
                  Abrir en Google Maps
                </a>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="rounded-full border border-border p-1.5 text-body transition hover:bg-surface-elevated"
                  aria-label="Cerrar Street View"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            </div>
            <div className="p-3">
              <StreetViewFrame
                lat={lat}
                lng={lng}
                heightClass="h-[min(70vh,560px)]"
                title="Vista de calle ampliada"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

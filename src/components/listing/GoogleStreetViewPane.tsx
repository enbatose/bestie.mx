import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { streetViewEmbedUrl, streetViewExternalUrl, streetViewPovCacheKey } from "@/lib/streetView";
import {
  trackStreetViewEmbedLocked,
  type StreetViewTrackingInterface,
  type StreetViewEmbedVariant,
} from "@/lib/streetViewTelemetry";
import type { StreetViewPov } from "@/types/listing";

type Props = {
  lat: number;
  lng: number;
  streetViewPov?: StreetViewPov | null;
  heightClass?: string;
  className?: string;
  trackingInterface?: StreetViewTrackingInterface;
  propertyId?: string;
  listingId?: string;
  /** Load iframe immediately (use on below-the-fold listing maps). */
  loadEager?: boolean;
};

function StreetViewFrame({
  lat,
  lng,
  streetViewPov,
  heightClass,
  title,
  trackingInterface,
  propertyId,
  listingId,
  variant,
  loadEager = false,
}: {
  lat: number;
  lng: number;
  streetViewPov?: StreetViewPov | null;
  heightClass: string;
  title: string;
  trackingInterface?: StreetViewTrackingInterface;
  propertyId?: string;
  listingId?: string;
  variant: StreetViewEmbedVariant;
  loadEager?: boolean;
}) {
  const trackedRef = useRef(false);
  const povKey = streetViewPovCacheKey(streetViewPov);
  const src = useMemo(
    () => streetViewEmbedUrl(lat, lng, streetViewPov),
    [lat, lng, povKey],
  );

  useEffect(() => {
    trackedRef.current = false;
  }, [src, trackingInterface, variant]);

  const handleLoad = () => {
    if (!streetViewPov || !trackingInterface || trackedRef.current) return;
    trackedRef.current = true;
    void trackStreetViewEmbedLocked({
      interface: trackingInterface,
      variant,
      propertyId,
      listingId,
    });
  };

  return (
    <iframe
      title={title}
      src={src}
      className={`${heightClass} w-full rounded-xl border border-border bg-surface`}
      loading={loadEager ? "eager" : "lazy"}
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
      onLoad={handleLoad}
    />
  );
}

export function GoogleStreetViewPane({
  lat,
  lng,
  streetViewPov,
  heightClass = "h-[260px] md:h-[320px]",
  className = "",
  trackingInterface,
  propertyId,
  listingId,
  loadEager = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const povKey = streetViewPovCacheKey(streetViewPov);
  const externalUrl = useMemo(
    () => streetViewExternalUrl(lat, lng, streetViewPov),
    [lat, lng, povKey],
  );

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
        <StreetViewFrame
          lat={lat}
          lng={lng}
          streetViewPov={streetViewPov}
          heightClass={heightClass}
          title="Vista de calle"
          trackingInterface={trackingInterface}
          propertyId={propertyId}
          listingId={listingId}
          variant="inline"
          loadEager={loadEager}
        />
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
                streetViewPov={streetViewPov}
                heightClass="h-[min(70vh,560px)]"
                title="Vista de calle ampliada"
                trackingInterface={trackingInterface}
                propertyId={propertyId}
                listingId={listingId}
                variant="expanded"
                loadEager={loadEager}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

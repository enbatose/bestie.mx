import { useEffect, useRef, useState } from "react";
import { googleMapsApiKey, loadGoogleMapsScript } from "@/lib/googleMapsLoader";
import type { StreetViewPov } from "@/types/listing";

type Props = {
  lat: number;
  lng: number;
  pov?: StreetViewPov | null;
  onPovChange: (pov: StreetViewPov) => void;
};

function readPanoramaPov(panorama: google.maps.StreetViewPanorama): StreetViewPov {
  const p = panorama.getPov();
  return {
    heading: Number.isFinite(p.heading) ? p.heading : 0,
    pitch: Number.isFinite(p.pitch) ? p.pitch : 0,
    zoom: Number.isFinite(panorama.getZoom()) ? panorama.getZoom() : 1,
  };
}

export function StreetViewPovEditor({ lat, lng, pov, onPovChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const onPovChangeRef = useRef(onPovChange);
  onPovChangeRef.current = onPovChange;
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    if (!googleMapsApiKey()) {
      setLoadErr("Configura VITE_GOOGLE_MAPS_EMBED_KEY para ajustar la vista de calle.");
      return;
    }
    setLoadErr(null);
    let cancelled = false;
    const listeners: google.maps.MapsEventListener[] = [];

    void loadGoogleMapsScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google?.maps) return;

        const panorama = new window.google.maps.StreetViewPanorama(containerRef.current, {
          position: { lat, lng },
          pov: pov ? { heading: pov.heading, pitch: pov.pitch } : { heading: 0, pitch: 0 },
          zoom: pov?.zoom ?? 1,
          addressControl: false,
          fullscreenControl: false,
          linksControl: true,
          panControl: true,
          zoomControl: true,
          motionTracking: false,
          motionTrackingControl: false,
        });
        panoramaRef.current = panorama;

        const syncPov = () => {
          onPovChangeRef.current(readPanoramaPov(panorama));
        };
        listeners.push(panorama.addListener("pov_changed", syncPov));
        listeners.push(panorama.addListener("zoom_changed", syncPov));
        syncPov();
      })
      .catch(() => {
        if (!cancelled) setLoadErr("No se pudo cargar Google Street View. Intenta de nuevo más tarde.");
      });

    return () => {
      cancelled = true;
      for (const l of listeners) l.remove();
      panoramaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- panorama is created once per mount
  }, []);

  useEffect(() => {
    const panorama = panoramaRef.current;
    if (!panorama) return;
    panorama.setPosition({ lat, lng });
  }, [lat, lng]);

  if (loadErr) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
        {loadErr}
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-[260px] w-full overflow-hidden rounded-xl border border-border bg-surface md:h-[320px]"
      aria-label="Editor de vista de calle"
    />
  );
}

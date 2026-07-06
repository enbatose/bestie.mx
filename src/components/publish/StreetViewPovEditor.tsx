import { useEffect, useRef, useState } from "react";
import { googleMapsApiKey, loadGoogleMapsScript } from "@/lib/googleMapsLoader";
import { trackDynamicStreetViewSession } from "@/lib/streetViewTelemetry";
import type { StreetViewPov } from "@/types/listing";
import { streetViewFovFromZoom } from "@/lib/streetView";

type Props = {
  lat: number;
  lng: number;
  pov?: StreetViewPov | null;
  onPovChange: (pov: StreetViewPov) => void;
  heightClass?: string;
};

function readPanoramaPov(panorama: google.maps.StreetViewPanorama): StreetViewPov {
  const p = panorama.getPov();
  const zoom = Number.isFinite(panorama.getZoom()) ? panorama.getZoom() : 1;
  const pos = panorama.getPosition();
  const pov: StreetViewPov = {
    heading: Number.isFinite(p.heading) ? p.heading : 0,
    pitch: Number.isFinite(p.pitch) ? p.pitch : 0,
    zoom,
    fov: streetViewFovFromZoom(zoom),
  };
  const pano = panorama.getPano()?.trim();
  if (pano) pov.pano = pano;
  if (pos) {
    const panoLat = pos.lat();
    const panoLng = pos.lng();
    if (Number.isFinite(panoLat) && Number.isFinite(panoLng)) {
      pov.panoLat = panoLat;
      pov.panoLng = panoLng;
    }
  }
  return pov;
}

export function StreetViewPovEditor({
  lat,
  lng,
  pov,
  onPovChange,
  heightClass = "h-80 md:h-96",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const sessionTrackedRef = useRef(false);
  const onPovChangeRef = useRef(onPovChange);
  onPovChangeRef.current = onPovChange;
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [noImagery, setNoImagery] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!googleMapsApiKey()) {
      setLoadErr("Configura VITE_GOOGLE_MAPS_EMBED_KEY para ajustar la vista de calle.");
      setNoImagery(false);
      setLoading(false);
      return;
    }

    setLoadErr(null);
    setNoImagery(false);
    setLoading(true);
    sessionTrackedRef.current = false;

    let cancelled = false;
    const listeners: google.maps.MapsEventListener[] = [];

    void loadGoogleMapsScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google?.maps) return;

        const service = new window.google.maps.StreetViewService();
        service.getPanorama({ location: { lat, lng }, radius: 100 }, (data, status) => {
          if (cancelled || !containerRef.current || !window.google?.maps) return;

          if (status !== window.google.maps.StreetViewStatus.OK || !data?.location?.latLng) {
            panoramaRef.current = null;
            setNoImagery(true);
            setLoading(false);
            return;
          }

          setNoImagery(false);

          const panoLatLng = data.location.latLng;
          const position = { lat: panoLatLng.lat(), lng: panoLatLng.lng() };
          const defaultHeading = data.tiles?.centerHeading ?? 0;

          const panorama = new window.google.maps.StreetViewPanorama(containerRef.current, {
            position,
            pano: data.location.pano,
            pov: pov
              ? { heading: pov.heading, pitch: pov.pitch }
              : { heading: defaultHeading, pitch: 0 },
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
          listeners.push(panorama.addListener("pano_changed", syncPov));
          listeners.push(panorama.addListener("position_changed", syncPov));
          syncPov();
          if (!sessionTrackedRef.current) {
            sessionTrackedRef.current = true;
            void trackDynamicStreetViewSession({ interface: "publish_wizard", lat, lng });
          }
          setLoading(false);
        });
      })
      .catch(() => {
        if (!cancelled) {
          setLoadErr("No se pudo cargar Google Street View. Intenta de nuevo más tarde.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      for (const l of listeners) l.remove();
      panoramaRef.current = null;
    };
  }, [lat, lng]);

  if (loadErr) {
    return (
      <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-fg">
        {loadErr}
      </p>
    );
  }

  if (noImagery) {
    return (
      <p className="rounded-lg border border-border bg-surface-elevated px-3 py-4 text-sm text-muted">
        No hay vista de calle disponible para esta ubicación exacta.
      </p>
    );
  }

  return (
    <div className="relative w-full">
      <div
        ref={containerRef}
        className={`${heightClass} w-full overflow-hidden rounded-xl border border-border bg-surface`}
        aria-label="Editor de vista de calle"
      />
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-surface/85 text-sm text-muted">
          Cargando vista de calle…
        </div>
      ) : null}
    </div>
  );
}

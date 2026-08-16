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

/** Saved camera is for this pin if the panorama is within this distance. */
const POV_MATCH_RADIUS_M = 80;

function metersBetween(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function povMatchesPin(pov: StreetViewPov | null | undefined, lat: number, lng: number): boolean {
  if (!pov) return false;
  if (pov.panoLat == null || pov.panoLng == null) return false;
  if (!Number.isFinite(pov.panoLat) || !Number.isFinite(pov.panoLng)) return false;
  return metersBetween(pov.panoLat, pov.panoLng, lat, lng) <= POV_MATCH_RADIUS_M;
}

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
  const listenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const sessionTrackedRef = useRef(false);
  const onPovChangeRef = useRef(onPovChange);
  onPovChangeRef.current = onPovChange;
  const povRef = useRef(pov);
  povRef.current = pov;
  const requestIdRef = useRef(0);
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

    const requestId = ++requestIdRef.current;
    setLoadErr(null);
    setNoImagery(false);
    setLoading(true);

    let cancelled = false;

    const syncPov = () => {
      const panorama = panoramaRef.current;
      if (!panorama || requestIdRef.current !== requestId) return;
      onPovChangeRef.current(readPanoramaPov(panorama));
    };

    const bindListeners = (panorama: google.maps.StreetViewPanorama) => {
      for (const l of listenersRef.current) l.remove();
      listenersRef.current = [
        panorama.addListener("pov_changed", syncPov),
        panorama.addListener("zoom_changed", syncPov),
        panorama.addListener("pano_changed", syncPov),
        panorama.addListener("position_changed", syncPov),
      ];
    };

    void loadGoogleMapsScript()
      .then(() => {
        if (cancelled || requestId !== requestIdRef.current) return;
        if (!containerRef.current || !window.google?.maps) return;

        const service = new window.google.maps.StreetViewService();
        service.getPanorama({ location: { lat, lng }, radius: 100 }, (data, status) => {
          if (cancelled || requestId !== requestIdRef.current) return;
          if (!containerRef.current || !window.google?.maps) return;

          if (status !== window.google.maps.StreetViewStatus.OK || !data?.location?.latLng) {
            setNoImagery(true);
            setLoading(false);
            return;
          }

          setNoImagery(false);
          const defaultHeading = data.tiles?.centerHeading ?? 0;
          const panoId = data.location.pano?.trim();
          const reusePov = povMatchesPin(povRef.current, lat, lng);
          const nextPov = {
            heading: reusePov && povRef.current ? povRef.current.heading : defaultHeading,
            pitch: reusePov && povRef.current ? povRef.current.pitch : 0,
          };
          const nextZoom = reusePov && povRef.current ? povRef.current.zoom : 1;

          const existing = panoramaRef.current;
          if (existing) {
            if (panoId) existing.setPano(panoId);
            else existing.setPosition({ lat, lng });
            existing.setPov(nextPov);
            existing.setZoom(nextZoom);
            bindListeners(existing);
            syncPov();
            setLoading(false);
            return;
          }

          const panorama = new window.google.maps.StreetViewPanorama(containerRef.current, {
            position: { lat, lng },
            pano: panoId,
            pov: nextPov,
            zoom: nextZoom,
            addressControl: false,
            fullscreenControl: false,
            linksControl: true,
            panControl: true,
            zoomControl: true,
            motionTracking: false,
            motionTrackingControl: false,
          });
          if (panoId) panorama.setPano(panoId);
          else panorama.setPosition({ lat, lng });
          panoramaRef.current = panorama;
          bindListeners(panorama);
          syncPov();
          if (!sessionTrackedRef.current) {
            sessionTrackedRef.current = true;
            void trackDynamicStreetViewSession({ interface: "publish_wizard", lat, lng });
          }
          setLoading(false);
        });
      })
      .catch(() => {
        if (!cancelled && requestId === requestIdRef.current) {
          setLoadErr("No se pudo cargar Google Street View. Intenta de nuevo más tarde.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  useEffect(
    () => () => {
      for (const l of listenersRef.current) l.remove();
      listenersRef.current = [];
      panoramaRef.current = null;
    },
    [],
  );

  if (loadErr) {
    return (
      <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-fg">
        {loadErr}
      </p>
    );
  }

  return (
    <div className="relative w-full">
      <div
        ref={containerRef}
        className={`${heightClass} w-full overflow-hidden rounded-xl border border-border bg-surface ${
          noImagery ? "invisible" : ""
        }`}
        aria-label="Editor de vista de calle"
      />
      {noImagery ? (
        <p className="absolute inset-0 flex items-center justify-center rounded-xl border border-border bg-surface-elevated px-3 py-4 text-sm text-muted">
          No hay vista de calle disponible para esta ubicación exacta.
        </p>
      ) : null}
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-surface/85 text-sm text-muted">
          Cargando vista de calle…
        </div>
      ) : null}
    </div>
  );
}

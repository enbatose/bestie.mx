import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, InfoWindow, Map, Marker, useMap } from "@vis.gl/react-google-maps";
import { MapSelectionSync } from "@/components/map/MapSelectionSync";
import type { Bbox } from "@/lib/searchFilters";
import type { PropertyListing } from "@/types/listing";

type Props = {
  listings: PropertyListing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Full-bleed map inside split layout (no outer card radius). */
  embed?: boolean;
  className?: string;
  /** When true, debounced map `idle` reports viewport bounds. */
  searchOnMapMove?: boolean;
  onViewportBbox?: (bbox: Bbox) => void;
};

const MEXICO_CENTER = { lat: 20.8, lng: -99.5 };

const COLOR_SELECTED_STROKE = "#143D30";
const COLOR_SELECTED_FILL = "#84CC16";
const COLOR_STANDARD_STROKE = "#84CC16";
const COLOR_STANDARD_FILL = "#84CC16";

function MapResizeEffect() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const run = () => {
      try {
        google.maps.event.trigger(map, "resize");
      } catch {
        /* mid-teardown */
      }
    };
    run();
    const t1 = window.setTimeout(run, 50);
    const t2 = window.setTimeout(run, 300);
    const el = map.getDiv();
    const ro = new ResizeObserver(() => {
      window.requestAnimationFrame(run);
    });
    ro.observe(el);
    window.addEventListener("resize", run);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
      window.removeEventListener("resize", run);
    };
  }, [map]);
  return null;
}

function MapViewportReporter({
  enabled,
  onBbox,
}: {
  enabled: boolean;
  onBbox: (bbox: Bbox) => void;
}) {
  const map = useMap();
  const debounceRef = useRef<number>();
  const wasEnabledRef = useRef(false);

  const emit = useCallback(() => {
    if (!map) return;
    const b = map.getBounds();
    if (!b) return;
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    onBbox({ minLat: sw.lat(), minLng: sw.lng(), maxLat: ne.lat(), maxLng: ne.lng() });
  }, [map, onBbox]);

  useEffect(() => {
    if (enabled && !wasEnabledRef.current) {
      wasEnabledRef.current = true;
      window.setTimeout(() => emit(), 0);
    }
    if (!enabled) {
      wasEnabledRef.current = false;
    }
  }, [enabled, emit]);

  useEffect(() => {
    if (!map || !enabled) return;
    const listener = map.addListener("idle", () => {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => emit(), 400);
    });
    return () => {
      listener.remove();
      window.clearTimeout(debounceRef.current);
    };
  }, [map, enabled, emit]);

  return null;
}

function FitBoundsEffect({ listings }: { listings: PropertyListing[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const el = map.getDiv();
    if (!el?.isConnected) return;
    let idleOnce: google.maps.MapsEventListener | undefined;
    try {
      google.maps.event.trigger(map, "resize");
      if (!listings.length) {
        map.setCenter(MEXICO_CENTER);
        map.setZoom(5);
        return;
      }
      const bounds = new google.maps.LatLngBounds();
      for (const l of listings) {
        bounds.extend({ lat: l.lat, lng: l.lng });
      }
      map.fitBounds(bounds, 28);
      idleOnce = google.maps.event.addListenerOnce(map, "idle", () => {
        const z = map.getZoom();
        if (z != null && z > 14) map.setZoom(14);
      });
    } catch {
      /* map may be tearing down */
    }
    return () => {
      if (idleOnce) idleOnce.remove();
    };
  }, [listings, map]);
  return null;
}

function ListingPopupContent({ l }: { l: PropertyListing }) {
  return (
    <div className="max-w-[220px] text-body">
      <p className="text-sm font-semibold text-primary">{l.title}</p>
      <p className="mt-1 text-xs text-muted">
        {l.neighborhood}, {l.city}
      </p>
      <p className="mt-2 text-sm font-semibold">
        {new Intl.NumberFormat("es-MX", {
          style: "currency",
          currency: "MXN",
          maximumFractionDigits: 0,
        }).format(l.rentMxn)}
        <span className="text-xs font-normal text-muted"> / mes</span>
      </p>
    </div>
  );
}

function PointListingMarker({
  l,
  selected,
  popupOpen,
  onOpen,
  onClosePopup,
}: {
  l: PropertyListing;
  selected: boolean;
  popupOpen: boolean;
  onOpen: (id: string) => void;
  onClosePopup: () => void;
}) {
  return (
    <>
      <Marker
        position={{ lat: l.lat, lng: l.lng }}
        zIndex={selected ? 100 : 0}
        onClick={() => onOpen(l.id)}
      />
      {popupOpen ? (
        <InfoWindow position={{ lat: l.lat, lng: l.lng }} onCloseClick={onClosePopup}>
          <ListingPopupContent l={l} />
        </InfoWindow>
      ) : null}
    </>
  );
}

export function PropertyMap({
  listings,
  selectedId,
  onSelect,
  embed = false,
  className = "",
  searchOnMapMove = false,
  onViewportBbox,
}: Props) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const [popupId, setPopupId] = useState<string | null>(null);

  useEffect(() => {
    if (popupId && !listings.some((l) => l.id === popupId)) setPopupId(null);
  }, [listings, popupId]);

  const defaultCenter = useMemo(() => {
    if (!listings.length) return MEXICO_CENTER;
    let sumLat = 0;
    let sumLng = 0;
    for (const l of listings) {
      sumLat += l.lat;
      sumLng += l.lng;
    }
    return { lat: sumLat / listings.length, lng: sumLng / listings.length };
  }, [listings]);

  const mapKey = embed ? "property-map-embed" : listings.map((l) => l.id).join("|") || "empty";

  const shell = embed
    ? `min-h-0 overflow-hidden bg-surface-elevated ${className}`
    : `overflow-hidden rounded-2xl border border-border shadow-sm ${className}`;

  const mapHeight = embed
    ? "z-0 h-full min-h-0 w-full bg-surface-elevated"
    : "z-0 h-[min(52vh,420px)] w-full min-h-[280px] bg-surface-elevated";

  const handleMarkerOpen = useCallback(
    (id: string) => {
      onSelect(id);
      setPopupId(id);
    },
    [onSelect],
  );

  if (!apiKey) {
    return (
      <div className={`${shell} flex items-center justify-center px-4 text-center text-sm text-muted`}>
        <p>
          Configura <code className="rounded bg-surface px-1 font-mono text-xs">VITE_GOOGLE_MAPS_API_KEY</code> en{" "}
          <code className="rounded bg-surface px-1 font-mono text-xs">.env.local</code> (Maps JavaScript API y Geocoding
          API habilitadas para la clave) para ver el mapa. <code className="rounded bg-surface px-1 font-mono text-xs">npm run env:local</code>{" "}
          no borra esta variable si ya existe en el archivo.
        </p>
      </div>
    );
  }

  return (
    <div className={shell}>
      <Map
        key={mapKey}
        defaultCenter={defaultCenter}
        defaultZoom={11}
        gestureHandling="greedy"
        streetViewControl
        zoomControl
        mapTypeControl={false}
        className={mapHeight}
        aria-label="Mapa de anuncios"
        onClick={() => setPopupId(null)}
      >
        <MapResizeEffect />
        <FitBoundsEffect listings={listings} />
        {searchOnMapMove && onViewportBbox ? (
          <MapViewportReporter enabled={searchOnMapMove} onBbox={onViewportBbox} />
        ) : null}
        <MapSelectionSync selectedId={selectedId} listings={listings} />
        {listings.map((l) => {
          const selected = l.id === selectedId;
          const stroke = selected ? COLOR_SELECTED_STROKE : COLOR_STANDARD_STROKE;
          const fill = selected ? COLOR_SELECTED_FILL : COLOR_STANDARD_FILL;
          const weight = selected ? 3 : 2;

          if (l.isApproximateLocation) {
            return (
              <Fragment key={l.id}>
                <Circle
                  center={{ lat: l.lat, lng: l.lng }}
                  radius={500}
                  strokeColor={stroke}
                  strokeOpacity={1}
                  strokeWeight={weight}
                  fillColor={fill}
                  fillOpacity={0.25}
                  onClick={() => handleMarkerOpen(l.id)}
                />
                {popupId === l.id ? (
                  <InfoWindow
                    position={{ lat: l.lat, lng: l.lng }}
                    onCloseClick={() => setPopupId(null)}
                  >
                    <ListingPopupContent l={l} />
                  </InfoWindow>
                ) : null}
              </Fragment>
            );
          }

          return (
            <PointListingMarker
              key={l.id}
              l={l}
              selected={selected}
              popupOpen={popupId === l.id}
              onOpen={handleMarkerOpen}
              onClosePopup={() => setPopupId(null)}
            />
          );
        })}
      </Map>
    </div>
  );
}

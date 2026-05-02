import { useCallback, useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents, Circle } from "react-leaflet";
import L from "leaflet";
import { Link } from "react-router-dom";
import { MapSelectionSync } from "@/components/map/MapSelectionSync";
import { GUADALAJARA_LA_MINERVA_ZOOM } from "@/lib/searchDefaults";
import type { Bbox } from "@/lib/searchFilters";
import {
  ensureLeafletDefaultIcons,
  selectedMarkerIcon,
  standardMarkerIcon,
} from "@/map/leafletIcons";
import type { PropertyListing } from "@/types/listing";

type Props = {
  listings: PropertyListing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Full-bleed map inside split layout (no outer card radius). */
  embed?: boolean;
  className?: string;
  /** When true, debounced map `moveend` reports viewport bounds. */
  searchOnMapMove?: boolean;
  onViewportBbox?: (bbox: Bbox) => void;
  defaultCenter?: [number, number];
  defaultZoom?: number;
  preferDefaultView?: boolean;
};

const MEXICO_CENTER: [number, number] = [20.8, -99.5];

/** Leaflet caches pixel bounds at init; flex/absolute layouts often finish sizing later — reflow tiles after resize. */
function MapResizeInvalidate() {
  const map = useMap();
  useEffect(() => {
    const run = () => {
      try {
        map.invalidateSize({ animate: false });
      } catch {
        /* mid-teardown */
      }
    };
    run();
    const t1 = window.setTimeout(run, 50);
    const t2 = window.setTimeout(run, 300);
    const el = map.getContainer();
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
    const b = map.getBounds();
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    onBbox({ minLat: sw.lat, minLng: sw.lng, maxLat: ne.lat, maxLng: ne.lng });
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

  useMapEvents({
    moveend() {
      if (!enabled) return;
      window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => emit(), 400);
    },
  });

  useEffect(
    () => () => {
      window.clearTimeout(debounceRef.current);
    },
    [],
  );

  return null;
}

function FitBounds({
  bounds,
  defaultCenter,
  defaultZoom,
  preferDefaultView = false,
}: {
  bounds: L.LatLngBounds | null;
  defaultCenter?: [number, number];
  defaultZoom?: number;
  preferDefaultView?: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    if (!el?.isConnected) return;
    try {
      map.invalidateSize({ animate: false });
      if (preferDefaultView && defaultCenter) {
        map.setView(defaultCenter, defaultZoom ?? GUADALAJARA_LA_MINERVA_ZOOM);
      } else if (bounds?.isValid()) {
        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
      } else if (defaultCenter) {
        map.setView(defaultCenter, defaultZoom ?? GUADALAJARA_LA_MINERVA_ZOOM);
      } else {
        map.setView(MEXICO_CENTER, 5);
      }
    } catch {
      /* map may be tearing down (React StrictMode / route change) */
    }
  }, [bounds, defaultCenter, defaultZoom, map, preferDefaultView]);
  return null;
}

export function PropertyMap({
  listings,
  selectedId,
  onSelect,
  embed = false,
  className = "",
  searchOnMapMove = false,
  onViewportBbox,
  defaultCenter,
  defaultZoom,
  preferDefaultView = false,
}: Props) {
  useEffect(() => {
    ensureLeafletDefaultIcons();
  }, []);

  const bounds = useMemo(() => {
    if (!listings.length) return null;
    const latLngs = listings.map((l) => [l.lat, l.lng] as [number, number]);
    return L.latLngBounds(latLngs);
  }, [listings]);

  const center = useMemo((): [number, number] => {
    if (preferDefaultView && defaultCenter) return defaultCenter;
    if (bounds) return bounds.getCenter();
    if (defaultCenter) return defaultCenter;
    return MEXICO_CENTER;
  }, [bounds, defaultCenter, preferDefaultView]);

  const zoom = preferDefaultView && defaultZoom != null ? defaultZoom : 11;

  const shell = embed
    ? `min-h-0 overflow-hidden bg-surface-elevated ${className}`
    : `overflow-hidden rounded-2xl border border-border shadow-sm ${className}`;

  const mapHeight = embed
    ? "z-0 h-full min-h-0 w-full bg-surface-elevated [&_.leaflet-control-attribution]:text-[10px]"
    : "z-0 h-[min(52vh,420px)] w-full min-h-[280px] bg-surface-elevated [&_.leaflet-control-attribution]:text-[10px]";

  return (
    <div className={shell}>
      <MapContainer
        key={embed ? "property-map-embed" : listings.map((l) => l.id).join("|") || "empty"}
        center={center}
        zoom={zoom}
        className={mapHeight}
        scrollWheelZoom
        aria-label="Mapa de anuncios"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapResizeInvalidate />
        <FitBounds
          bounds={bounds}
          defaultCenter={defaultCenter}
          defaultZoom={defaultZoom}
          preferDefaultView={preferDefaultView}
        />
        {searchOnMapMove && onViewportBbox ? (
          <MapViewportReporter enabled={searchOnMapMove} onBbox={onViewportBbox} />
        ) : null}
        <MapSelectionSync selectedId={selectedId} listings={listings} />
        {listings.map((l) => {
          const selected = l.id === selectedId;
          const popupContent = (
            <Popup>
              <div className="max-w-[220px] text-body">
                <Link
                  to={`/anuncio/${l.id}`}
                  className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
                >
                  {l.title}
                </Link>
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
            </Popup>
          );

          if (l.isApproximateLocation) {
            return (
              <Circle
                key={l.id}
                center={[l.lat, l.lng]}
                radius={200}
                pathOptions={{ 
                  color: selected ? "var(--color-primary)" : "#84CC16", 
                  fillColor: selected ? "var(--color-primary)" : "#84CC16", 
                  fillOpacity: 0.25, 
                  weight: selected ? 3 : 2 
                }}
                eventHandlers={{ click: () => onSelect(l.id) }}
              >
                {popupContent}
              </Circle>
            );
          }

          return (
            <Marker
              key={l.id}
              position={[l.lat, l.lng]}
              eventHandlers={{ click: () => onSelect(l.id) }}
              zIndexOffset={selected ? 700 : 0}
              icon={selected ? selectedMarkerIcon : standardMarkerIcon}
            >
              {popupContent}
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

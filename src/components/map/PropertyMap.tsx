import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { MapSelectionSync } from "@/components/map/MapSelectionSync";
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
};

const MEXICO_CENTER: [number, number] = [20.8, -99.5];

function FitBounds({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    if (!el?.isConnected) return;
    try {
      if (bounds?.isValid()) {
        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
      } else {
        map.setView(MEXICO_CENTER, 5);
      }
    } catch {
      /* map may be tearing down (React StrictMode / route change) */
    }
  }, [bounds, map]);
  return null;
}

export function PropertyMap({
  listings,
  selectedId,
  onSelect,
  embed = false,
  className = "",
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
    if (bounds) return bounds.getCenter();
    return MEXICO_CENTER;
  }, [bounds]);

  const shell = embed
    ? `overflow-hidden bg-surface-elevated ${className}`
    : `overflow-hidden rounded-2xl border border-border shadow-sm ${className}`;

  const mapHeight = embed
    ? "z-0 h-full min-h-[260px] w-full bg-surface-elevated [&_.leaflet-control-attribution]:text-[10px]"
    : "z-0 h-[min(52vh,420px)] w-full min-h-[280px] bg-surface-elevated [&_.leaflet-control-attribution]:text-[10px]";

  return (
    <div className={shell}>
      <MapContainer
        key={listings.map((l) => l.id).join("|") || "empty"}
        center={center}
        zoom={11}
        className={mapHeight}
        scrollWheelZoom
        aria-label="Mapa de anuncios"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds bounds={bounds} />
        <MapSelectionSync selectedId={selectedId} listings={listings} />
        {listings.map((l) => {
          const selected = l.id === selectedId;
          return (
            <Marker
              key={l.id}
              position={[l.lat, l.lng]}
              eventHandlers={{ click: () => onSelect(l.id) }}
              zIndexOffset={selected ? 700 : 0}
              icon={selected ? selectedMarkerIcon : standardMarkerIcon}
            >
              <Popup>
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
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

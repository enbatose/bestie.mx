import { MapContainer, Marker, TileLayer, useMapEvents, Circle } from "react-leaflet";
import L from "leaflet";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

type Props = {
  center: [number, number];
  position: [number, number];
  onPositionChange: (lat: number, lng: number) => void;
};

/** External Street View tab only — the embedded map stays Leaflet/OSM (no Maps JavaScript API). */
function streetViewExternalUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
}

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function WizardLocationMap({ center, position, onPositionChange }: Props) {
  const [lat, lng] = position;
  const streetViewHref = googleStreetViewUrl(lat, lng);

  return (
    <div className="space-y-2">
      <MapContainer
        center={center}
        zoom={13}
        className="z-0 w-full overflow-hidden rounded-xl border border-border shadow-sm"
        style={{ height: 288 }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickToPlace onPick={onPositionChange} />
        <Marker
          position={position}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng();
              onPositionChange(ll.lat, ll.lng);
            },
          }}
        />
        <Circle
          center={position}
          radius={500}
          pathOptions={{ color: "#84CC16", fillColor: "#84CC16", fillOpacity: 0.15, weight: 2 }}
        />
      </MapContainer>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-elevated/60 px-3 py-2 text-sm">
        <span className="text-xs text-muted">
          El mapa es OpenStreetMap. Vista de calle: enlace a una pestaña nueva (sin API key).
        </span>
        <a
          href={streetViewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/15"
          aria-label="Abrir Street View en la ubicación del pin"
        >
          Ver vista de calle
        </a>
      </div>
    </div>
  );
}

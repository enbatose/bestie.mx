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

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function WizardLocationMap({ center, position, onPositionChange }: Props) {
  return (
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
  );
}

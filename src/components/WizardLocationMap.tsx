import { MapContainer, Marker, TileLayer, Circle } from "react-leaflet";
import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

type Props = {
  center: [number, number];
  position: [number, number];
  hasDefinedLocation: boolean;
  locationLabel: string | null;
  onPositionChange: (lat: number, lng: number) => void;
  /** When true, show the ~200 m privacy radius circle; otherwise only the draggable pin. */
  showApproximateRadius?: boolean;
};

/** External Street View tab only — the embedded map stays Leaflet/OSM (no Maps JavaScript API). */
function streetViewExternalUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
}

export function WizardLocationMap({
  center,
  position,
  hasDefinedLocation,
  locationLabel,
  onPositionChange,
  showApproximateRadius = false,
}: Props) {
  const [localPosition, setLocalPosition] = useState(position);
  const [localLocationSelected, setLocalLocationSelected] = useState(hasDefinedLocation);
  const [lat, lng] = localPosition;
  const streetViewHref = streetViewExternalUrl(lat, lng);
  const markerRef = useRef<L.Marker | null>(null);
  const markerWasDraggedRef = useRef(false);

  useEffect(() => {
    setLocalPosition(position);
    setLocalLocationSelected(hasDefinedLocation);
  }, [position, hasDefinedLocation]);

  const commitMarkerPosition = useCallback(
    (marker?: L.Marker | null) => {
      const ll = (marker ?? markerRef.current)?.getLatLng();
      if (!ll) return;
      setLocalPosition([ll.lat, ll.lng]);
      setLocalLocationSelected(true);
      onPositionChange(ll.lat, ll.lng);
    },
    [onPositionChange],
  );

  const markerEventHandlers = useMemo(
    () => ({
      dragstart: () => {
        markerWasDraggedRef.current = true;
      },
      dragend: (e: L.LeafletEvent) => {
        markerWasDraggedRef.current = false;
        commitMarkerPosition(e.target as L.Marker);
      },
      mouseup: (e: L.LeafletEvent) => {
        if (!markerWasDraggedRef.current) return;
        markerWasDraggedRef.current = false;
        commitMarkerPosition(e.target as L.Marker);
      },
      touchend: (e: L.LeafletEvent) => {
        if (!markerWasDraggedRef.current) return;
        markerWasDraggedRef.current = false;
        commitMarkerPosition(e.target as L.Marker);
      },
    }),
    [commitMarkerPosition],
  );

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
        {showApproximateRadius ? (
          <Circle
            center={localPosition}
            radius={200}
            pathOptions={{ color: "#84CC16", fillColor: "#84CC16", fillOpacity: 0.15, weight: 2 }}
            interactive={false}
          />
        ) : null}
        <Marker
          ref={markerRef}
          position={localPosition}
          draggable
          riseOnHover
          zIndexOffset={1000}
          eventHandlers={markerEventHandlers}
        />
      </MapContainer>
      <p className="text-xs text-muted">
        <strong className="font-semibold text-body">Tip</strong>: Los clics en el mapa no mueven el pin.
      </p>
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-elevated/60 px-3 py-2 text-sm">
        {localLocationSelected ? (
          <div className="flex items-start gap-2 font-medium text-primary">
            <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="min-w-0 break-words">
              {locationLabel ?? "Buscando dirección para la ubicación seleccionada..."}
            </span>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-body">¿No estás seguro de la ubicación?</span>
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
    </div>
  );
}

import { Circle, Map, Marker } from "@vis.gl/react-google-maps";
import { useMemo } from "react";

type Props = {
  center: [number, number];
  position: [number, number];
  onPositionChange: (lat: number, lng: number) => void;
};

export function WizardLocationMap({ center, position, onPositionChange }: Props) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const defaultCenter = useMemo(() => ({ lat: center[0], lng: center[1] }), [center[0], center[1]]);
  const markerPosition = useMemo(() => ({ lat: position[0], lng: position[1] }), [position[0], position[1]]);

  if (!apiKey) {
    return (
      <div
        className="flex w-full flex-col justify-center gap-2 rounded-xl border border-border bg-surface-elevated/60 px-4 py-6 text-center text-sm text-muted"
        style={{ minHeight: 288 }}
      >
        <p className="font-medium text-body">Mapa de Google no disponible</p>
        <p>
          Agrega <code className="rounded bg-surface px-1 font-mono text-xs">VITE_GOOGLE_MAPS_API_KEY</code> en{" "}
          <code className="rounded bg-surface px-1 font-mono text-xs">.env.local</code> (clave de navegador con{" "}
          <span className="font-medium text-body">Maps JavaScript API</span> y{" "}
          <span className="font-medium text-body">Geocoding API</span> habilitadas) y reinicia{" "}
          <code className="rounded bg-surface px-1 font-mono text-xs">npm run dev</code>.{" "}
          <code className="rounded bg-surface px-1 font-mono text-xs">npm run env:local</code> conserva esta variable si
          ya estaba en el archivo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Map
        defaultCenter={defaultCenter}
        defaultZoom={13}
        gestureHandling="greedy"
        streetViewControl
        zoomControl
        mapTypeControl={false}
        className="z-0 w-full overflow-hidden rounded-xl border border-border shadow-sm"
        style={{ height: 288 }}
        onClick={(e) => {
          const ll = e.detail.latLng;
          if (ll) onPositionChange(ll.lat, ll.lng);
        }}
      >
        <Marker
          position={markerPosition}
          draggable
          onDragEnd={(e) => {
            const ll = e.detail.latLng;
            if (ll) onPositionChange(ll.lat, ll.lng);
          }}
        />
        <Circle
          center={markerPosition}
          radius={500}
          strokeColor="#84CC16"
          strokeOpacity={1}
          strokeWeight={2}
          fillColor="#84CC16"
          fillOpacity={0.15}
        />
      </Map>
      <p className="text-xs text-muted">
        Usa el control de Street View (figura amarilla) o arrastra el pin para ajustar la ubicación.
      </p>
    </div>
  );
}

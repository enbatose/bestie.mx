import { MapContainer, Marker, TileLayer, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  APPROXIMATE_LOCATION_RADIUS_DEFAULT_M,
  clampApproximateRadiusMeters,
} from "@/lib/approximateLocationRadius";

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
  /** When true, show a radius circle around the pin. */
  showApproximateRadius?: boolean;
  /** Circle radius in meters (default 200 for wizard privacy). */
  approximateRadiusMeters?: number;
  /** Allow dragging a handle on the circle edge (and a slider) to change the radius. */
  radiusEditable?: boolean;
  onRadiusChange?: (meters: number) => void;
  /** Show draggable pin even when the radius circle is visible. */
  forceDraggablePin?: boolean;
  /** Hide tip and address footer (embedded preview). */
  embed?: boolean;
  /** Map height in px or CSS length (default 288). */
  mapHeight?: number | string;
};

/** Circle styling for approximate / privacy radius (brand green). */
export const MAP_PRIVACY_CIRCLE_PATH = {
  color: "#84CC16",
  fillColor: "#84CC16",
  fillOpacity: 0.15,
  weight: 2,
} as const;

/** @deprecated Prefer APPROXIMATE_LOCATION_RADIUS_DEFAULT_M from lib. */
export const WIZARD_APPROXIMATE_RADIUS_M = APPROXIMATE_LOCATION_RADIUS_DEFAULT_M;

/**
 * Fallback visual radius for approximate location when a listing has no stored value.
 * Kept for older call sites; new code should use resolveApproximateRadiusMeters.
 */
export const PREVIEW_APPROXIMATE_RADIUS_M = APPROXIMATE_LOCATION_RADIUS_DEFAULT_M;

const RADIUS_HANDLE_ICON = L.divIcon({
  className: "bestie-privacy-radius-handle",
  html: `<span style="
    display:block;
    width:18px;
    height:18px;
    margin:-9px 0 0 -9px;
    border-radius:9999px;
    background:#84CC16;
    border:2px solid #fff;
    box-shadow:0 1px 4px rgba(20,61,48,0.35);
    cursor:grab;
  "></span>`,
  iconSize: [18, 18],
  iconAnchor: [0, 0],
});

function metersToLatLngOffset(
  center: [number, number],
  meters: number,
  bearingRad: number,
): [number, number] {
  const northM = meters * Math.cos(bearingRad);
  const eastM = meters * Math.sin(bearingRad);
  const dLat = northM / 111_320;
  const cosLat = Math.cos((center[0] * Math.PI) / 180);
  const dLng = eastM / (111_320 * Math.max(cosLat, 1e-6));
  return [center[0] + dLat, center[1] + dLng];
}

function pointOnCircleToward(
  center: [number, number],
  toward: L.LatLng,
  meters: number,
): [number, number] {
  const from = L.latLng(center[0], center[1]);
  const dist = from.distanceTo(toward);
  if (dist < 1) return metersToLatLngOffset(center, meters, Math.PI / 2);
  const bearing = Math.atan2(toward.lng - center[1], toward.lat - center[0]);
  return metersToLatLngOffset(center, meters, bearing);
}

function MapViewSync({
  position,
  zoom,
  skipFlyRef,
}: {
  position: [number, number];
  zoom: number;
  skipFlyRef: React.MutableRefObject<boolean>;
}) {
  const map = useMap();
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const key = `${position[0].toFixed(7)},${position[1].toFixed(7)}`;
    if (lastKeyRef.current === key) return;

    const isInitial = lastKeyRef.current === null;
    lastKeyRef.current = key;

    if (skipFlyRef.current) {
      skipFlyRef.current = false;
      return;
    }

    try {
      if (isInitial) {
        map.setView(position, zoom, { animate: false });
      } else {
        map.flyTo(position, zoom, { duration: 0.75 });
      }
    } catch {
      /* map tearing down */
    }
  }, [map, position, skipFlyRef, zoom]);

  return null;
}

function PrivacyRadiusHandle({
  center,
  radiusMeters,
  onRadiusChange,
}: {
  center: [number, number];
  radiusMeters: number;
  onRadiusChange: (meters: number) => void;
}) {
  const markerRef = useRef<L.Marker | null>(null);
  const draggingRef = useRef(false);
  const [handlePos, setHandlePos] = useState<[number, number]>(() =>
    metersToLatLngOffset(center, radiusMeters, Math.PI / 2),
  );

  useEffect(() => {
    if (draggingRef.current) return;
    setHandlePos(metersToLatLngOffset(center, radiusMeters, Math.PI / 2));
  }, [center, radiusMeters]);

  const commitFromLatLng = useCallback(
    (ll: L.LatLng) => {
      const dist = L.latLng(center[0], center[1]).distanceTo(ll);
      const next = clampApproximateRadiusMeters(dist);
      const snapped = pointOnCircleToward(center, ll, next);
      setHandlePos(snapped);
      onRadiusChange(next);
      return snapped;
    },
    [center, onRadiusChange],
  );

  const eventHandlers = useMemo(
    () => ({
      dragstart: () => {
        draggingRef.current = true;
      },
      drag: (e: L.LeafletEvent) => {
        const marker = e.target as L.Marker;
        const snapped = commitFromLatLng(marker.getLatLng());
        marker.setLatLng(snapped);
      },
      dragend: (e: L.LeafletEvent) => {
        draggingRef.current = false;
        const marker = e.target as L.Marker;
        const snapped = commitFromLatLng(marker.getLatLng());
        marker.setLatLng(snapped);
      },
    }),
    [commitFromLatLng],
  );

  return (
    <Marker
      ref={markerRef}
      position={handlePos}
      draggable
      icon={RADIUS_HANDLE_ICON}
      zIndexOffset={1100}
      eventHandlers={eventHandlers}
      title="Arrastra para ajustar el radio de privacidad"
    />
  );
}

export function WizardLocationMap({
  center,
  position,
  hasDefinedLocation,
  locationLabel,
  onPositionChange,
  showApproximateRadius = false,
  approximateRadiusMeters = APPROXIMATE_LOCATION_RADIUS_DEFAULT_M,
  radiusEditable = false,
  onRadiusChange,
  forceDraggablePin = false,
  embed = false,
  mapHeight = 288,
}: Props) {
  const [localPosition, setLocalPosition] = useState(position);
  const [localLocationSelected, setLocalLocationSelected] = useState(hasDefinedLocation);
  const [localRadius, setLocalRadius] = useState(() =>
    clampApproximateRadiusMeters(approximateRadiusMeters),
  );
  const markerRef = useRef<L.Marker | null>(null);
  const markerWasDraggedRef = useRef(false);
  const skipFlyRef = useRef(false);
  const showMarker = forceDraggablePin || !showApproximateRadius || radiusEditable;
  const canEditRadius = Boolean(showApproximateRadius && radiusEditable && onRadiusChange);
  const circleRadius = canEditRadius
    ? localRadius
    : clampApproximateRadiusMeters(approximateRadiusMeters);

  useEffect(() => {
    setLocalPosition(position);
    setLocalLocationSelected(hasDefinedLocation);
  }, [position, hasDefinedLocation]);

  useEffect(() => {
    setLocalRadius(clampApproximateRadiusMeters(approximateRadiusMeters));
  }, [approximateRadiusMeters]);

  const commitMarkerPosition = useCallback(
    (marker?: L.Marker | null) => {
      const ll = (marker ?? markerRef.current)?.getLatLng();
      if (!ll) return;
      setLocalPosition([ll.lat, ll.lng]);
      setLocalLocationSelected(true);
      skipFlyRef.current = true;
      onPositionChange(ll.lat, ll.lng);
    },
    [onPositionChange],
  );

  const commitRadius = useCallback(
    (meters: number) => {
      const next = clampApproximateRadiusMeters(meters);
      setLocalRadius(next);
      onRadiusChange?.(next);
    },
    [onRadiusChange],
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

  const mapHeightStyle = typeof mapHeight === "number" ? `${mapHeight}px` : mapHeight;

  return (
    <div className={embed ? "" : "space-y-2"}>
      <MapContainer
        center={center}
        zoom={13}
        className="z-0 w-full overflow-hidden rounded-xl border border-border shadow-sm"
        style={{ height: mapHeightStyle }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewSync position={localPosition} zoom={13} skipFlyRef={skipFlyRef} />
        {showApproximateRadius ? (
          <Circle
            center={localPosition}
            radius={circleRadius}
            pathOptions={MAP_PRIVACY_CIRCLE_PATH}
            interactive={false}
          />
        ) : null}
        {canEditRadius ? (
          <PrivacyRadiusHandle
            center={localPosition}
            radiusMeters={localRadius}
            onRadiusChange={commitRadius}
          />
        ) : null}
        {showMarker ? (
          <Marker
            ref={markerRef}
            position={localPosition}
            draggable
            riseOnHover
            zIndexOffset={1000}
            eventHandlers={markerEventHandlers}
          />
        ) : null}
      </MapContainer>

      {embed ? null : (
        <>
          <p className="text-xs text-muted">
            <strong className="font-semibold text-body">Tip</strong>:{" "}
            {canEditRadius
              ? "Arrastra el pin para ubicar la propiedad y el punto verde del perímetro para ajustar el radio. Los clics en el mapa no mueven el pin."
              : "Los clics en el mapa no mueven el pin."}
          </p>
          {localLocationSelected ? (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-elevated/60 px-3 py-2 text-sm font-medium text-primary">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="min-w-0 break-words">
                {locationLabel ?? "Buscando dirección para la ubicación seleccionada..."}
              </span>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

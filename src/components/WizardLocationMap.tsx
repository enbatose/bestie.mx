import {
  AttributionControl,
  MapContainer,
  Marker,
  TileLayer,
  Circle,
  useMap,
  ZoomControl,
} from "react-leaflet";
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
  /** When true, show a radius circle around the location (no pin unless forced). */
  showApproximateRadius?: boolean;
  /** Circle radius in meters (default 200 for wizard privacy). */
  approximateRadiusMeters?: number;
  /**
   * When privacy circle is shown, allow dragging the disk to place the location
   * (same role as the pin when exact address is visible).
   */
  radiusEditable?: boolean;
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

const MAP_PRIVACY_CIRCLE_DRAGGABLE_PATH = {
  ...MAP_PRIVACY_CIRCLE_PATH,
  className: "bestie-privacy-circle-draggable",
} as const;

/** @deprecated Prefer APPROXIMATE_LOCATION_RADIUS_DEFAULT_M from lib. */
export const WIZARD_APPROXIMATE_RADIUS_M = APPROXIMATE_LOCATION_RADIUS_DEFAULT_M;

/**
 * Fallback visual radius for approximate location when a listing has no stored value.
 * Kept for older call sites; new code should use resolveApproximateRadiusMeters.
 */
export const PREVIEW_APPROXIMATE_RADIUS_M = APPROXIMATE_LOCATION_RADIUS_DEFAULT_M;

const MAP_MAX_ZOOM = 18;
const PIN_EDGE_PADDING_PX = 40;
const CIRCLE_EDGE_PADDING_PX = 12;

function latLngFromClient(
  map: L.Map,
  clientX: number,
  clientY: number,
): L.LatLng {
  const rect = map.getContainer().getBoundingClientRect();
  return map.containerPointToLatLng(L.point(clientX - rect.left, clientY - rect.top));
}

function circleLatLngBounds(center: L.LatLngExpression, radiusMeters: number): L.LatLngBounds {
  return L.circle(center, { radius: radiusMeters }).getBounds();
}

/** Highest zoom where the full privacy circle still fits in the map viewport. */
function maxZoomForCircleInView(
  map: L.Map,
  center: L.LatLngExpression,
  radiusMeters: number,
  paddingPx: number,
): number {
  const size = map.getSize();
  const availW = size.x - 2 * paddingPx;
  const availH = size.y - 2 * paddingPx;
  if (availW <= 8 || availH <= 8) return map.getMinZoom();

  const bounds = circleLatLngBounds(center, radiusMeters);
  const minZ = map.getMinZoom();
  for (let z = MAP_MAX_ZOOM; z >= minZ; z -= 1) {
    const nw = map.project(bounds.getNorthWest(), z);
    const se = map.project(bounds.getSouthEast(), z);
    const w = Math.abs(se.x - nw.x);
    const h = Math.abs(se.y - nw.y);
    if (w <= availW && h <= availH) return z;
  }
  return minZ;
}

/** Pixel inset so panInside keeps the full circle (not just the center) on screen. */
function circlePanPaddingPx(
  map: L.Map,
  center: L.LatLngExpression,
  radiusMeters: number,
  edgePaddingPx: number,
): { padX: number; padY: number } {
  const bounds = circleLatLngBounds(center, radiusMeters);
  const nw = map.latLngToContainerPoint(bounds.getNorthWest());
  const se = map.latLngToContainerPoint(bounds.getSouthEast());
  return {
    padX: Math.abs(se.x - nw.x) / 2 + edgePaddingPx,
    padY: Math.abs(se.y - nw.y) / 2 + edgePaddingPx,
  };
}

function clampCircleFullyVisible(
  map: L.Map,
  center: L.LatLngExpression,
  radiusMeters: number,
  paddingPx: number,
): void {
  const { padX, padY } = circlePanPaddingPx(map, center, radiusMeters, paddingPx);
  const size = map.getSize();
  // Circle larger than the view: center it (max zoom should normally prevent this).
  if (padX * 2 >= size.x - 2 || padY * 2 >= size.y - 2) {
    map.panTo(L.latLng(center), { animate: false });
    return;
  }
  // Same API as the pin clamp — padding equals circle radius in screen px.
  map.panInside(L.latLng(center), {
    paddingTopLeft: [padX, padY],
    paddingBottomRight: [padX, padY],
    animate: false,
  });
}

/** Keep a dragged circle center far enough from the edges that the disk stays in view. */
function clampLatLngToKeepCircleInView(
  map: L.Map,
  center: L.LatLngExpression,
  radiusMeters: number,
  paddingPx: number,
): L.LatLng {
  const { padX, padY } = circlePanPaddingPx(map, center, radiusMeters, paddingPx);
  const size = map.getSize();
  const minX = padX;
  const maxX = size.x - padX;
  const minY = padY;
  const maxY = size.y - padY;
  if (maxX <= minX || maxY <= minY) {
    return map.getCenter();
  }
  const pt = map.latLngToContainerPoint(center);
  const x = Math.min(maxX, Math.max(minX, pt.x));
  const y = Math.min(maxY, Math.max(minY, pt.y));
  if (x === pt.x && y === pt.y) return L.latLng(center);
  return map.containerPointToLatLng(L.point(x, y));
}

function clampPinVisible(map: L.Map, position: L.LatLngExpression, paddingPx: number): void {
  // Default marker tip is at latlng; the icon extends upward.
  const padTop = paddingPx + 24;
  const padBottom = Math.max(16, paddingPx - 8);
  const padX = paddingPx;
  map.panInside(L.latLng(position), {
    paddingTopLeft: [padX, padTop],
    paddingBottomRight: [padX, padBottom],
    animate: false,
  });
}

/**
 * Keeps the location pin (or full privacy circle — Option A) inside the visible map.
 * Caps max zoom when a circle is shown so the whole perimeter always fits.
 */
function KeepLocationInView({
  position,
  radiusMeters,
  suppressClampRef,
}: {
  position: [number, number];
  /** When set, the entire circle must stay in view. */
  radiusMeters: number | null;
  suppressClampRef: React.MutableRefObject<boolean>;
}) {
  const map = useMap();
  const clampingRef = useRef(false);

  const apply = useCallback(() => {
    if (clampingRef.current || suppressClampRef.current) return;
    const size = map.getSize();
    if (size.x < 8 || size.y < 8) return;

    clampingRef.current = true;
    try {
      if (radiusMeters != null && radiusMeters > 0) {
        const padding = CIRCLE_EDGE_PADDING_PX;
        const maxZ = maxZoomForCircleInView(map, position, radiusMeters, padding);
        if (map.getMaxZoom() !== maxZ) {
          map.setMaxZoom(maxZ);
        }
        if (map.getZoom() > maxZ) {
          map.setZoom(maxZ, { animate: false });
        }
        clampCircleFullyVisible(map, position, radiusMeters, padding);
      } else {
        if (map.getMaxZoom() !== MAP_MAX_ZOOM) {
          map.setMaxZoom(MAP_MAX_ZOOM);
        }
        clampPinVisible(map, position, PIN_EDGE_PADDING_PX);
      }
    } catch {
      /* map tearing down */
    } finally {
      clampingRef.current = false;
    }
  }, [map, position, radiusMeters, suppressClampRef]);

  useEffect(() => {
    // `drag` = hard edge while panning (does not fire during flyTo).
    // `moveend`/`zoomend` = settle after fly, zoom, or programmatic moves.
    // Max zoom is capped so the circle cannot be zoomed past fitting the viewport.
    apply();
    map.on("drag", apply);
    map.on("moveend", apply);
    map.on("zoomend", apply);
    map.on("resize", apply);
    return () => {
      map.off("drag", apply);
      map.off("moveend", apply);
      map.off("zoomend", apply);
      map.off("resize", apply);
    };
  }, [map, apply]);

  return null;
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
      const targetZoom = Math.min(zoom, map.getMaxZoom());
      if (isInitial) {
        map.setView(position, targetZoom, { animate: false });
      } else {
        map.flyTo(position, targetZoom, { duration: 0.75 });
      }
    } catch {
      /* map tearing down */
    }
  }, [map, position, skipFlyRef, zoom]);

  return null;
}

/** Privacy disk that can be dragged to reposition the true location (no pin). */
function DraggablePrivacyCircle({
  center,
  radiusMeters,
  onDragMove,
  onDragEnd,
  suppressClampRef,
}: {
  center: [number, number];
  radiusMeters: number;
  onDragMove: (lat: number, lng: number) => void;
  onDragEnd: (lat: number, lng: number) => void;
  suppressClampRef: React.MutableRefObject<boolean>;
}) {
  const map = useMap();
  const circleRef = useRef<L.Circle | null>(null);
  const dragRef = useRef<{
    originPointer: L.LatLng;
    originCenter: L.LatLng;
  } | null>(null);

  useEffect(() => {
    const circle = circleRef.current;
    if (!circle) return;

    const applyDelta = (pointer: L.LatLng) => {
      const drag = dragRef.current;
      if (!drag) return null;
      const raw = L.latLng(
        drag.originCenter.lat + (pointer.lat - drag.originPointer.lat),
        drag.originCenter.lng + (pointer.lng - drag.originPointer.lng),
      );
      // Stop the disk at the map edge so the full radius stays visible (Option A).
      const next = clampLatLngToKeepCircleInView(
        map,
        raw,
        radiusMeters,
        CIRCLE_EDGE_PADDING_PX,
      );
      circle.setLatLng(next);
      return next;
    };

    const endDrag = () => {
      if (!dragRef.current) return;
      const ll = circle.getLatLng();
      dragRef.current = null;
      suppressClampRef.current = false;
      map.dragging.enable();
      map.getContainer().style.cursor = "";
      onDragEnd(ll.lat, ll.lng);
    };

    const startDrag = (pointer: L.LatLng, ev: Event) => {
      L.DomEvent.stopPropagation(ev);
      L.DomEvent.preventDefault(ev);
      suppressClampRef.current = true;
      map.dragging.disable();
      map.getContainer().style.cursor = "grabbing";
      dragRef.current = {
        originPointer: pointer,
        originCenter: circle.getLatLng(),
      };
    };

    const onMouseDown = (e: L.LeafletMouseEvent) => {
      startDrag(e.latlng, e.originalEvent);
    };

    const onMouseMove = (e: L.LeafletMouseEvent) => {
      if (!dragRef.current) return;
      L.DomEvent.stopPropagation(e);
      const next = applyDelta(e.latlng);
      if (next) onDragMove(next.lat, next.lng);
    };

    circle.on("mousedown", onMouseDown);
    map.on("mousemove", onMouseMove);
    map.on("mouseup", endDrag);

    const pathEl = circle.getElement();
    const onTouchStart = (ev: TouchEvent) => {
      if (ev.touches.length !== 1) return;
      const t = ev.touches[0]!;
      startDrag(latLngFromClient(map, t.clientX, t.clientY), ev);
    };
    const onTouchMove = (ev: TouchEvent) => {
      if (!dragRef.current || ev.touches.length !== 1) return;
      const t = ev.touches[0]!;
      L.DomEvent.preventDefault(ev);
      const next = applyDelta(latLngFromClient(map, t.clientX, t.clientY));
      if (next) onDragMove(next.lat, next.lng);
    };

    if (pathEl) {
      pathEl.style.cursor = "grab";
      pathEl.addEventListener("touchstart", onTouchStart, { passive: false });
      pathEl.addEventListener("touchmove", onTouchMove, { passive: false });
      pathEl.addEventListener("touchend", endDrag);
      pathEl.addEventListener("touchcancel", endDrag);
    }

    return () => {
      circle.off("mousedown", onMouseDown);
      map.off("mousemove", onMouseMove);
      map.off("mouseup", endDrag);
      if (pathEl) {
        pathEl.removeEventListener("touchstart", onTouchStart);
        pathEl.removeEventListener("touchmove", onTouchMove);
        pathEl.removeEventListener("touchend", endDrag);
        pathEl.removeEventListener("touchcancel", endDrag);
      }
      if (dragRef.current) {
        dragRef.current = null;
        suppressClampRef.current = false;
        map.dragging.enable();
        map.getContainer().style.cursor = "";
      }
    };
  }, [map, onDragEnd, onDragMove, radiusMeters, suppressClampRef]);

  return (
    <Circle
      ref={circleRef}
      center={center}
      radius={radiusMeters}
      pathOptions={MAP_PRIVACY_CIRCLE_DRAGGABLE_PATH}
      interactive
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
  forceDraggablePin = false,
  embed = false,
  mapHeight = 288,
}: Props) {
  const [localPosition, setLocalPosition] = useState(position);
  const [localLocationSelected, setLocalLocationSelected] = useState(hasDefinedLocation);
  const markerRef = useRef<L.Marker | null>(null);
  const markerWasDraggedRef = useRef(false);
  const skipFlyRef = useRef(false);
  /** Skip view clamping while the user drags the pin/circle (re-clamp on drag end). */
  const suppressClampRef = useRef(false);
  /** Pin only when exact location mode, or when preview forces a pin over the circle. */
  const showMarker = forceDraggablePin || !showApproximateRadius;
  const circleDraggable = Boolean(showApproximateRadius && radiusEditable && !forceDraggablePin);
  const circleRadius = clampApproximateRadiusMeters(approximateRadiusMeters);
  const anchorRadiusMeters = showApproximateRadius ? circleRadius : null;

  useEffect(() => {
    setLocalPosition(position);
    setLocalLocationSelected(hasDefinedLocation);
  }, [position, hasDefinedLocation]);

  const commitPosition = useCallback(
    (lat: number, lng: number) => {
      setLocalPosition([lat, lng]);
      setLocalLocationSelected(true);
      skipFlyRef.current = true;
      suppressClampRef.current = false;
      onPositionChange(lat, lng);
    },
    [onPositionChange],
  );

  const onCircleDragMove = useCallback((lat: number, lng: number) => {
    skipFlyRef.current = true;
    setLocalPosition([lat, lng]);
    setLocalLocationSelected(true);
  }, []);

  const commitMarkerPosition = useCallback(
    (marker?: L.Marker | null) => {
      const ll = (marker ?? markerRef.current)?.getLatLng();
      if (!ll) return;
      commitPosition(ll.lat, ll.lng);
    },
    [commitPosition],
  );

  const markerEventHandlers = useMemo(
    () => ({
      dragstart: () => {
        markerWasDraggedRef.current = true;
        suppressClampRef.current = true;
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
        maxZoom={MAP_MAX_ZOOM}
        className="z-0 w-full overflow-hidden rounded-xl border border-border shadow-sm [&_.leaflet-control-attribution]:text-[10px]"
        style={{ height: mapHeightStyle }}
        scrollWheelZoom
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <AttributionControl position="bottomleft" prefix={false} />
        <ZoomControl position="bottomright" />
        <MapViewSync position={localPosition} zoom={13} skipFlyRef={skipFlyRef} />
        <KeepLocationInView
          position={localPosition}
          radiusMeters={anchorRadiusMeters}
          suppressClampRef={suppressClampRef}
        />
        {showApproximateRadius && circleDraggable ? (
          <DraggablePrivacyCircle
            center={localPosition}
            radiusMeters={circleRadius}
            onDragMove={onCircleDragMove}
            onDragEnd={commitPosition}
            suppressClampRef={suppressClampRef}
          />
        ) : null}
        {showApproximateRadius && !circleDraggable ? (
          <Circle
            center={localPosition}
            radius={circleRadius}
            pathOptions={MAP_PRIVACY_CIRCLE_PATH}
            interactive={false}
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
            {circleDraggable
              ? "Arrastra el área verde para colocar la ubicación. Usa el control de radio abajo para ajustar el perímetro. Los clics fuera del área no la mueven."
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

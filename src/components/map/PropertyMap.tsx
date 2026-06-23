import type L from "leaflet";
import { useCallback, useEffect, useMemo, useRef, type MutableRefObject, type RefObject } from "react";
import { MapContainer, Marker, Popup, TileLayer, Circle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { listingCardHref } from "@/lib/listingKeyLabels";
import { listingPublicPath } from "@/lib/listingReference";
import { MAP_PRIVACY_CIRCLE_PATH } from "@/components/WizardLocationMap";
import { MapListingPopupOverlay } from "@/components/map/MapListingPopupOverlay";
import { MapSelectionSync } from "@/components/map/MapSelectionSync";
import { SearchListingCard } from "@/components/search/SearchListingCard";
import { GUADALAJARA_LA_MINERVA_ZOOM } from "@/lib/searchDefaults";
import type { Bbox } from "@/lib/searchFilters";
import type { LatLngBoundsBox, SearchNeighborhoodPin } from "@/lib/searchLocation";
import { combinedNeighborhoodBounds, neighborhoodPinBounds } from "@/lib/searchLocation";
import { listingNavigationState, type SearchReturnContext } from "@/lib/searchReturn";
import { listingMapPosition } from "@/map/listingMapPosition";
import {
  ensureLeafletDefaultIcons,
  selectedMarkerIcon,
  standardMarkerIcon,
} from "@/map/leafletIcons";
import type { PropertyListing } from "@/types/listing";

type Props = {
  listings: PropertyListing[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Full-bleed map inside split layout (no outer card radius). */
  embed?: boolean;
  className?: string;
  /** Debounced map `moveend` reports viewport bounds for geofenced search (e.g. `/buscar`). */
  onViewportBbox?: (bbox: Bbox) => void;
  defaultCenter?: [number, number];
  defaultZoom?: number;
  locationPins?: readonly SearchNeighborhoodPin[];
  locationFitNonce?: number;
  preferDefaultView?: boolean;
  /** Render approximate listings as a privacy circle at true coords (no pin). */
  approximateAsCircle?: boolean;
  approximateCircleRadiusM?: number;
  /** Skip fly-to on selection (e.g. fixed preview maps). */
  disableSelectionSync?: boolean;
  /** When set, listing popup links preserve search return context. */
  searchReturn?: SearchReturnContext;
  /** Portal pin-tied popup into this host (above map chrome such as filter rails). */
  popupOverlayHostRef?: RefObject<HTMLElement | null>;
};

const MEXICO_CENTER: [number, number] = [20.8, -99.5];
const NEIGHBORHOOD_FIT_PADDING: L.PointExpression = [56, 56];
/** Allow fitBounds to zoom in tightly; do not reuse URL viewport zoom as a ceiling. */
const NEIGHBORHOOD_FIT_MAX_ZOOM = 15;
const NEIGHBORHOOD_LOOSE_VIEW_SLACK = 1.28;

function latLngBoundsFromBox(box: LatLngBoundsBox): L.LatLngBounds {
  return L.latLngBounds([box.minLat, box.minLng], [box.maxLat, box.maxLng]);
}

function neighborhoodTargetBox(
  locationPins: readonly SearchNeighborhoodPin[],
): LatLngBoundsBox | null {
  if (!locationPins.length) return null;
  if (locationPins.length === 1) return neighborhoodPinBounds(locationPins[0]!);
  return combinedNeighborhoodBounds(locationPins);
}

function mapViewContainsBox(map: L.Map, box: LatLngBoundsBox): boolean {
  return map.getBounds().contains(latLngBoundsFromBox(box));
}

function viewIsLooserThanNeeded(map: L.Map, box: LatLngBoundsBox): boolean {
  const view = map.getBounds();
  const targetLatSpan = Math.max(box.maxLat - box.minLat, 0.001);
  const targetLngSpan = Math.max(box.maxLng - box.minLng, 0.001);
  const viewLatSpan = view.getNorth() - view.getSouth();
  const viewLngSpan = view.getEast() - view.getWest();
  return (
    viewLatSpan > targetLatSpan * NEIGHBORHOOD_LOOSE_VIEW_SLACK ||
    viewLngSpan > targetLngSpan * NEIGHBORHOOD_LOOSE_VIEW_SLACK
  );
}

function shouldRefitNeighborhoodPins(map: L.Map, locationPins: readonly SearchNeighborhoodPin[]): boolean {
  const targetBox = neighborhoodTargetBox(locationPins);
  if (!targetBox) return false;
  if (!mapViewContainsBox(map, targetBox)) return true;
  return viewIsLooserThanNeeded(map, targetBox);
}

function fitNeighborhoodPins(map: L.Map, locationPins: readonly SearchNeighborhoodPin[]) {
  if (!locationPins.length) return;

  const targetBox = neighborhoodTargetBox(locationPins);
  if (!targetBox) return;
  if (!shouldRefitNeighborhoodPins(map, locationPins)) return;

  map.fitBounds(latLngBoundsFromBox(targetBox), {
    padding: NEIGHBORHOOD_FIT_PADDING,
    maxZoom: NEIGHBORHOOD_FIT_MAX_ZOOM,
  });
}

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
  onBbox,
  suppressUntilRef,
}: {
  onBbox: (bbox: Bbox) => void;
  suppressUntilRef: MutableRefObject<number>;
}) {
  const map = useMap();
  const debounceRef = useRef<number>();

  const emit = useCallback(() => {
    if (Date.now() < suppressUntilRef.current) return;
    const b = map.getBounds();
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    onBbox({ minLat: sw.lat, minLng: sw.lng, maxLat: ne.lat, maxLng: ne.lng });
  }, [map, onBbox, suppressUntilRef]);

  useEffect(() => {
    window.setTimeout(() => emit(), 0);
  }, [emit]);

  useMapEvents({
    moveend() {
      if (Date.now() < suppressUntilRef.current) return;
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
  locationPins,
  locationFitNonce = 0,
  preferDefaultView = false,
  /** When true, never pan/zoom the map when listing markers change — viewport is user-controlled (geofenced search). */
  skipListingDrivenRefit,
  suppressViewportUntilRef,
}: {
  bounds: L.LatLngBounds | null;
  defaultCenter?: [number, number];
  defaultZoom?: number;
  locationPins?: readonly SearchNeighborhoodPin[];
  locationFitNonce?: number;
  preferDefaultView?: boolean;
  skipListingDrivenRefit: boolean;
  suppressViewportUntilRef?: MutableRefObject<number>;
}) {
  const map = useMap();
  const didInitialView = useRef(false);
  const appliedDefaultViewRef = useRef<string | null>(null);
  const locationPinKey =
    locationPins?.map((pin) => `${pin.name}:${pin.lat},${pin.lng}`).join("|") ?? "";
  const locationFitKey = `${locationPinKey}#${locationFitNonce}`;

  useEffect(() => {
    const el = map.getContainer();
    if (!el?.isConnected) return;
    try {
      map.invalidateSize({ animate: false });

      if (preferDefaultView && locationPins?.length) {
        if (appliedDefaultViewRef.current === locationFitKey) return;
        if (suppressViewportUntilRef) {
          suppressViewportUntilRef.current = Date.now() + 900;
        }
        fitNeighborhoodPins(map, locationPins);
        appliedDefaultViewRef.current = locationFitKey;
        didInitialView.current = true;
        return;
      }

      if (preferDefaultView && defaultCenter) {
        const zoom = defaultZoom ?? GUADALAJARA_LA_MINERVA_ZOOM;
        const viewKey = `${defaultCenter[0]},${defaultCenter[1]},${zoom}`;
        if (appliedDefaultViewRef.current === viewKey) {
          return;
        }
        if (suppressViewportUntilRef) {
          suppressViewportUntilRef.current = Date.now() + 900;
        }
        map.setView(defaultCenter, zoom);
        appliedDefaultViewRef.current = viewKey;
        didInitialView.current = true;
        return;
      }

      if (skipListingDrivenRefit) {
        if (didInitialView.current) return;
        if (defaultCenter) {
          map.setView(defaultCenter, defaultZoom ?? GUADALAJARA_LA_MINERVA_ZOOM);
          didInitialView.current = true;
        } else if (bounds?.isValid()) {
          map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
          didInitialView.current = true;
        } else {
          map.setView(MEXICO_CENTER, 5);
          didInitialView.current = true;
        }
        return;
      }

      if (bounds?.isValid()) {
        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
      } else if (defaultCenter) {
        map.setView(defaultCenter, defaultZoom ?? GUADALAJARA_LA_MINERVA_ZOOM);
      } else {
        map.setView(MEXICO_CENTER, 5);
      }
    } catch {
      /* map may be tearing down (React StrictMode / route change) */
    }
  }, [
    bounds,
    defaultCenter,
    defaultZoom,
    locationFitKey,
    locationFitNonce,
    locationPins,
    map,
    preferDefaultView,
    skipListingDrivenRefit,
    suppressViewportUntilRef,
  ]);
  return null;
}

export function PropertyMap({
  listings,
  selectedId,
  onSelect,
  embed = false,
  className = "",
  onViewportBbox,
  defaultCenter,
  defaultZoom,
  locationPins,
  locationFitNonce = 0,
  preferDefaultView = false,
  approximateAsCircle = false,
  approximateCircleRadiusM = 400,
  disableSelectionSync = false,
  searchReturn,
  popupOverlayHostRef,
}: Props) {
  useEffect(() => {
    ensureLeafletDefaultIcons();
  }, []);

  const markerRefs = useRef(new Map<string, L.Marker>());
  const suppressViewportBboxUntilRef = useRef(0);

  const registerMarker = useCallback((id: string, marker: L.Marker | null) => {
    if (marker) markerRefs.current.set(id, marker);
    else markerRefs.current.delete(id);
  }, []);

  const getMarker = useCallback((id: string) => markerRefs.current.get(id), []);

  const bounds = useMemo(() => {
    if (!listings.length) return null;
    const latLngs = listings.map((l) => listingMapPosition(l));
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
    ? "z-0 h-full min-h-0 w-full bg-surface-elevated [&_.leaflet-control-attribution]:text-[10px] [&_.leaflet-top.leaflet-left]:left-auto [&_.leaflet-top.leaflet-left]:right-3 [&_.leaflet-top.leaflet-left]:top-auto [&_.leaflet-top.leaflet-left]:bottom-3 [&_.leaflet-top.leaflet-left_.leaflet-control]:m-0"
    : "z-0 h-[min(52vh,420px)] w-full min-h-[280px] bg-surface-elevated [&_.leaflet-control-attribution]:text-[10px]";

  const usePinPopupOverlay = Boolean(popupOverlayHostRef);

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
          locationPins={locationPins}
          locationFitNonce={locationFitNonce}
          preferDefaultView={preferDefaultView}
          skipListingDrivenRefit={Boolean(onViewportBbox)}
          suppressViewportUntilRef={suppressViewportBboxUntilRef}
        />
        {onViewportBbox ? (
          <MapViewportReporter onBbox={onViewportBbox} suppressUntilRef={suppressViewportBboxUntilRef} />
        ) : null}
        {listings.map((l) => {
          const selected = l.id === selectedId;

          if (approximateAsCircle && l.isApproximateLocation) {
            return (
              <Circle
                key={l.id}
                center={[l.lat, l.lng]}
                radius={approximateCircleRadiusM}
                pathOptions={MAP_PRIVACY_CIRCLE_PATH}
                interactive={false}
              />
            );
          }

          const popupContent =
            usePinPopupOverlay ? null : (
              <Popup autoPan={false} className="search-listing-popup">
                <SearchListingCard
                  listing={l}
                  variant="popup"
                  to={searchReturn ? listingCardHref(l) : listingPublicPath(l.id)}
                  state={searchReturn ? listingNavigationState(searchReturn) : undefined}
                />
              </Popup>
            );

          const position = listingMapPosition(l);
          return (
            <Marker
              key={l.id}
              position={position}
              eventHandlers={{
                add: (e) => registerMarker(l.id, e.target as L.Marker),
                remove: () => registerMarker(l.id, null),
                click: () => onSelect(l.id),
              }}
              zIndexOffset={selected ? 700 : 0}
              icon={selected ? selectedMarkerIcon : standardMarkerIcon}
            >
              {popupContent}
            </Marker>
          );
        })}
        {!disableSelectionSync ? (
          <MapSelectionSync
            selectedId={selectedId}
            listings={listings}
            getMarker={getMarker}
            suppressViewportUntilRef={suppressViewportBboxUntilRef}
            openMarkerPopup={!usePinPopupOverlay}
          />
        ) : null}
        {usePinPopupOverlay && popupOverlayHostRef ? (
          <MapListingPopupOverlay
            hostRef={popupOverlayHostRef}
            selectedId={selectedId}
            listings={listings}
            onClose={() => onSelect(null)}
            searchReturn={searchReturn}
          />
        ) : null}
      </MapContainer>
    </div>
  );
}

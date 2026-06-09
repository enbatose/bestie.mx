import type L from "leaflet";
import { useEffect, useRef, type MutableRefObject } from "react";
import { useMap } from "react-leaflet";
import { listingMapPosition } from "@/map/listingMapPosition";
import type { PropertyListing } from "@/types/listing";

type Props = {
  selectedId: string | null;
  listings: PropertyListing[];
  getMarker: (id: string) => L.Marker | undefined;
  /** Skip geofenced bbox URL updates while programmatically centering on a pin. */
  suppressViewportUntilRef: MutableRefObject<number>;
};

export function MapSelectionSync({
  selectedId,
  listings,
  getMarker,
  suppressViewportUntilRef,
}: Props) {
  const map = useMap();
  const listingsRef = useRef(listings);
  listingsRef.current = listings;
  const lastSyncedRef = useRef<{ id: string; lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!selectedId) return;
    const hit = listingsRef.current.find((l) => l.id === selectedId);
    if (!hit) return;

    let cancelled = false;
    let opened = false;

    try {
      const el = map.getContainer();
      if (!el.isConnected) return;

      const [lat, lng] = listingMapPosition(hit);
      const last = lastSyncedRef.current;
      const needsFly = !last || last.id !== hit.id || last.lat !== lat || last.lng !== lng;

      const openPopupOnce = () => {
        if (cancelled || opened) return;
        const tryOpen = (attempt = 0) => {
          if (cancelled || opened) return;
          const marker = getMarker(hit.id);
          if (marker) {
            opened = true;
            marker.openPopup();
            return;
          }
          if (attempt < 12) {
            window.setTimeout(() => tryOpen(attempt + 1), 16);
          }
        };
        tryOpen();
      };

      if (needsFly) {
        suppressViewportUntilRef.current = Date.now() + 1500;

        const onMoveEnd = () => {
          map.off("moveend", onMoveEnd);
          openPopupOnce();
        };
        map.on("moveend", onMoveEnd);
        const fallbackTimer = window.setTimeout(openPopupOnce, 650);

        map.flyTo([lat, lng], Math.max(map.getZoom(), 12), { duration: 0.45 });
        lastSyncedRef.current = { id: hit.id, lat, lng };

        return () => {
          cancelled = true;
          map.off("moveend", onMoveEnd);
          window.clearTimeout(fallbackTimer);
        };
      }

      openPopupOnce();
    } catch {
      /* map/markers may be mid-teardown (StrictMode / navigation) */
    }

    return () => {
      cancelled = true;
    };
  }, [getMarker, map, selectedId, suppressViewportUntilRef]);

  return null;
}

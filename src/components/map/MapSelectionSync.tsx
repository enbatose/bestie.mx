import type L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { listingMapPosition } from "@/map/listingMapPosition";
import type { PropertyListing } from "@/types/listing";

type Props = {
  selectedId: string | null;
  listings: PropertyListing[];
  getMarker: (id: string) => L.Marker | undefined;
};

export function MapSelectionSync({ selectedId, listings, getMarker }: Props) {
  const map = useMap();
  const lastSyncedRef = useRef<{ id: string; lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!selectedId) return;
    const hit = listings.find((l) => l.id === selectedId);
    if (!hit) return;

    let cancelled = false;

    try {
      const el = map.getContainer();
      if (!el.isConnected) return;

      const [lat, lng] = listingMapPosition(hit);
      const last = lastSyncedRef.current;
      const needsFly = !last || last.id !== hit.id || last.lat !== lat || last.lng !== lng;

      const openPopup = () => {
        if (cancelled) return;
        const tryOpen = (attempt = 0) => {
          if (cancelled) return;
          const marker = getMarker(hit.id);
          if (marker) {
            marker.openPopup();
            return;
          }
          if (attempt < 8) {
            window.setTimeout(() => tryOpen(attempt + 1), 16);
          }
        };
        tryOpen();
      };

      if (needsFly) {
        const onMoveEnd = () => {
          map.off("moveend", onMoveEnd);
          openPopup();
        };
        map.on("moveend", onMoveEnd);
        map.flyTo([lat, lng], Math.max(map.getZoom(), 12), { duration: 0.45 });
        lastSyncedRef.current = { id: hit.id, lat, lng };
        return () => {
          cancelled = true;
          map.off("moveend", onMoveEnd);
        };
      }

      openPopup();
    } catch {
      /* map/markers may be mid-teardown (StrictMode / navigation) */
    }

    return () => {
      cancelled = true;
    };
  }, [getMarker, listings, map, selectedId]);

  return null;
}

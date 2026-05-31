import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { listingMapPosition } from "@/map/listingMapPosition";
import type { PropertyListing } from "@/types/listing";

type Props = {
  selectedId: string | null;
  listings: PropertyListing[];
};

export function MapSelectionSync({ selectedId, listings }: Props) {
  const map = useMap();
  const lastSyncedRef = useRef<{ id: string; lat: number; lng: number } | null>(null);

  useEffect(() => {
    const hit = listings.find((l) => l.id === selectedId);
    if (!hit) return;
    try {
      const el = map.getContainer();
      if (!el.isConnected) return;
      const [lat, lng] = listingMapPosition(hit);
      const last = lastSyncedRef.current;
      if (last && last.id === hit.id && last.lat === lat && last.lng === lng) {
        return;
      }
      map.flyTo([lat, lng], Math.max(map.getZoom(), 12), { duration: 0.45 });
      lastSyncedRef.current = { id: hit.id, lat, lng };
    } catch {
      /* map/markers may be mid-teardown (StrictMode / navigation) */
    }
  }, [listings, map, selectedId]);

  return null;
}

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { listingMapPosition } from "@/map/listingMapPosition";
import type { PropertyListing } from "@/types/listing";

type Props = {
  selectedId: string | null;
  listings: PropertyListing[];
};

export function MapSelectionSync({ selectedId, listings }: Props) {
  const map = useMap();

  useEffect(() => {
    const hit = listings.find((l) => l.id === selectedId);
    if (!hit) return;
    try {
      const el = map.getContainer();
      if (!el.isConnected) return;
      const [lat, lng] = listingMapPosition(hit);
      map.flyTo([lat, lng], Math.max(map.getZoom(), 12), { duration: 0.45 });
    } catch {
      /* map/markers may be mid-teardown (StrictMode / navigation) */
    }
  }, [listings, map, selectedId]);

  return null;
}
